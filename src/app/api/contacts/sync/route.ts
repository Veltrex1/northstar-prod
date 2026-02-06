import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { syncContacts } from '@/lib/services/relationships/contact-sync';
import { events, trackEvent } from '@/lib/analytics/events';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const result = await syncContacts(auth.user.userId);
    trackEvent(events.CONTACT_SYNCED, {
      userId: auth.user.userId,
      companyId: auth.user.companyId,
      ...result,
    });
    return successResponse(result);
  } catch (error) {
    return errorResponse('SYNC_FAILED', 'Failed to sync contacts', 500);
  }
}
