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
    const integration = await prisma.integration.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        companyId: true,
        platform: true,
        status: true,
        lastSyncAt: true,
        metadata: true,
      },
    });

    if (!integration) {
      return errorResponse('NOT_FOUND', 'Integration not found', 404);
    }

    if (integration.companyId !== auth.user.companyId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    const { companyId, ...safeIntegration } = integration;

    return successResponse({ integration: safeIntegration });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch integration', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const integration = await prisma.integration.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!integration) {
      return errorResponse('NOT_FOUND', 'Integration not found', 404);
    }

    if (integration.companyId !== auth.user.companyId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    await prisma.integration.delete({
      where: { id: params.id },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse('DELETE_ERROR', 'Failed to delete integration', 500);
  }
}
