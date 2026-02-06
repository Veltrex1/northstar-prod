import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const startParam = parseDateParam(searchParams.get('start'));
    const endParam = parseDateParam(searchParams.get('end'));
    const start = startParam || now;
    const end = endParam || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: auth.user.userId,
        startTime: {
          gte: start,
          lte: end,
        },
        status: 'CONFIRMED',
      },
      include: {
        meetingBrief: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfNextWeek = new Date(startOfToday);
    startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

    const today = [];
    const thisWeek = [];
    const upcoming = [];

    for (const event of events) {
      if (event.startTime >= startOfToday && event.startTime < startOfTomorrow) {
        today.push(event);
      } else if (
        event.startTime >= startOfTomorrow &&
        event.startTime < startOfNextWeek
      ) {
        thisWeek.push(event);
      } else if (event.startTime >= startOfNextWeek) {
        upcoming.push(event);
      }
    }

    return successResponse({
      today,
      thisWeek,
      upcoming,
    });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch meetings', 500);
  }
}
