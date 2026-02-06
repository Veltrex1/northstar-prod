import { ContactCategory } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

type RelationshipHealth = {
  status: 'healthy' | 'due' | 'overdue';
  daysSinceContact: number;
  nextContactDue: Date;
  expectedFrequencyDays: number | null;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_GRACE_DAYS = 7;

export async function calculateRelationshipHealth(
  contactId: string
): Promise<RelationshipHealth> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      category: true,
      lastContactAt: true,
      createdAt: true,
      interactions: {
        orderBy: { timestamp: 'desc' },
        take: 1,
        select: { timestamp: true },
      },
    },
  });

  if (!contact) {
    throw new Error('Contact not found.');
  }

  const expectedFrequencyDays = getExpectedFrequencyDays(contact.category);
  const latestInteraction = contact.interactions[0]?.timestamp || null;
  const lastContactAt =
    contact.lastContactAt || latestInteraction || contact.createdAt;
  const daysSinceContact = Math.max(
    0,
    Math.floor((Date.now() - lastContactAt.getTime()) / ONE_DAY_MS)
  );

  if (!expectedFrequencyDays) {
    return {
      status: 'healthy',
      daysSinceContact,
      nextContactDue: lastContactAt,
      expectedFrequencyDays,
    };
  }

  const nextContactDue = new Date(
    lastContactAt.getTime() + expectedFrequencyDays * ONE_DAY_MS
  );

  if (daysSinceContact < expectedFrequencyDays) {
    return {
      status: 'healthy',
      daysSinceContact,
      nextContactDue,
      expectedFrequencyDays,
    };
  }

  if (daysSinceContact < expectedFrequencyDays + OVERDUE_GRACE_DAYS) {
    return {
      status: 'due',
      daysSinceContact,
      nextContactDue,
      expectedFrequencyDays,
    };
  }

  return {
    status: 'overdue',
    daysSinceContact,
    nextContactDue,
    expectedFrequencyDays,
  };
}

export async function getRelationshipReminders(userId: string) {
  const contacts = await prisma.contact.findMany({
    where: { userId, vipStatus: true },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      title: true,
      category: true,
      lastContactAt: true,
      createdAt: true,
    },
  });

  const reminders: Array<{
    contact: typeof contacts[number];
    health: RelationshipHealth;
    overdueByDays: number;
  }> = [];

  for (const contact of contacts) {
    const health = await calculateRelationshipHealth(contact.id);

    if (health.status === 'due' || health.status === 'overdue') {
      const overdueByDays = health.expectedFrequencyDays
        ? Math.max(0, health.daysSinceContact - health.expectedFrequencyDays)
        : 0;
      reminders.push({ contact, health, overdueByDays });
    }
  }

  reminders.sort((a, b) => b.overdueByDays - a.overdueByDays);
  return reminders;
}

function getExpectedFrequencyDays(category: ContactCategory): number | null {
  switch (category) {
    case 'INVESTOR':
      return 28;
    case 'BOARD_MEMBER':
      return 14;
    case 'CUSTOMER':
      return 42;
    case 'PARTNER':
      return 28;
    case 'TEAM':
      return null;
    case 'ADVISOR':
      return 56;
    default:
      return null;
  }
}
