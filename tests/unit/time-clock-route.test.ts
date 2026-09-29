import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({ identity: vi.fn(), close: vi.fn(), log: vi.fn() }));
vi.mock('../../server/routes/core', () => ({ getUserIdFromRequest: mocks.identity }));
vi.mock('../../server/timeClockService', () => ({
  ClockEntryNotOpenError: class ClockEntryNotOpenError extends Error {},
  closeClockEntry: mocks.close,
}));
vi.mock('../../server/logger', () => ({ default: { error: mocks.log } }));
import { ClockEntryNotOpenError } from '../../server/timeClockService';
import { registerTimeClockRoutes } from '../../server/routes/time-clock';

const tenantId = '11111111-1111-1111-1111-111111111111';
const entryId = '22222222-2222-2222-2222-222222222222';
let handler: (req: Request, res: Response) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ userId: '33333333-3333-3333-3333-333333333333' });
  mocks.close.mockResolvedValue({ id: entryId, clock_out: new Date('2026-09-29T13:00:00Z') });
  registerTimeClockRoutes({
    post: (_path: string, callback: typeof handler) => {
      handler = callback;
    },
  } as unknown as Express);
});

async function request(body: unknown) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await handler({ body } as Request, res as unknown as Response);
  return res;
}

describe('authenticated clock-out route', () => {
  it('requires a verified user before any database update', async () => {
    mocks.identity.mockResolvedValue({ userId: null });
    const res = await request({ tenantId, entryId });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('rejects malformed identifiers', async () => {
    const res = await request({ tenantId, entryId: 'not-an-id' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('uses the verified user ID and never enables tip employee access', async () => {
    const res = await request({ tenantId, entryId, notes: 'Shift ended' });
    expect(mocks.close).toHaveBeenCalledWith(
      tenantId,
      '33333333-3333-3333-3333-333333333333',
      entryId,
      false,
      'Shift ended'
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: entryId }));
  });

  it('returns a conflict for an already closed or unauthorized entry', async () => {
    mocks.close.mockRejectedValue(new ClockEntryNotOpenError());
    const res = await request({ tenantId, entryId });
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
