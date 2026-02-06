import { ContactCategory } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

type CandidateContact = {
  name: string | null;
  lastContactAt: Date;
};

type ParsedAddress = {
  name: string | null;
  email: string | null;
};

type CategoryContext = {
  email: string;
  companyDomain: string | null;
  customerDomains: Set<string>;
  title?: string | null;
};

export async function syncContacts(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, companyId: true },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  const [emails, events, customerContacts] = await prisma.$transaction([
    prisma.email.findMany({
      where: { userId },
      select: { from: true, to: true, cc: true, receivedAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: { userId },
      select: { attendees: true, startTime: true },
    }),
    prisma.contact.findMany({
      where: { companyId: user.companyId, category: 'CUSTOMER' },
      select: { email: true },
    }),
  ]);

  const companyDomain = extractDomain(user.email);
  const customerDomains = new Set(
    customerContacts
      .map((contact) => extractDomain(contact.email))
      .filter((domain): domain is string => Boolean(domain))
  );

  const candidates = new Map<string, CandidateContact>();

  for (const email of emails) {
    const emailDate = email.receivedAt;

    for (const entry of parseEmailEntries(email.from)) {
      recordCandidate(candidates, entry, emailDate);
    }

    for (const value of email.to) {
      for (const entry of parseEmailEntries(value)) {
        recordCandidate(candidates, entry, emailDate);
      }
    }

    for (const value of email.cc) {
      for (const entry of parseEmailEntries(value)) {
        recordCandidate(candidates, entry, emailDate);
      }
    }
  }

  for (const event of events) {
    const eventDate = event.startTime;
    for (const attendee of event.attendees) {
      for (const entry of parseEmailEntries(attendee)) {
        recordCandidate(candidates, entry, eventDate);
      }
    }
  }

  const normalizedUserEmail = user.email.toLowerCase();
  const uniqueEmails = Array.from(candidates.keys()).filter(
    (email) => email !== normalizedUserEmail
  );

  if (!uniqueEmails.length) {
    return { created: 0, updated: 0, total: 0 };
  }

  const existingContacts = await prisma.contact.findMany({
    where: {
      userId,
      email: { in: uniqueEmails },
    },
    select: {
      id: true,
      email: true,
      name: true,
      lastContactAt: true,
      category: true,
      title: true,
    },
  });

  const existingByEmail = new Map(existingContacts.map((contact) => [contact.email, contact]));
  let created = 0;
  let updated = 0;

  for (const [email, candidate] of candidates.entries()) {
    if (email === normalizedUserEmail) {
      continue;
    }

    const existing = existingByEmail.get(email);
    if (!existing) {
      const autoCategory =
        determineCategory({
          email,
          companyDomain,
          customerDomains,
          title: null,
        }) || 'OTHER';

      await prisma.contact.create({
        data: {
          userId,
          companyId: user.companyId,
          email,
          name: candidate.name || email,
          category: autoCategory,
          vipStatus: false,
          lastContactAt: candidate.lastContactAt,
        },
      });
      created += 1;
      continue;
    }

    const updateData: {
      name?: string;
      lastContactAt?: Date;
      category?: ContactCategory;
    } = {};
    let needsUpdate = false;

    if (
      candidate.lastContactAt &&
      (!existing.lastContactAt || candidate.lastContactAt > existing.lastContactAt)
    ) {
      updateData.lastContactAt = candidate.lastContactAt;
      needsUpdate = true;
    }

    const bestName = chooseBestName(existing.name, candidate.name, email);
    if (bestName && bestName !== existing.name) {
      updateData.name = bestName;
      needsUpdate = true;
    }

    const autoCategory = determineCategory({
      email,
      companyDomain,
      customerDomains,
      title: existing.title,
    });

    if (autoCategory && existing.category === 'OTHER') {
      updateData.category = autoCategory;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: updateData,
      });
      updated += 1;
    }
  }

  return { created, updated, total: created + updated };
}

function recordCandidate(
  candidates: Map<string, CandidateContact>,
  entry: ParsedAddress,
  lastContactAt: Date
) {
  if (!entry.email) {
    return;
  }

  const email = entry.email.toLowerCase();
  const existing = candidates.get(email);

  if (!existing) {
    candidates.set(email, {
      name: entry.name,
      lastContactAt,
    });
    return;
  }

  if (entry.name && (!existing.name || existing.name === email)) {
    existing.name = entry.name;
  }

  if (lastContactAt > existing.lastContactAt) {
    existing.lastContactAt = lastContactAt;
  }
}

function parseEmailEntries(value: string): ParsedAddress[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => parseEmailAddress(entry))
    .filter((entry) => Boolean(entry.email));
}

function parseEmailAddress(value: string): ParsedAddress {
  if (!value) {
    return { name: null, email: null };
  }

  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/"/g, '').trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }

  const email = value.trim().toLowerCase();
  return { name: null, email: email || null };
}

function chooseBestName(
  existingName: string,
  candidateName: string | null,
  email: string
): string {
  if (!candidateName) {
    return existingName;
  }

  if (!existingName || existingName === email) {
    return candidateName;
  }

  return existingName;
}

function determineCategory({
  email,
  companyDomain,
  customerDomains,
  title,
}: CategoryContext): ContactCategory | null {
  const domain = extractDomain(email);
  if (companyDomain && domain === companyDomain) {
    return 'TEAM';
  }

  const normalizedTitle = title?.toLowerCase() || '';
  if (normalizedTitle.includes('investor') || normalizedTitle.includes('partner')) {
    return 'INVESTOR';
  }

  if (normalizedTitle.includes('vc')) {
    return 'INVESTOR';
  }

  if (normalizedTitle.includes('board')) {
    return 'BOARD_MEMBER';
  }

  if (domain && customerDomains.has(domain)) {
    return 'CUSTOMER';
  }

  return null;
}

function extractDomain(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }

  return email.split('@')[1].toLowerCase();
}
