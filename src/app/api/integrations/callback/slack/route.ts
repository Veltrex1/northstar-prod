import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSlackTokens } from '@/lib/integrations/oauth/slack';
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

    if (!userId || !companyId || platform !== 'SLACK') {
      return Response.redirect('/settings/integrations?error=auth_failed', 302);
    }

    const tokens = await getSlackTokens(code);

    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
    const authedUserExpiresAt = tokens.authed_user?.expires_in
      ? Date.now() + tokens.authed_user.expires_in * 1000
      : null;

    const encryptedCredentials = encrypt(
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope,
        tokenType: tokens.token_type,
        botUserId: tokens.bot_user_id,
        appId: tokens.app_id,
        teamId: tokens.team?.id,
        teamName: tokens.team?.name,
        enterpriseId: tokens.enterprise?.id,
        enterpriseName: tokens.enterprise?.name,
        authedUser: {
          id: tokens.authed_user?.id,
          accessToken: tokens.authed_user?.access_token,
          refreshToken: tokens.authed_user?.refresh_token,
          expiresAt: authedUserExpiresAt,
          scope: tokens.authed_user?.scope,
          tokenType: tokens.authed_user?.token_type,
        },
      })
    );

    await prisma.integration.upsert({
      where: {
        companyId_platform: {
          companyId,
          platform: 'SLACK',
        },
      },
      create: {
        companyId,
        platform: 'SLACK',
        credentials: encryptedCredentials,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
        metadata: {
          teamId: tokens.team?.id,
          teamName: tokens.team?.name,
          authedUserId: tokens.authed_user?.id,
        },
      },
      update: {
        credentials: encryptedCredentials,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
        metadata: {
          teamId: tokens.team?.id,
          teamName: tokens.team?.name,
          authedUserId: tokens.authed_user?.id,
        },
      },
    });

    await redis.del(`oauth:state:${state}`);

    logger.info('Slack connected successfully', { companyId });
    trackEvent(events.INTEGRATION_CONNECTED, {
      userId,
      companyId,
      platform: 'SLACK',
    });

    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=true`,
      302
    );
  } catch (error) {
    logger.error('Slack OAuth callback error', error);
    return Response.redirect('/settings/integrations?error=auth_failed', 302);
  }
}
