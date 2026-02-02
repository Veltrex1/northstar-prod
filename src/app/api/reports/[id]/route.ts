import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const report = await prisma.boardReport.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return errorResponse('NOT_FOUND', 'Report not found', 404);
    }

    if (report.companyId !== auth.user.companyId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    return successResponse({ report });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch report', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const report = await prisma.boardReport.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return errorResponse('NOT_FOUND', 'Report not found', 404);
    }

    if (report.companyId !== auth.user.companyId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    await prisma.boardReport.delete({
      where: { id: params.id },
    });

    return successResponse({ message: 'Report deleted' });
  } catch (error) {
    return errorResponse('DELETE_ERROR', 'Failed to delete report', 500);
  }
}
