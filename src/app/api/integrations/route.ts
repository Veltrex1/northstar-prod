import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const integrations = await prisma.integration.findMany({
      where: { companyId: auth.user.companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        status: true,
        lastSyncAt: true,
        metadata: true,
      },
    });

    return successResponse({ integrations });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch integrations', 500);
  }
}
