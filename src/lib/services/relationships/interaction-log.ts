import { InteractionType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

type ParsedAddress = {
  name: string | null;
  email: string | null;
};

type ContactInput = {
  userId: string;
  companyId: string;
  email: string;
  name: string | null;
  lastContactAt: Date;
};

export async function logEmailInteraction(emailId: string) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      userId: true,
      companyId: true,
      from: true,
      to: true,
      cc: true,
      subject: true,
      snippet: true,
      receivedAt: true,
    },
  });

  if (!email) {
    throw new Error('Email not found.');
  }

  const user = await prisma.user.findUnique({
    where: { id: email.userId },
    select: { email: true },
  });

  const userEmail = user?.email?.toLowerCase() || null;
  const sender = parseEmailAddress(email.from);
  const recipients = new Map<string, ParsedAddress>();

  for (const entry of parseEmailEntries(email.to)) {
    if (entry.email) {
      recipients.set(entry.email, entry);
    }
  }

  for (const entry of parseEmailEntries(email.cc)) {
    if (entry.email) {
      recipients.set(entry.email, entry);
    }
  }

  const timestamp = email.receivedAt;

  if (sender.email && sender.email !== userEmail) {
    const contact = await ensureContact({
      userId: email.userId,
      companyId: email.companyId,
      email: sender.email,
      name: sender.name,
      lastContactAt: timestamp,
    });

    await prisma.contactInteraction.create({
      data: {
        contactId: contact.id,
        type: InteractionType.EMAIL_RECEIVED,
        subject: email.subject,
        summary: email.snippet,
        emailId: email.id,
        timestamp,
      },
    });
  }

  for (const entry of recipients.values()) {
    if (!entry.email || entry.email === userEmail) {
      continue;
    }

    const contact = await ensureContact({
      userId: email.userId,
      companyId: email.companyId,
      email: entry.email,
      name: entry.name,
      lastContactAt: timestamp,
    });

    await prisma.contactInteraction.create({
      data: {
        contactId: contact.id,
        type: InteractionType.EMAIL_SENT,
        subject: email.subject,
        summary: email.snippet,
        emailId: email.id,
        timestamp,
      },
    });
  }
}

export async function logMeetingInteraction(eventId: string) {
  const event = await prisma.calendarEvent.findUnique({
    where: { eventId },
    select: {
      id: true,
      userId: true,
      companyId: true,
      title: true,
      description: true,
      startTime: true,
      attendees: true,
    },
  });

  if (!event) {
    throw new Error('Calendar event not found.');
  }

  const user = await prisma.user.findUnique({
    where: { id: event.userId },
    select: { email: true },
  });

  const userEmail = user?.email?.toLowerCase() || null;
  const timestamp = event.startTime;

  for (const attendee of event.attendees) {
    const entry = parseEmailAddress(attendee);
    if (!entry.email || entry.email === userEmail) {
      continue;
    }

    const contact = await ensureContact({
      userId: event.userId,
      companyId: event.companyId,
      email: entry.email,
      name: entry.name,
      lastContactAt: timestamp,
    });

    await prisma.contactInteraction.create({
      data: {
        contactId: contact.id,
        type: InteractionType.MEETING,
        subject: event.title,
        summary: event.description || null,
        eventId: event.id,
        timestamp,
      },
    });
  }
}

async function ensureContact(input: ContactInput) {
  const existing = await prisma.contact.findUnique({
    where: {
      userId_email: {
        userId: input.userId,
        email: input.email,
      },
    },
    select: { id: true, name: true, lastContactAt: true },
  });

  if (!existing) {
    return prisma.contact.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        email: input.email,
        name: input.name || input.email,
        category: 'OTHER',
        vipStatus: false,
        lastContactAt: input.lastContactAt,
      },
    });
  }

  const updateData: { name?: string; lastContactAt?: Date } = {};
  let needsUpdate = false;

  if (!existing.name || existing.name === input.email) {
    if (input.name) {
      updateData.name = input.name;
      needsUpdate = true;
    }
  }

  if (!existing.lastContactAt || input.lastContactAt > existing.lastContactAt) {
    updateData.lastContactAt = input.lastContactAt;
    needsUpdate = true;
  }

  if (!needsUpdate) {
    return prisma.contact.findUniqueOrThrow({
      where: {
        userId_email: {
          userId: input.userId,
          email: input.email,
        },
      },
    });
  }

  return prisma.contact.update({
    where: {
      userId_email: {
        userId: input.userId,
        email: input.email,
      },
    },
    data: updateData,
  });
}

function parseEmailEntries(values: string[]): ParsedAddress[] {
  if (!values?.length) {
    return [];
  }

  return values
    .flatMap((value) => value.split(','))
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
