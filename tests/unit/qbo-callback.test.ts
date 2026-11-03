import { describe, expect, it, vi } from 'vitest';
import OAuthClient from 'intuit-oauth';
import { safeQboCallbackUrl } from '../../server/qbo-callback';

const base = 'https://cms.example/api/qbo/oauth/callback';
const valid = base + '?code=a%2Bb%26c%3Dd&state=state-123&realmId=12345';

describe('QuickBooks callback decoder boundary', () => {
  it.each([
    valid + '&code=other',
    valid + '&%73tate=other',
    valid + '&realmId=other',
    base + '?code=x&state=s',
    base + '?code=&state=s&realmId=1',
    valid + '&unused=%zz',
    valid + '&unused=%C0%AF',
    valid + '&unused=' + '%C3'.repeat(3000),
    valid + '#fragment',
    base + '?code=%00&state=s&realmId=1',
  ])('rejects invalid callback input without echoing it', (url) => {
    expect(() => safeQboCallbackUrl(url)).toThrow('Invalid QuickBooks OAuth callback');
  });

  it('preserves encoded token values and discards unknown callback parameters', () => {
    const result = new URL(safeQboCallbackUrl(valid + '&redirectUri=https://attacker.example&extra=value'));
    expect(Object.fromEntries(result.searchParams)).toEqual({
      code: 'a+b&c=d',
      state: 'state-123',
      realmId: '12345',
    });
  });

  it('passes canonical values through the actual Intuit SDK without redirect override or network access', async () => {
    const client = new OAuthClient({
      clientId: 'test',
      clientSecret: 'test',
      environment: 'sandbox',
      redirectUri: base,
    });
    const response = { json: { access_token: 'fake', refresh_token: 'fake', expires_in: 3600 } };
    const request = vi.spyOn(client, 'getTokenRequest').mockResolvedValue(response as never);
    await client.createToken(safeQboCallbackUrl(valid + '&redirectUri=https://attacker.example'));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        data: { grant_type: 'authorization_code', code: 'a+b&c=d', redirect_uri: base },
      })
    );
    expect(client.getToken()).toMatchObject({ realmId: '12345', state: 'state-123' });
  });

  it('preserves literal percent sequences without a second decoding pass', () => {
    const result = new URL(safeQboCallbackUrl(base + '?code=%25zz&state=s&realmId=1'));
    expect(result.searchParams.get('code')).toBe('%zz');
  });
});
