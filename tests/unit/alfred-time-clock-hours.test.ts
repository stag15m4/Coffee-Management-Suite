import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';
import { todayInTimeZone, addDaysToDateString } from '../../server/timeClockDailyHours';

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
      if (path === '/api/alfred/time-clock-hours') handler = h;
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

describe('GET /api/alfred/time-clock-hours — validation', () => {
  it('requires authentication', async () => {
    mocks.getApiAuth.mockResolvedValueOnce({ authenticated: false, tenantId: null, tenantForbidden: false });
    const res = await request();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized timezone', async () => {
    const res = await request({ timezone: 'Not/AZone' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects a malformed date', async () => {
    const res = await request({ date: '10-01-2026' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects start_date without end_date', async () => {
    const res = await request({ start_date: '2026-10-01' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects start_date after end_date', async () => {
    const res = await request({ start_date: '2026-10-05', end_date: '2026-10-01' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a range longer than 31 days', async () => {
    const res = await request({ start_date: '2026-01-01', end_date: '2026-03-01' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

describe('GET /api/alfred/time-clock-hours — defaults and shape', () => {
  it('defaults to yesterday in America/New_York when no date is given', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const res = await request();
    const expectedYesterday = addDaysToDateString(todayInTimeZone('America/New_York'), -1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: expectedYesterday,
        end_date: expectedYesterday,
        timezone: 'America/New_York',
      })
    );
  });

  it('respects an explicit single date and a custom timezone', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const res = await request({ date: '2026-10-01', timezone: 'America/Los_Angeles' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ start_date: '2026-10-01', end_date: '2026-10-01', timezone: 'America/Los_Angeles' })
    );
  });

  it('aggregates fetched entries into per-day, per-employee hours', async () => {
    mocks.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'e1',
            employee_key: 'emp-1',
            employee_name: 'Ava',
            clock_in: '2026-10-01T13:00:00Z', // 9am EDT
            clock_out: '2026-10-01T21:00:00Z', // 5pm EDT -> 8h gross
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            time_clock_entry_id: 'e1',
            break_start: '2026-10-01T17:00:00Z',
            break_end: '2026-10-01T17:30:00Z',
            is_paid: false,
          },
        ],
      });

    const res = await request({ date: '2026-10-01' });
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    const payload = res.json.mock.calls[0][0];
    expect(payload.days).toEqual([
      {
        date: '2026-10-01',
        total_hours: 7.5,
        employees: [{ employee_id: 'emp-1', employee_name: 'Ava', hours: 7.5 }],
      },
    ]);
  });

  it('skips the breaks query entirely when there are no entries', async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    const res = await request({ date: '2026-10-01' });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.days).toEqual([{ date: '2026-10-01', total_hours: 0, employees: [] }]);
  });
});
