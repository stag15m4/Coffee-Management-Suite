import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  from: vi.fn(),
  caller: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('../../server/routes/core', () => ({ getUserIdFromRequest: mocks.identity }));
vi.mock('../../server/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
  getSupabaseForUser: mocks.caller,
}));
vi.mock('../../server/logger', () => ({ default: { error: vi.fn(), warn: vi.fn() } }));
import { registerAuthBootstrapRoutes } from '../../server/routes/auth-bootstrap';

let handler: (req: Request, res: Response) => Promise<unknown>;
let adminData: object | null;
let adminError: object | null;

beforeEach(() => {
  vi.clearAllMocks();
  adminData = { id: 'user-1', is_active: true };
  adminError = null;
  mocks.identity.mockResolvedValue({ userId: 'user-1' });
  mocks.caller.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: ['financial-budget', 'calendar-workforce'], error: null });
  mocks.from.mockImplementation((table: string) => {
    const data =
      table === 'platform_admins'
        ? adminData
        : table === 'user_profiles'
          ? { id: 'user-1', tenant_id: 'tenant-1', role: 'manager' }
          : table === 'tenants'
            ? { id: 'tenant-1', is_active: true }
            : table === 'user_tenant_assignments' || table === 'tenant_role_settings'
              ? []
              : null;
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      order: vi.fn(),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data, error: table === 'platform_admins' ? adminError : null }).then(resolve),
    };
    for (const method of [query.select, query.eq, query.maybeSingle, query.order]) method.mockReturnValue(query);
    return query;
  });
  registerAuthBootstrapRoutes({
    get: (_path: string, callback: typeof handler) => {
      handler = callback;
    },
  } as unknown as Express);
});

async function bootstrap() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ headers: { authorization: 'Bearer user-token' }, query: {} } as Request, res as unknown as Response);
  return res;
}

describe('auth bootstrap access', () => {
  it('preserves platform admin status alongside a store profile and caller-scoped modules', async () => {
    const res = await bootstrap();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ id: 'user-1' }),
        platformAdmin: adminData,
        enabledModules: ['financial-budget', 'calendar-workforce'],
      })
    );
    expect(mocks.caller).toHaveBeenCalledWith('user-token');
    expect(mocks.rpc).toHaveBeenCalledWith('get_tenant_enabled_modules', { p_tenant_id: 'tenant-1' });
  });

  it('does not grant admin status or internal modules to an ordinary user', async () => {
    adminData = null;
    mocks.rpc.mockResolvedValue({ data: ['tip-payout'], error: null });
    const res = await bootstrap();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ platformAdmin: null, enabledModules: ['tip-payout'] })
    );
  });

  it('reports an admin lookup failure instead of silently stripping access', async () => {
    adminError = { message: 'lookup failed' };
    const res = await bootstrap();
    expect(res.status).toHaveBeenCalledWith(502);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers before loading access', async () => {
    mocks.identity.mockResolvedValue({ userId: null });
    const res = await bootstrap();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
