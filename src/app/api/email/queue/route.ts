import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';

const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const pageParam = Number(searchParams.get('page') || '1');
    const pageSizeParam = Number(searchParams.get('pageSize') || DEFAULT_PAGE_SIZE);

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const pageSize =
      Number.isFinite(pageSizeParam) && pageSizeParam > 0
        ? Math.floor(pageSizeParam)
        : DEFAULT_PAGE_SIZE;

    const where = {
      userId: auth.user.userId,
      status: 'DRAFT_READY' as const,
    };

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        include: { draft: true },
        orderBy: [{ priority: 'asc' }, { receivedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return successResponse({
      emails,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch email queue', 500);
  }
}
