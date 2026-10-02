import { describe, it, expect } from 'vitest';
import { buildMyTipsCsv } from '../../client/src/lib/my-tips-export';

describe('buildMyTipsCsv', () => {
  it('includes one row per payout plus a grand total', () => {
    const csv = buildMyTipsCsv('Ava Employee', [
      { week_key: '2026-09-21', approved_at: '2026-09-22T00:00:00Z', hours: '10', payout: '25.5', tenant_id: 't1' },
      { week_key: '2026-09-28', approved_at: '2026-09-29T00:00:00Z', hours: '8', payout: '20', tenant_id: 't1' },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Tip Payouts: Ava Employee');
    expect(csv).toContain('"2026-09-21",10.00,25.50,');
    expect(csv).toContain('"2026-09-28",8.00,20.00,');
    expect(lines[lines.length - 1]).toBe('Total,,45.50,');
  });

  it('still produces a header and a zero total for an empty range', () => {
    const csv = buildMyTipsCsv('Ava Employee', []);
    expect(csv).toContain('Week,Hours,Payout,Approved');
    expect(csv.trim().endsWith('Total,,0.00,')).toBe(true);
  });
});
