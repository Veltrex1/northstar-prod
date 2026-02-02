import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { analyzeSentEmails } from '@/lib/email/style-analyzer';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const styleProfile = await analyzeSentEmails(auth.user.userId);

    return successResponse({
      message: 'Email style learned successfully',
      profile: styleProfile,
    });
  } catch (error) {
    return errorResponse('LEARN_ERROR', 'Failed to learn email style', 500);
  }
}
