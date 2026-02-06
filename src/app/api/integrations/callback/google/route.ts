import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getGoogleTokens } from '@/lib/integrations/oauth/google';
import { encrypt } from '@/lib/utils/encryption';
import { redis } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';
import { events, trackEvent } from '@/lib/analytics/events';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return Response.redirect('/settings/integrations?error=auth_failed', 302);
    }

    const stateData = await redis.get(`oauth:state:${state}`);
    if (!stateData) {
      return Response.redirect('/settings/integrations?error=auth_failed', 302);
    }

    const { userId, companyId, platform } = JSON.parse(stateData as string);

    if (!userId || !companyId || platform !== 'GOOGLE_WORKSPACE') {
      return Response.redirect('/settings/integrations?error=auth_failed', 302);
    }

    const tokens = await getGoogleTokens(code);

    const encryptedCredentials = encrypt(
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date,
        scope: tokens.scope,
      })
    );

    await prisma.integration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'GOOGLE_WORKSPACE',
        },
      },
      create: {
        companyId,
        platform: 'GOOGLE_WORKSPACE',
        credentials: encryptedCredentials,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
      update: {
        credentials: encryptedCredentials,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    });

    await redis.del(`oauth:state:${state}`);

    logger.info('Google Workspace connected successfully', { companyId });
    trackEvent(events.INTEGRATION_CONNECTED, {
      userId,
      companyId,
      platform: 'GOOGLE_WORKSPACE',
    });

    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=true`,
      302
    );
  } catch (error) {
    logger.error('Google OAuth callback error', error);
    return Response.redirect('/settings/integrations?error=auth_failed', 302);
  }
}
