import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const drafts = await prisma.emailDraft.findMany({
      where: {
        userId: auth.user.userId,
        status: 'DRAFT',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return successResponse({ drafts });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch drafts', 500);
  }
}
