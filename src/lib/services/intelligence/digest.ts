import { prisma } from '@/lib/db/prisma';
import { getRelationshipReminders } from '@/lib/services/relationships/health-score';

type DigestContent = {
  date: string;
  greeting: string;
  summary: string;
  emails: {
    total: number;
    urgent: number;
    high: number;
    normal: number;
    low: number;
    draftsReady: number;
    topSenders: Array<{ sender: string; count: number }>;
  };
  meetings: {
    total: number;
    nextMeeting: {
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      attendees: string[];
      meetingUrl?: string | null;
    } | null;
    briefsReady: number;
  };
  insights: Array<unknown>;
  reminders: Array<unknown>;
  goals: Array<unknown>;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function generateDailyDigest(userId: string, date: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      companyId: true,
      personalityProfile: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });

  if (!company) {
    throw new Error('Company not found');
  }

  const windowEnd = new Date(date);
  const windowStart = new Date(date.getTime() - ONE_DAY_MS);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [
    totalEmails,
    emailPriorityCounts,
    draftsReady,
    topSenderGroups,
    meetingsToday,
    nextMeeting,
    briefsReady,
    relationshipRemindersData,
    goalMemories,
  ] = await Promise.all([
    prisma.email.count({
      where: {
        userId,
        receivedAt: { gte: windowStart, lte: windowEnd },
      },
    }),
    prisma.email.groupBy({
      by: ['priority'],
      where: {
        userId,
        receivedAt: { gte: windowStart, lte: windowEnd },
      },
      _count: { _all: true },
    }),
    prisma.email.count({
      where: {
        userId,
        status: 'DRAFT_READY',
        updatedAt: { gte: windowStart, lte: windowEnd },
      },
    }),
    prisma.email.groupBy({
      by: ['from'],
      where: {
        userId,
        receivedAt: { gte: windowStart, lte: windowEnd },
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 5,
    }),
    prisma.calendarEvent.count({
      where: {
        userId,
        startTime: { gte: dayStart, lt: dayEnd },
        status: { in: ['CONFIRMED', 'TENTATIVE'] },
      },
    }),
    prisma.calendarEvent.findFirst({
      where: {
        userId,
        startTime: { gte: windowEnd },
        status: { in: ['CONFIRMED', 'TENTATIVE'] },
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        attendees: true,
        meetingUrl: true,
      },
    }),
    prisma.meetingBrief.count({
      where: {
        event: {
          userId,
          startTime: { gte: dayStart, lt: dayEnd },
        },
      },
    }),
    getRelationshipReminders(userId),
    prisma.conversationMemory.findMany({
      where: {
        userId,
        type: 'GOAL',
      },
      orderBy: { lastAccessed: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        lastAccessed: true,
        metadata: true,
      },
    }),
  ]);

  const priorityCounts = {
    URGENT: 0,
    HIGH: 0,
    NORMAL: 0,
    LOW: 0,
  };

  for (const group of emailPriorityCounts) {
    priorityCounts[group.priority] = group._count._all;
  }

  const topSenders = topSenderGroups.map((group) => ({
    sender: group.from,
    count: group._count._all,
  }));

  const relationshipReminders = relationshipRemindersData
    .filter((reminder) => reminder.health.status === 'overdue')
    .slice(0, 3)
    .map((reminder) => ({
      type: 'relationship',
      contact: reminder.contact,
      health: reminder.health,
    }));

  const goals = goalMemories.map((goal) => ({
    id: goal.id,
    title: goal.title,
    content: goal.content,
    createdAt: goal.createdAt.toISOString(),
    lastAccessed: goal.lastAccessed.toISOString(),
    metadata: goal.metadata ?? {},
  }));

  const goalReminders = goals.map((goal) => ({
    type: 'goal_checkin',
    goal,
  }));

  const digestContent: DigestContent = {
    date: dayStart.toISOString(),
    greeting: `Good morning, ${user.name}`,
    summary: "Here's what you need to know today",
    emails: {
      total: totalEmails,
      urgent: priorityCounts.URGENT,
      high: priorityCounts.HIGH,
      normal: priorityCounts.NORMAL,
      low: priorityCounts.LOW,
      draftsReady,
      topSenders,
    },
    meetings: {
      total: meetingsToday,
      nextMeeting: nextMeeting
        ? {
            id: nextMeeting.id,
            title: nextMeeting.title,
            startTime: nextMeeting.startTime.toISOString(),
            endTime: nextMeeting.endTime.toISOString(),
            attendees: nextMeeting.attendees || [],
            meetingUrl: nextMeeting.meetingUrl,
          }
        : null,
      briefsReady,
    },
    insights: [],
    reminders: [...relationshipReminders, ...goalReminders],
    goals,
  };

  const digest = await prisma.dailyDigest.create({
    data: {
      userId: user.id,
      companyId: company.id,
      date: dayStart,
      content: digestContent,
    },
  });

  return digest;
}
