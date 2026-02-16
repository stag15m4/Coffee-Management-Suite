import { SquareClient, SquareEnvironment } from 'square';

export function getSquareAppId(): string {
  const appId = process.env.SQUARE_APP_ID;
  if (!appId) {
    throw new Error('SQUARE_APP_ID environment variable is not set');
  }
  return appId;
}

export function getSquareAppSecret(): string {
  const secret = process.env.SQUARE_APP_SECRET;
  if (!secret) {
    throw new Error('SQUARE_APP_SECRET environment variable is not set');
  }
  return secret;
}

export function getSquareWebhookSignatureKey(): string {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) {
    throw new Error('SQUARE_WEBHOOK_SIGNATURE_KEY environment variable is not set');
  }
  return key;
}

function getSquareEnvironment(): SquareEnvironment {
  const env = process.env.SQUARE_ENVIRONMENT;
  if (env === 'production') {
    return SquareEnvironment.Production;
  }
  return SquareEnvironment.Sandbox;
}

/**
 * Creates a Square client using a tenant's OAuth access token.
 * Use this for all per-tenant API calls (labor, team members, locations).
 */
export function getSquareClient(accessToken: string): SquareClient {
  return new SquareClient({
    token: accessToken,
    environment: getSquareEnvironment(),
  });
}

/**
 * Creates a Square client using app-level credentials.
 * Use this only for the OAuth token exchange flow (obtainToken).
 */
export function getSquareAppClient(): SquareClient {
  return new SquareClient({
    environment: getSquareEnvironment(),
  });
}

/**
 * Returns the Square OAuth authorization URL for a tenant to connect their account.
 */
export function getSquareOAuthUrl(tenantId: string, redirectUri: string): string {
  const baseUrl = getSquareEnvironment() === SquareEnvironment.Production
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  const params = new URLSearchParams({
    client_id: getSquareAppId(),
    response_type: 'code',
    scope: 'TIMECARDS_READ TIMECARDS_SETTINGS_READ EMPLOYEES_READ MERCHANT_PROFILE_READ',
    state: tenantId,
    redirect_uri: redirectUri,
  });

  return `${baseUrl}/oauth2/authorize?${params.toString()}`;
}
