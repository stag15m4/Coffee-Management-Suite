import { PGlite } from '@electric-sql/pglite';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';
const mocks = vi.hoisted(() => ({ execute: vi.fn(), identity: vi.fn(), audit: vi.fn(), log: vi.fn() }));
vi.mock('../../server/db', () => ({ db: { execute: mocks.execute } }));
vi.mock('../../server/routes/core', () => ({ getUserIdFromRequest: mocks.identity, logAuditEvent: mocks.audit }));
vi.mock('../../server/logger', () => ({ default: { info: mocks.log, error: mocks.log } }));
import { registerTipRoutes } from '../../server/routes/tips';
const tenant = '00000000-0000-0000-0000-000000000001';
const manager = '00000000-0000-0000-0000-000000000002';
const a = '00000000-0000-0000-0000-000000000003';
const b = '00000000-0000-0000-0000-000000000004';
let approve: (req: Request, res: Response) => Promise<unknown>;
let mine: (req: Request, res: Response) => Promise<unknown>;
const body = {
  tenantId: tenant,
  weekKey: '2026-09-28',
  distributionMethod: 'hours',
  cashTips: 100,
  ccTips: 0,
  totalPool: 100,
  totalHours: 20,
  hourlyRate: 5,
  employees: [
    { employee_id: a, employee_name: 'A', hours: 10, payout: 50 },
    { employee_id: b, employee_name: 'B', hours: 10, payout: 50 },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockReset();
  mocks.identity.mockResolvedValue({ userId: manager });
  mocks.audit.mockResolvedValue(undefined);
  mocks.execute
    .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'manager' }] })
    .mockResolvedValueOnce({ rows: [{ id: tenant }] })
    .mockResolvedValueOnce({ rows: [{ cash_tips: '100', cc_tips: '0' }] })
    .mockResolvedValueOnce({
      rows: [
        { employee_id: a, hours: '10', name: 'A' },
        { employee_id: b, hours: '10', name: 'B' },
      ],
    })
    .mockResolvedValueOnce({ rows: [{ id: a, approved_at: '2026-09-29T00:00:00Z' }] });
  registerTipRoutes({
    post: (path: string, handler: typeof approve) => {
      if (path.endsWith('/approve')) approve = handler;
    },
    get: (path: string, handler: typeof mine) => {
      if (path.endsWith('/mine')) mine = handler;
    },
  } as unknown as Express);
});
async function request(handler: typeof approve, payload = body, query: Record<string, string> = {}) {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ body: payload, query, ip: 'test' } as unknown as Request, res as unknown as Response);
  return res;
}
describe('approved tip publication', () => {
  it('rejects a payout changed in the browser before writing an approval', async () => {
    const altered = { ...body, employees: [{ ...body.employees[0], payout: 60 }, body.employees[1]] };
    expect((await request(approve, altered)).status).toHaveBeenCalledWith(409);
    expect(mocks.execute).toHaveBeenCalledTimes(4);
  });
  it('stores server verified payouts and permits a valid approval', async () => {
    const res = await request(approve);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mocks.execute).toHaveBeenCalledTimes(5);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("never accepts an anonymous request for another employee's payouts", async () => {
    mocks.identity.mockResolvedValueOnce({ userId: null });
    const res = await request(mine);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

describe('GET /api/tip-payouts/mine date-range search', () => {
  beforeEach(() => {
    mocks.identity.mockResolvedValue({ userId: manager });
  });
  it('returns results with no start/end (the dashboard card default)', async () => {
    mocks.execute.mockReset().mockResolvedValueOnce({ rows: [{ week_key: '2026-09-28', hours: '10', payout: '50' }] });
    const res = await request(mine, body, {});
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ payouts: [{ week_key: '2026-09-28', hours: '10', payout: '50' }] });
  });
  it('accepts a valid start/end search range', async () => {
    mocks.execute.mockReset().mockResolvedValueOnce({ rows: [] });
    const res = await request(mine, body, { start: '2026-01-01', end: '2026-01-31' });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ payouts: [] });
  });
  it('rejects a malformed date instead of passing it to the query', async () => {
    mocks.execute.mockReset();
    const res = await request(mine, body, { start: 'not-a-date' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

describe('atomic approval persistence', () => {
  it('rolls back a failed audit, allows retry, and does not duplicate an approved week', async () => {
    // Capture the real parameterized statement emitted by the route.
    await request(approve);
    const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[4][0]);
    const database = new PGlite();
    try {
      await database.exec(`
        CREATE TABLE tip_payout_approvals (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, week_key date,
          cash_tips numeric, cc_tips numeric, cc_fee_rate numeric, total_pool numeric,
          total_hours numeric, hourly_rate numeric, distribution_method text,
          employee_payouts jsonb, calculated_by uuid, calculated_at timestamptz,
          approved_by uuid, approved_at timestamptz, status text, updated_at timestamptz,
          UNIQUE(tenant_id, week_key)
        );
        CREATE TABLE audit_logs (
          tenant_id uuid, actor_id uuid, action text, resource_type text, resource_id uuid,
          old_value jsonb, new_value jsonb, ip_address text,
          CONSTRAINT unavailable CHECK (false)
        );
      `);
      await expect(database.query(query.sql, query.params)).rejects.toThrow();
      expect((await database.query('SELECT * FROM tip_payout_approvals')).rows).toHaveLength(0);
      await database.exec('ALTER TABLE audit_logs DROP CONSTRAINT unavailable');
      expect((await database.query(query.sql, query.params)).rows).toHaveLength(1);
      const events = await database.query('SELECT * FROM audit_logs');
      expect(events.rows).toHaveLength(1);
      expect(events.rows[0]).toMatchObject({
        tenant_id: tenant,
        actor_id: manager,
        action: 'tip_payout.approved',
        new_value: { weekKey: body.weekKey, totalPool: 100, employeeCount: 2, distributionMethod: 'hours' },
      });
      expect((await database.query(query.sql, query.params)).rows).toHaveLength(0);
      expect((await database.query('SELECT * FROM audit_logs')).rows).toHaveLength(1);
      await database.exec("UPDATE tip_payout_approvals SET status='rejected'");
      await database.exec('ALTER TABLE audit_logs ADD CONSTRAINT unavailable CHECK (false) NOT VALID');
      await expect(database.query(query.sql, query.params)).rejects.toThrow();
      expect((await database.query('SELECT status FROM tip_payout_approvals')).rows[0]).toEqual({ status: 'rejected' });
    } finally {
      await database.close();
    }
  }, 30000);
});
