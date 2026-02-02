import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getGoogleTokens } from '@/lib/integrations/oauth/google';
import { encrypt } from '@/lib/utils/encryption';
import { redis } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      throw new Error('Missing code or state');
    }

    const stateData = await redis.get(`oauth:state:${state}`);
    if (!stateData) {
      throw new Error('Invalid or expired state');
    }

    const { companyId } = JSON.parse(stateData as string);

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

    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=true`,
      302
    );
  } catch (error) {
    logger.error('Google OAuth callback error', error);
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=auth_failed`,
      302
    );
  }
}
