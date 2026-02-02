import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { getGoogleAuthUrl } from '@/lib/integrations/oauth/google';
import { redis } from '@/lib/cache/redis';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const connectSchema = z.object({
  platform: z.enum(['GOOGLE_WORKSPACE', 'MICROSOFT_365', 'SLACK', 'SALESFORCE', 'QUICKBOOKS']),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const { platform } = connectSchema.parse(body);

    const stateToken = nanoid();

    await redis.set(
      `oauth:state:${stateToken}`,
      JSON.stringify({
        userId: auth.user.userId,
        companyId: auth.user.companyId,
        platform,
      }),
      { ex: 600 }
    );

    let authUrl: string;

    switch (platform) {
      case 'GOOGLE_WORKSPACE':
        authUrl = `${getGoogleAuthUrl()}&state=${stateToken}`;
        break;
      default:
        return errorResponse('UNSUPPORTED_PLATFORM', 'Platform not yet supported', 400);
    }

    return successResponse({ authUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', error.errors[0].message, 400);
    }
    return errorResponse('CONNECT_ERROR', 'Failed to initiate connection', 500);
  }
}
