import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const today = startOfDay(new Date());
    const digest = await prisma.dailyDigest.findUnique({
      where: {
        userId_date: {
          userId: auth.user.userId,
          date: today,
        },
      },
    });

    return successResponse({ digest });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch daily digest', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const today = startOfDay(new Date());
    const existing = await prisma.dailyDigest.findUnique({
      where: {
        userId_date: {
          userId: auth.user.userId,
          date: today,
        },
      },
    });

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Daily digest not found', 404);
    }

    const digest = await prisma.dailyDigest.update({
      where: { id: existing.id },
      data: { dismissedAt: new Date() },
    });

    return successResponse({ digest });
  } catch (error) {
    return errorResponse('UPDATE_ERROR', 'Failed to dismiss daily digest', 500);
  }
}
