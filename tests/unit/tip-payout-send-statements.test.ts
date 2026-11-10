import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  identity: vi.fn(),
  audit: vi.fn(),
  log: vi.fn(),
  sendStatement: vi.fn(),
}));
vi.mock('../../server/db', () => ({ db: { execute: mocks.execute } }));
vi.mock('../../server/routes/core', () => ({ getUserIdFromRequest: mocks.identity, logAuditEvent: mocks.audit }));
vi.mock('../../server/logger', () => ({ default: { info: mocks.log, error: mocks.log } }));
vi.mock('../../server/resend', () => ({ sendTipPayoutStatementEmail: mocks.sendStatement }));

import { registerTipRoutes } from '../../server/routes/tips';

const tenant = '00000000-0000-0000-0000-000000000001';
const manager = '00000000-0000-0000-0000-000000000002';
const a = '00000000-0000-0000-0000-000000000003';
const b = '00000000-0000-0000-0000-000000000004';

let sendStatements: (req: Request, res: Response) => Promise<unknown>;

const body = { tenantId: tenant, weekKey: '2026-09-28', companyName: 'Erwin Mills Coffee' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockReset();
  mocks.identity.mockResolvedValue({ userId: manager });
  mocks.audit.mockResolvedValue(undefined);
  mocks.sendStatement.mockResolvedValue({ success: true });

  registerTipRoutes({
    post: (path: string, handler: typeof sendStatements) => {
      if (path.endsWith('/send-statements')) sendStatements = handler;
    },
    get: () => {},
  } as unknown as Express);
});

async function request(payload: Record<string, unknown> = body) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await sendStatements({ body: payload, ip: 'test' } as unknown as Request, res as unknown as Response);
  return res;
}

describe('POST /api/tip-payouts/send-statements — auth and validation', () => {
  it('requires authentication', async () => {
    mocks.identity.mockResolvedValueOnce({ userId: null });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('requires an active profile', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('requires tenant authorization', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects a non-manager, non-owner role', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'employee' }] })
      .mockResolvedValueOnce({ rows: [{ id: tenant }] });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('400s when the week has not been approved', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [{ id: tenant }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.sendStatement).not.toHaveBeenCalled();
  });

  it('400s when the week was rejected rather than approved', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [{ id: tenant }] })
      .mockResolvedValueOnce({ rows: [{ status: 'rejected', employee_payouts: [] }] });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('POST /api/tip-payouts/send-statements — sending', () => {
  it('sends to employees with an email on file and skips those without', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [{ id: tenant }] })
      .mockResolvedValueOnce({
        rows: [
          {
            status: 'approved',
            employee_payouts: [
              { employee_id: a, employee_name: 'Ava', hours: 20, payout: 172.38 },
              { employee_id: b, employee_name: 'Beau', hours: 20, payout: 172.37 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: a, email: 'ava@example.com' }] }); // Beau has no row -> no email

    const res = await request();
    expect(mocks.sendStatement).toHaveBeenCalledTimes(1);
    expect(mocks.sendStatement).toHaveBeenCalledWith(
      expect.objectContaining({ employeeEmail: 'ava@example.com', employeeName: 'Ava', hours: 20, payout: 172.38 })
    );
    expect(res.json).toHaveBeenCalledWith({
      sent: 1,
      skipped: [{ employee_id: b, employee_name: 'Beau', reason: 'No email on file' }],
      failed: [],
    });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it('reports a failed send without blocking the others', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'owner' }] })
      .mockResolvedValueOnce({ rows: [{ id: tenant }] })
      .mockResolvedValueOnce({
        rows: [
          { status: 'approved', employee_payouts: [{ employee_id: a, employee_name: 'Ava', hours: 10, payout: 50 }] },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: a, email: 'ava@example.com' }] });
    mocks.sendStatement.mockResolvedValueOnce({ success: false, error: 'Resend API error' });

    const res = await request();
    expect(res.json).toHaveBeenCalledWith({
      sent: 0,
      skipped: [],
      failed: [{ employee_id: a, employee_name: 'Ava', reason: 'Resend API error' }],
    });
  });

  it('returns immediately with nothing to send when the approval has no employees', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ tenant_id: tenant, role: 'manager' }] })
      .mockResolvedValueOnce({ rows: [{ id: tenant }] })
      .mockResolvedValueOnce({ rows: [{ status: 'approved', employee_payouts: [] }] });

    const res = await request();
    expect(res.json).toHaveBeenCalledWith({ sent: 0, skipped: [], failed: [] });
    expect(mocks.sendStatement).not.toHaveBeenCalled();
  });
});
