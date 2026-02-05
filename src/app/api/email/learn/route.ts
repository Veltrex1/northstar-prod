import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { analyzeSentEmails, EmailStyleError } from '@/lib/email/style-analyzer';
import { MonthlyTokenLimitError } from '@/lib/ai/usage-limits';
import { z } from 'zod';

const learnSchema = z.object({
  platform: z.enum(['GOOGLE_WORKSPACE', 'MICROSOFT_365']).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const { platform } = learnSchema.parse(body);

    const styleProfile = await analyzeSentEmails(auth.user.userId, platform);

    return successResponse({
      message: 'Email style learned successfully',
      profile: styleProfile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof MonthlyTokenLimitError) {
      return errorResponse(error.code, error.message, error.status);
    }
    if (error instanceof EmailStyleError) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse('LEARN_ERROR', 'Failed to learn email style', 500);
  }
}
