import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';

const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const;

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const where = {
      userId: auth.user.userId,
      status: 'DRAFT_READY' as const,
    };

    const [total, grouped, extremes] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.groupBy({
        by: ['priority'],
        where,
        _count: { _all: true },
      }),
      prisma.email.aggregate({
        where,
        _min: { receivedAt: true },
        _max: { receivedAt: true },
      }),
    ]);

    const byPriority = PRIORITIES.reduce(
      (acc, priority) => {
        acc[priority] = 0;
        return acc;
      },
      {} as Record<(typeof PRIORITIES)[number], number>
    );

    for (const row of grouped) {
      byPriority[row.priority as (typeof PRIORITIES)[number]] = row._count._all;
    }

    return successResponse({
      total,
      byPriority,
      oldest: extremes._min.receivedAt,
      newest: extremes._max.receivedAt,
    });
  } catch (error) {
    return errorResponse('STATS_ERROR', 'Failed to fetch email queue stats', 500);
  }
}
