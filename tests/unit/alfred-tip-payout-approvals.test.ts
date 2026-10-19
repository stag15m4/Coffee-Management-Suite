import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), getApiAuth: vi.fn(), log: vi.fn() }));
vi.mock('../../server/db', () => ({ db: { execute: mocks.execute } }));
vi.mock('../../server/service-auth', () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock('../../server/logger', () => ({ default: { info: mocks.log, error: mocks.log, warn: mocks.log } }));

process.env.ALFRED_SERVICE_TOKEN = 'test-token';

import { registerAlfredRoutes } from '../../server/routes/alfred';

const tenant = '00000000-0000-0000-0000-000000000001';

let handler: (req: Request, res: Response) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockReset();
  mocks.getApiAuth.mockResolvedValue({ authenticated: true, tenantId: tenant, tenantForbidden: false });
  const app = {
    get: (path: string, h: typeof handler) => {
      if (path === '/api/alfred/tip-payout-approvals') handler = h;
    },
    post: () => {},
  } as unknown as Express;
  registerAlfredRoutes(app);
});

async function request(query: Record<string, string> = {}) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ query } as unknown as Request, res as unknown as Response);
  return res;
}

describe('GET /api/alfred/tip-payout-approvals — validation', () => {
  it('requires authentication', async () => {
    mocks.getApiAuth.mockResolvedValueOnce({ authenticated: false, tenantId: null, tenantForbidden: false });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('403s when the token is not authorized for the requested tenant', async () => {
    mocks.getApiAuth.mockResolvedValueOnce({ authenticated: true, tenantId: null, tenantForbidden: true });
    const res = await request({ tenant_id: 'some-other-tenant' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('400s when no tenant can be resolved', async () => {
    mocks.getApiAuth.mockResolvedValueOnce({ authenticated: true, tenantId: null, tenantForbidden: false });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects a malformed start_date', async () => {
    const res = await request({ start_date: '10-01-2026' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects start_date after end_date', async () => {
    const res = await request({ start_date: '2026-10-05', end_date: '2026-10-01' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

describe('GET /api/alfred/tip-payout-approvals — shape', () => {
  it('returns an empty payout list with no rows', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    const res = await request();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: tenant, count: 0, has_more: false, next_offset: null, payouts: [] })
    );
  });

  it('maps an approved snapshot row into the response shape', async () => {
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          week_key: '2026-10-06',
          cash_tips: '200.00',
          cc_tips: '150.00',
          cc_fee_rate: '0.0350',
          total_pool: '344.75',
          total_hours: '40.00',
          hourly_rate: '8.6188',
          distribution_method: 'hours',
          approved_at: '2026-10-08T12:00:00Z',
          employee_payouts: [
            { employee_id: 'emp-1', employee_name: 'Ava', hours: 20, payout: 172.38 },
            { employee_id: 'emp-2', employee_name: 'Beau', hours: 20, payout: 172.37 },
          ],
        },
      ],
    });

    const res = await request({ tenant_id: tenant });
    const payload = res.json.mock.calls[0][0];
    expect(payload.payouts).toEqual([
      {
        week_key: '2026-10-06',
        status: 'approved',
        cash_tips: 200,
        cc_tips: 150,
        cc_fee_rate: 0.035,
        total_pool: 344.75,
        total_hours: 40,
        hourly_rate: 8.6188,
        distribution_method: 'hours',
        approved_at: '2026-10-08T12:00:00Z',
        employees: [
          { employee_id: 'emp-1', employee_name: 'Ava', hours: 20, payout: 172.38 },
          { employee_id: 'emp-2', employee_name: 'Beau', hours: 20, payout: 172.37 },
        ],
      },
    ]);
  });

  it('reports has_more and next_offset when a fuller page than requested comes back', async () => {
    mocks.execute.mockResolvedValueOnce({
      rows: [
        { week_key: '2026-10-06', cash_tips: '1', cc_tips: '1', cc_fee_rate: '0.035', total_pool: '1', total_hours: '1', hourly_rate: '1', distribution_method: 'hours', approved_at: null, employee_payouts: [] },
        { week_key: '2026-09-29', cash_tips: '1', cc_tips: '1', cc_fee_rate: '0.035', total_pool: '1', total_hours: '1', hourly_rate: '1', distribution_method: 'hours', approved_at: null, employee_payouts: [] },
      ],
    });

    const res = await request({ limit: '1' });
    const payload = res.json.mock.calls[0][0];
    expect(payload.count).toBe(1);
    expect(payload.has_more).toBe(true);
    expect(payload.next_offset).toBe(1);
  });
});
