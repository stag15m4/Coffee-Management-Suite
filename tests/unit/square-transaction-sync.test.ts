import { beforeEach, describe, expect, it, vi } from 'vitest';

// Renders a drizzle `sql` tagged-template object back into plain text for
// assertions — its queryChunks array interleaves {value:[str]} literal
// chunks with raw interpolated values.
function renderSql(sqlObj: any): string {
  return (sqlObj.queryChunks ?? [])
    .map((c: any) => (c && typeof c === 'object' && 'value' in c ? c.value.join('') : String(c)))
    .join('');
}

// Verifies the Square -> cash_activity.transaction_count sync: it must only
// ever UPDATE an existing cash_activity row, never INSERT one (an inserted
// row would default gross_revenue to 0 and silently corrupt the average
// daily revenue used elsewhere in the app), and it must correctly bucket
// orders into local calendar days using the Square location's own timezone.

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  ordersSearch: vi.fn(),
  locationsGet: vi.fn(),
  log: vi.fn(),
}));

vi.mock('../../server/db', () => ({ db: { execute: mocks.execute } }));
vi.mock('../../server/index', () => ({ log: mocks.log }));
vi.mock('../../server/squareClient', () => ({
  getSquareClient: () => ({
    locations: { get: mocks.locationsGet },
    orders: { search: mocks.ordersSearch },
  }),
  getSquareAppClient: vi.fn(),
  getSquareAppId: vi.fn(() => 'test-app-id'),
  getSquareAppSecret: vi.fn(() => 'test-app-secret'),
}));

import { squareService } from '../../server/squareService';

const tenantId = '00000000-0000-0000-0000-000000000001';

function tenantConfigRow(overrides: Record<string, unknown> = {}) {
  return {
    rows: [
      {
        id: tenantId,
        square_merchant_id: 'merchant-1',
        square_access_token: 'plain-access-token', // no colons -> safeDecrypt returns as-is
        square_refresh_token: 'plain-refresh-token',
        square_token_expires_at: null, // null -> getAuthenticatedClient skips the refresh branch
        square_location_id: 'loc-1',
        square_sync_enabled: true,
        square_last_sync_at: null,
        square_transactions_last_sync_at: null,
        square_transactions_sync_watermark: null,
        ...overrides,
      },
    ],
  };
}

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.ordersSearch.mockReset();
  mocks.locationsGet.mockReset();
  mocks.log.mockReset();
  mocks.locationsGet.mockResolvedValue({ location: { timezone: 'America/New_York' } });
});

describe('syncTransactionCountsForTenant', () => {
  it('only UPDATEs existing cash_activity rows, never INSERTs, and reports skipped days', async () => {
    mocks.execute
      .mockResolvedValueOnce(tenantConfigRow()) // getAuthenticatedClient -> getTenantSquareConfig
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE for the single day in range — row exists
      .mockResolvedValueOnce({ rowCount: undefined }); // UPDATE tenants (last-sync marker)

    mocks.ordersSearch.mockResolvedValueOnce({ orders: [], cursor: undefined });

    const result = await squareService.syncTransactionCountsForTenant(tenantId, {
      startDate: '2026-10-01',
      endDate: '2026-10-01',
    });

    expect(result).toEqual({ daysUpdated: 1, daysSkippedNoRow: 0, ordersSeen: 0 });

    // The UPDATE must target cash_activity, never INSERT INTO cash_activity.
    const updateSql = renderSql(mocks.execute.mock.calls[1][0]);
    expect(updateSql).toMatch(/UPDATE\s+cash_activity/i);
    expect(updateSql).not.toMatch(/INSERT/i);
  });

  it('counts a day with no existing cash_activity row as skipped, not updated', async () => {
    mocks.execute
      .mockResolvedValueOnce(tenantConfigRow())
      .mockResolvedValueOnce({ rowCount: 0 }) // no row for this tenant+date
      .mockResolvedValueOnce({ rowCount: undefined });

    mocks.ordersSearch.mockResolvedValueOnce({ orders: [], cursor: undefined });

    const result = await squareService.syncTransactionCountsForTenant(tenantId, {
      startDate: '2026-10-01',
      endDate: '2026-10-01',
    });

    expect(result).toEqual({ daysUpdated: 0, daysSkippedNoRow: 1, ordersSeen: 0 });
  });

  it('buckets completed orders by local calendar day in the location timezone, including a zero-order day', async () => {
    mocks.locationsGet.mockResolvedValue({ location: { timezone: 'America/New_York' } });
    mocks.execute
      .mockResolvedValueOnce(tenantConfigRow())
      .mockResolvedValueOnce({ rowCount: 1 }) // 2026-10-01: 2 orders
      .mockResolvedValueOnce({ rowCount: 1 }) // 2026-10-02: 0 orders
      .mockResolvedValueOnce({ rowCount: undefined });

    // 11pm EDT on 10/1 is still 10/1 local even though it's past midnight UTC.
    mocks.ordersSearch.mockResolvedValueOnce({
      orders: [{ closedAt: '2026-10-01T15:00:00Z' }, { closedAt: '2026-10-02T02:30:00Z' }],
      cursor: undefined,
    });

    const result = await squareService.syncTransactionCountsForTenant(tenantId, {
      startDate: '2026-10-01',
      endDate: '2026-10-02',
    });

    expect(result.ordersSeen).toBe(2);
    expect(result.daysUpdated).toBe(2);

    // 2 orders on 10/1 local, 0 on 10/2 local.
    expect(mocks.execute.mock.calls[1][0].queryChunks).toContain(2);
    expect(mocks.execute.mock.calls[2][0].queryChunks).toContain(0);
  });

  it('uses a 60-day backfill window on first sync (no watermark yet)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T18:00:00Z'));
    try {
      mocks.execute.mockResolvedValueOnce(tenantConfigRow({ square_transactions_sync_watermark: null }));
      mocks.ordersSearch.mockResolvedValueOnce({ orders: [], cursor: undefined });
      // Stub out the per-day UPDATE loop + final tenant UPDATE with a catch-all.
      mocks.execute.mockResolvedValue({ rowCount: 0 });

      await squareService.syncTransactionCountsForTenant(tenantId, { endDate: '2026-10-08' });

      const searchArgs = mocks.ordersSearch.mock.calls[0][0];
      const startAt = new Date(searchArgs.query.filter.dateTimeFilter.closedAt.startAt);
      const endAt = new Date(searchArgs.query.filter.dateTimeFilter.closedAt.endAt);
      const spanDays = (endAt.getTime() - startAt.getTime()) / (24 * 3600 * 1000);
      // "now" (2026-10-08) minus 60 days lands on 2026-08-09; the window runs
      // from that local midnight through the day after endDate's local
      // midnight — 61 calendar days.
      expect(spanDays).toBe(61);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws when Square is not fully configured (no location set)', async () => {
    mocks.execute.mockResolvedValueOnce(tenantConfigRow({ square_location_id: null }));
    await expect(squareService.syncTransactionCountsForTenant(tenantId)).rejects.toThrow('Square not fully configured');
  });

  it('aborts rather than guessing a timezone when the location lookup fails', async () => {
    mocks.execute.mockResolvedValueOnce(tenantConfigRow());
    mocks.locationsGet.mockRejectedValueOnce(new Error('Square API unavailable'));

    await expect(
      squareService.syncTransactionCountsForTenant(tenantId, { startDate: '2026-10-01', endDate: '2026-10-01' })
    ).rejects.toThrow('Square API unavailable');

    // Never reached the order search or any cash_activity/tenant write —
    // a transient failure here must not corrupt or mark anything synced.
    expect(mocks.ordersSearch).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('aborts when the location has no timezone set, rather than defaulting to one', async () => {
    mocks.execute.mockResolvedValueOnce(tenantConfigRow());
    mocks.locationsGet.mockResolvedValueOnce({ location: { timezone: undefined } });

    await expect(squareService.syncTransactionCountsForTenant(tenantId)).rejects.toThrow('no timezone set');
    expect(mocks.ordersSearch).not.toHaveBeenCalled();
  });

  it('keeps retrying a day with no cash_activity row by pinning the watermark to it, not advancing past it', async () => {
    // A 10-day range where only the OLDEST day (09-01) is missing its
    // cash_activity row — well outside the usual 3-day overlap buffer
    // behind endDate (10-10 - 3 = 10-07), so the fix only shows up if the
    // watermark tracks the skipped day specifically rather than just
    // always using that buffer.
    mocks.execute.mockImplementation(async (sqlObj: any) => {
      const rendered = renderSql(sqlObj);
      if (rendered.includes('FROM tenants')) return tenantConfigRow();
      if (rendered.includes('UPDATE cash_activity')) {
        const isMissingRowDay = sqlObj.queryChunks.includes('2026-09-01');
        return { rowCount: isMissingRowDay ? 0 : 1 };
      }
      return { rowCount: undefined }; // final tenant UPDATE
    });

    mocks.ordersSearch.mockResolvedValueOnce({ orders: [], cursor: undefined });

    const result = await squareService.syncTransactionCountsForTenant(tenantId, {
      startDate: '2026-09-01',
      endDate: '2026-09-10',
    });

    expect(result).toEqual({ daysUpdated: 9, daysSkippedNoRow: 1, ordersSeen: 0 });

    const tenantUpdateCall = mocks.execute.mock.calls.find((c) => renderSql(c[0]).includes('UPDATE tenants'));
    expect(tenantUpdateCall).toBeDefined();
    // The watermark must stay at the oldest unresolved day (09-01), not the
    // usual end-of-range overlap buffer (09-07) — otherwise that day falls
    // out of range forever once it's more than a few days old.
    expect(tenantUpdateCall![0].queryChunks).toContain('2026-09-01');
  });

  it('advances the watermark to the usual overlap buffer when nothing was skipped', async () => {
    mocks.execute
      .mockResolvedValueOnce(tenantConfigRow())
      .mockResolvedValueOnce({ rowCount: 1 }) // the single day in range, row exists
      .mockResolvedValueOnce({ rowCount: undefined });

    mocks.ordersSearch.mockResolvedValueOnce({ orders: [], cursor: undefined });

    await squareService.syncTransactionCountsForTenant(tenantId, {
      startDate: '2026-10-01',
      endDate: '2026-10-01',
    });

    // 3 days before endDate (2026-10-01) is 2026-09-28.
    expect(mocks.execute.mock.calls[2][0].queryChunks).toContain('2026-09-28');
  });
});
