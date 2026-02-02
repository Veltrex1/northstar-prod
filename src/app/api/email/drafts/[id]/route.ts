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
    const draft = await prisma.emailDraft.findUnique({
      where: { id: params.id },
    });

    if (!draft) {
      return errorResponse('NOT_FOUND', 'Draft not found', 404);
    }

    if (draft.userId !== auth.user.userId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    return successResponse({ draft });
  } catch (error) {
    return errorResponse('FETCH_ERROR', 'Failed to fetch draft', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const draft = await prisma.emailDraft.findUnique({
      where: { id: params.id },
    });

    if (!draft) {
      return errorResponse('NOT_FOUND', 'Draft not found', 404);
    }

    if (draft.userId !== auth.user.userId) {
      return errorResponse('FORBIDDEN', 'Access denied', 403);
    }

    await prisma.emailDraft.delete({
      where: { id: params.id },
    });

    return successResponse({ message: 'Draft deleted' });
  } catch (error) {
    return errorResponse('DELETE_ERROR', 'Failed to delete draft', 500);
  }
}
