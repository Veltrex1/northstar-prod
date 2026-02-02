import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { syncGoogleDrive } from '@/lib/integrations/sync/google-drive';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const integration = await prisma.integration.findUnique({
      where: { id: params.id },
    });

    if (!integration) {
      return errorResponse('NOT_FOUND', 'Integration not found', 404);
    }

    if (integration.companyId !== auth.user.companyId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    let result;

    switch (integration.platform) {
      case 'GOOGLE_WORKSPACE':
        result = await syncGoogleDrive(integration.id);
        break;
      default:
        return errorResponse(
          'UNSUPPORTED',
          'Sync not implemented for this platform',
          400
        );
    }

    return successResponse(result);
  } catch (error) {
    return errorResponse('SYNC_ERROR', 'Failed to sync integration', 500);
  }
}
