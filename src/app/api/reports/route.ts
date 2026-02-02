import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const reports = await prisma.boardReport.findMany({
      where: { companyId: auth.user.companyId },
      orderBy: { generatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        format: true,
        status: true,
        fileUrl: true,
        generatedAt: true,
      },
    });

    return successResponse({ reports });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch reports', 500);
  }
}
