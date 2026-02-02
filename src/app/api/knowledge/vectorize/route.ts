import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { vectorizeAllDocuments } from '@/lib/ai/knowledge-ingestion';
import { initializePineconeIndex } from '@/lib/ai/vector-search';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    await initializePineconeIndex();
    const result = await vectorizeAllDocuments(auth.user.companyId);
    return successResponse(result);
  } catch (error) {
    return errorResponse(
      'VECTORIZATION_ERROR',
      'Failed to vectorize documents',
      500
    );
  }
}
