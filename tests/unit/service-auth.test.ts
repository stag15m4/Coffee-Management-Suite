import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { timingSafeTokenMatch, parseAllowedTenantIds, resolveServiceTenant } from '../../server/service-auth-core';

const MY_TENANT = '11111111-1111-1111-1111-111111111111';
const MY_OTHER_TENANT = '22222222-2222-2222-2222-222222222222';
const SOMEONE_ELSES_TENANT = '99999999-9999-9999-9999-999999999999';

describe('timingSafeTokenMatch', () => {
  it('accepts a matching token', () => {
    expect(timingSafeTokenMatch('secret-123', 'secret-123')).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(timingSafeTokenMatch('wrong', 'secret-123')).toBe(false);
  });

  it('rejects when no secret is configured (inert)', () => {
    expect(timingSafeTokenMatch('anything', undefined)).toBe(false);
    expect(timingSafeTokenMatch('anything', '')).toBe(false);
  });

  it('rejects empty and non-string inputs', () => {
    expect(timingSafeTokenMatch('', 'secret-123')).toBe(false);
    expect(timingSafeTokenMatch(undefined, 'secret-123')).toBe(false);
    expect(timingSafeTokenMatch(['secret-123'], 'secret-123')).toBe(false);
  });
});

describe('parseAllowedTenantIds', () => {
  it('parses a comma-separated list with whitespace', () => {
    expect(parseAllowedTenantIds(` ${MY_TENANT}, ${MY_OTHER_TENANT} `)).toEqual([MY_TENANT, MY_OTHER_TENANT]);
  });

  it('returns empty for unset/empty env', () => {
    expect(parseAllowedTenantIds(undefined)).toEqual([]);
    expect(parseAllowedTenantIds('')).toEqual([]);
    expect(parseAllowedTenantIds(' , ,')).toEqual([]);
  });
});

describe('resolveServiceTenant (tenant scoping)', () => {
  it('allows a tenant_id that is in the allowlist', () => {
    const scope = resolveServiceTenant(MY_TENANT, [MY_TENANT, MY_OTHER_TENANT]);
    expect(scope).toEqual({ tenantId: MY_TENANT, forbidden: false });
  });

  it('REJECTS a tenant_id the token does not own', () => {
    const scope = resolveServiceTenant(SOMEONE_ELSES_TENANT, [MY_TENANT, MY_OTHER_TENANT]);
    expect(scope.forbidden).toBe(true);
    expect(scope.tenantId).toBeNull();
  });

  it('fails closed when the allowlist is empty (token grants nothing)', () => {
    const scope = resolveServiceTenant(MY_TENANT, []);
    expect(scope.forbidden).toBe(true);
    expect(scope.tenantId).toBeNull();
  });

  it('defaults to the sole allowed tenant when none requested', () => {
    const scope = resolveServiceTenant(undefined, [MY_TENANT]);
    expect(scope).toEqual({ tenantId: MY_TENANT, forbidden: false });
  });

  it('requires an explicit tenant_id when several are allowed', () => {
    const scope = resolveServiceTenant(undefined, [MY_TENANT, MY_OTHER_TENANT]);
    expect(scope).toEqual({ tenantId: null, forbidden: false });
  });
});

// ── End-to-end: getApiAuth with a real request shape ────────────────────────
// The service-token path of getApiAuth never touches the DB, so we can call it
// directly with a mock Express request. DATABASE_URL must be set before the
// module (which transitively imports server/db.ts) is loaded.

describe('getApiAuth (service token end-to-end)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
    process.env.ALFRED_SERVICE_TOKEN = 'test-service-token';
    process.env.ALFRED_ALLOWED_TENANT_IDS = `${MY_TENANT},${MY_OTHER_TENANT}`;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const makeReq = (token: string | undefined, tenantId?: string) =>
    ({
      headers: token !== undefined ? { 'x-alfred-token': token } : {},
      query: tenantId !== undefined ? { tenant_id: tenantId } : {},
    }) as any;

  it('authenticates and scopes to an owned tenant', async () => {
    const { getApiAuth } = await import('../../server/service-auth');
    const auth = await getApiAuth(makeReq('test-service-token', MY_TENANT));
    expect(auth.authenticated).toBe(true);
    expect(auth.isServiceToken).toBe(true);
    expect(auth.tenantForbidden).toBe(false);
    expect(auth.tenantId).toBe(MY_TENANT);
    expect(auth.allowedTenantIds).toEqual([MY_TENANT, MY_OTHER_TENANT]);
  });

  it('sets tenantForbidden for a tenant_id the token does not own (handler returns 403)', async () => {
    const { getApiAuth } = await import('../../server/service-auth');
    const auth = await getApiAuth(makeReq('test-service-token', SOMEONE_ELSES_TENANT));
    expect(auth.authenticated).toBe(true);
    expect(auth.tenantForbidden).toBe(true);
    expect(auth.tenantId).toBeNull();
  });

  it('rejects a wrong token outright (no fallthrough to session auth)', async () => {
    const { getApiAuth } = await import('../../server/service-auth');
    const auth = await getApiAuth(makeReq('wrong-token', MY_TENANT));
    expect(auth.authenticated).toBe(false);
    expect(auth.tenantId).toBeNull();
  });

  it('fails closed when ALFRED_ALLOWED_TENANT_IDS is unset', async () => {
    delete process.env.ALFRED_ALLOWED_TENANT_IDS;
    const { getApiAuth } = await import('../../server/service-auth');
    const auth = await getApiAuth(makeReq('test-service-token', MY_TENANT));
    expect(auth.authenticated).toBe(false);
    expect(auth.tenantForbidden).toBe(true);
  });
});
