const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/api/integrations/callback/slack';

const AUTH_BASE_URL = 'https://slack.com/oauth/v2';

const DEFAULT_SCOPES = [
  'channels:read',
  'groups:read',
  'im:read',
  'mpim:read',
  'users:read',
  'team:read',
];

const DEFAULT_USER_SCOPES = ['openid', 'profile', 'email'];

type SlackTokenResponse = {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id: string; name: string };
  enterprise?: { id: string; name: string };
  authed_user?: {
    id?: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSlackAuthUrl(
  state: string,
  scopes = DEFAULT_SCOPES,
  userScopes = DEFAULT_USER_SCOPES
): string {
  const clientId = requireEnv(CLIENT_ID, 'SLACK_CLIENT_ID');
  const redirectUri = requireEnv(REDIRECT_URI, 'SLACK_REDIRECT_URI');

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes.join(','),
    user_scope: userScopes.join(','),
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  return `${AUTH_BASE_URL}/authorize?${params.toString()}`;
}

export async function getSlackTokens(code: string): Promise<SlackTokenResponse> {
  const clientId = requireEnv(CLIENT_ID, 'SLACK_CLIENT_ID');
  const clientSecret = requireEnv(CLIENT_SECRET, 'SLACK_CLIENT_SECRET');
  const redirectUri = requireEnv(REDIRECT_URI, 'SLACK_REDIRECT_URI');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(`${AUTH_BASE_URL}/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slack token exchange failed: ${errorText}`);
  }

  const data = (await response.json()) as SlackTokenResponse;

  if (!data.ok) {
    throw new Error(`Slack token exchange failed: ${data.error || 'unknown_error'}`);
  }

  return data;
}
