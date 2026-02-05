const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.MICROSOFT_REDIRECT_URI ||
  'http://localhost:3000/api/integrations/callback/microsoft';
const TENANT = process.env.MICROSOFT_TENANT_ID || 'common';

const AUTH_BASE_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;

const DEFAULT_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'User.Read',
  'Files.Read',
  'Mail.Read',
  'Calendars.Read',
  'Sites.Read.All',
];

type MicrosoftTokenResponse = {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
};

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getMicrosoftAuthUrl(state: string, scopes = DEFAULT_SCOPES): string {
  const clientId = requireEnv(CLIENT_ID, 'MICROSOFT_CLIENT_ID');
  const redirectUri = requireEnv(REDIRECT_URI, 'MICROSOFT_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes.join(' '),
    state,
    prompt: 'consent',
  });

  return `${AUTH_BASE_URL}/authorize?${params.toString()}`;
}

export async function getMicrosoftTokens(code: string): Promise<MicrosoftTokenResponse> {
  const clientId = requireEnv(CLIENT_ID, 'MICROSOFT_CLIENT_ID');
  const clientSecret = requireEnv(
    CLIENT_SECRET,
    'MICROSOFT_CLIENT_SECRET'
  );
  const redirectUri = requireEnv(REDIRECT_URI, 'MICROSOFT_REDIRECT_URI');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(`${AUTH_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft token exchange failed: ${errorText}`);
  }

  return (await response.json()) as MicrosoftTokenResponse;
}

export async function refreshMicrosoftTokens(
  refreshToken: string
): Promise<MicrosoftTokenResponse> {
  const clientId = requireEnv(CLIENT_ID, 'MICROSOFT_CLIENT_ID');
  const clientSecret = requireEnv(
    CLIENT_SECRET,
    'MICROSOFT_CLIENT_SECRET'
  );
  const redirectUri = requireEnv(REDIRECT_URI, 'MICROSOFT_REDIRECT_URI');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    redirect_uri: redirectUri,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${AUTH_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft token refresh failed: ${errorText}`);
  }

  return (await response.json()) as MicrosoftTokenResponse;
}
