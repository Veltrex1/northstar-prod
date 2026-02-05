import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getMicrosoftTokens } from '@/lib/integrations/oauth/microsoft';
import { encrypt } from '@/lib/utils/encryption';
import { redis } from '@/lib/cache/redis';
import { logger } from '@/lib/utils/logger';

const PLATFORM_MAP: Record<string, 'MICROSOFT_365'> = {
  microsoft: 'MICROSOFT_365',
  'microsoft-365': 'MICROSOFT_365',
};

function getAppBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

function redirectToError(request: NextRequest) {
  const url = new URL('/settings/integrations?error=auth_failed', getAppBaseUrl(request));
  return Response.redirect(url.toString(), 302);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: rawPlatform } = await params;
    const platformKey = rawPlatform?.toLowerCase();
    const platform = platformKey ? PLATFORM_MAP[platformKey] : undefined;

    if (!platform) {
      return redirectToError(request);
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return redirectToError(request);
    }

    const stateData = await redis.get(`oauth:state:${state}`);
    if (!stateData) {
      return redirectToError(request);
    }

    const parsedState =
      typeof stateData === 'string'
        ? JSON.parse(stateData)
        : (stateData as { userId?: string; companyId?: string; platform?: string });
    const { userId, companyId, platform: statePlatform } = parsedState;

    if (!userId || !companyId || statePlatform !== platform) {
      return redirectToError(request);
    }

    const tokens = await getMicrosoftTokens(code);
    const expiresAt = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined;

    const encryptedCredentials = encrypt(
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        idToken: tokens.id_token,
      })
    );

    await prisma.integration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform,
        },
      },
      create: {
        companyId,
        platform,
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

    logger.info('Microsoft 365 connected successfully', { companyId });

    return Response.redirect(
      new URL('/settings/integrations?success=true', getAppBaseUrl(request)).toString(),
      302
    );
  } catch (error) {
    logger.error('Microsoft OAuth callback error', error);
    return redirectToError(request);
  }
}
