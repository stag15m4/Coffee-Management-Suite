import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  identity: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
}));
vi.mock('../../server/db', () => ({ db: { execute: mocks.execute, transaction: mocks.transaction } }));
vi.mock('../../server/routes/core', () => ({
  getUserIdFromRequest: mocks.identity,
  kioskVerifyRateLimit: vi.fn(),
  enforceMapLimit: vi.fn(),
}));
vi.mock('bcrypt', () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
import { registerKioskRoutes, kioskSessions, kioskRateLimit, pinLockout } from '../../server/routes/kiosk';
const tenant = '00000000-0000-0000-0000-000000000100',
  profile = '00000000-0000-0000-0000-000000000001',
  tip = '00000000-0000-0000-0000-000000000002';
let handlers: Map<string, (req: Request, res: Response) => Promise<unknown>>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  kioskSessions.clear();
  kioskRateLimit.clear();
  pinLockout.clear();
  mocks.execute.mockResolvedValue({ rows: [] });
  mocks.compare.mockResolvedValue(true);
  mocks.hash.mockResolvedValue('$2b$hash');
  mocks.identity.mockResolvedValue({ userId: profile });
  mocks.transaction.mockImplementation((fn) => fn({ execute: mocks.execute }));
  handlers = new Map();
  registerKioskRoutes({
    post: (path: string, ...args: unknown[]) => handlers.set(path, args.at(-1) as never),
    get: vi.fn(),
  } as unknown as Express);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
async function request(path: string, body: unknown) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await handlers.get(path)!({ body, ip: 'test' } as Request, res as unknown as Response);
  return res;
}
describe('linked roster kiosk identity', () => {
  it('uses the linked profile for kiosk tokens and active-session lookup while preserving the roster PIN', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: tip,
            name: 'Roster Name',
            user_profile_id: profile,
            linked_name: 'Profile Name',
            linked_role: 'employee',
            kiosk_pin: '$2b$pin',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'session', clock_in: '2026-09-29T08:00Z' }] });
    const res = await request('/api/kiosk/punch', { tenantId: tenant, pin: '1234' });
    const output = res.json.mock.calls[0][0];
    expect(output.employee).toMatchObject({ id: profile, source: 'user_profile', fullName: 'Profile Name' });
    expect(output.status).toBe('clocked_in');
    expect(kioskSessions.get(output.kioskToken)?.employeeId).toBe(profile);
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[2][0]);
    expect(query.params).toContain(profile);
    expect(query.sql).toContain('tce.employee_id');
  });
  it('keeps an old roster-only open shift reachable until it can be closed or explicitly linked', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: tip,
            name: 'Name',
            user_profile_id: profile,
            linked_role: 'employee',
            legacy_open: true,
            kiosk_pin: '$2b$pin',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'old-shift', clock_in: '2026-09-29T08:00Z' }] });
    const res = await request('/api/kiosk/punch', { tenantId: tenant, pin: '1234' });
    expect(res.json.mock.calls[0][0]).toMatchObject({
      employee: { id: tip, source: 'tip_employee' },
      status: 'clocked_in',
      activeEntryId: 'old-shift',
    });
  });
  it('upgrades a legacy linked roster PIN on the roster row, not on the profile ID', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ id: tip, name: 'Name', user_profile_id: profile, linked_role: 'employee', kiosk_pin: '1234' }],
    });
    await request('/api/kiosk/punch', { tenantId: tenant, pin: '1234' });
    const upgrade = new PgDialect().sqlToQuery(mocks.execute.mock.calls[2][0]);
    expect(upgrade.sql).toContain('UPDATE tip_employees');
    expect(upgrade.params).toContain(tip);
    expect(upgrade.params).not.toContain(profile);
  });
  it('checks linked profile activity before allowing a roster PIN to sign in', async () => {
    const res = await request('/api/kiosk/punch', { tenantId: tenant, pin: '1234' });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]).sql).toContain('up.is_active=true');
  });
  it('checks other tip-roster PINs before assigning a profile PIN', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [{ id: tip, kiosk_pin: '1234' }] });
    const res = await request('/api/kiosk/update-pin', { tenantId: tenant, userId: profile, newPin: '1234' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('clears the old linked roster PIN when a new profile PIN is saved', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: profile }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request('/api/kiosk/update-pin', { tenantId: tenant, userId: profile, newPin: '9876' });
    expect(res.json).toHaveBeenCalledWith({ success: true });
    const cleared = new PgDialect().sqlToQuery(mocks.execute.mock.calls[3][0]);
    expect(cleared.sql).toContain('UPDATE tip_employees SET kiosk_pin=NULL');
    expect(cleared.params).toEqual([profile, tenant]);
  });
});
