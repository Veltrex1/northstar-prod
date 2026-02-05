import { prisma } from '@/lib/db/prisma';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { refreshMicrosoftTokens } from '@/lib/integrations/oauth/microsoft';

const TOKEN_REFRESH_BUFFER_MS = 60_000;

export type MicrosoftCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
};

type IntegrationRecord = {
  id: string;
  credentials: string;
};

export async function getMicrosoftAccessToken(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  return getMicrosoftAccessTokenFromIntegration(integration);
}

export async function getMicrosoftAccessTokenFromIntegration(
  integration: IntegrationRecord
) {
  const credentials = JSON.parse(
    decrypt(integration.credentials)
  ) as MicrosoftCredentials;
  let accessToken = credentials.accessToken;
  let refreshToken = credentials.refreshToken;
  let expiresAt = credentials.expiresAt;

  if (
    refreshToken &&
    expiresAt &&
    Date.now() >= expiresAt - TOKEN_REFRESH_BUFFER_MS
  ) {
    const refreshed = await refreshMicrosoftTokens(refreshToken);
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token || refreshToken;
    expiresAt = refreshed.expires_in
      ? Date.now() + refreshed.expires_in * 1000
      : expiresAt;

    const updatedCredentials: MicrosoftCredentials = {
      ...credentials,
      accessToken,
      refreshToken,
      expiresAt,
      scope: refreshed.scope || credentials.scope,
      tokenType: refreshed.token_type || credentials.tokenType,
      idToken: refreshed.id_token || credentials.idToken,
    };

    await prisma.integration.update({
      where: { id: integration.id },
      data: { credentials: encrypt(JSON.stringify(updatedCredentials)) },
    });
  }

  return { accessToken };
}
