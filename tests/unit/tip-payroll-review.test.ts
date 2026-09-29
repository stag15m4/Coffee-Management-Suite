import { describe, expect, it, vi } from 'vitest';
vi.mock('../../client/src/lib/supabase-queries', () => ({ supabase: {} }));
import { sumApprovedTipPayouts } from '../../client/src/components/time-clock/gusto-export';

const week = { week_key: '2026-09-28', cash_tips: '20', cc_tips: '80' };
const id = 'roster-a';
const account = 'account-a';
const params = {
  weeks: [week],
  approvals: [{ week_key: week.week_key, status: 'approved', employee_payouts: [{ employee_id: id, payout: 97.2 }] }],
  roster: [{ id, user_profile_id: account }],
  periodStart: '2026-09-28',
  periodEnd: '2026-10-11',
  employeeIds: new Set([account]),
};

describe('payroll tip review identity', () => {
  it('carries the approved amount by account link', () => {
    expect(sumApprovedTipPayouts(params).get(account)).toBe(97.2);
  });
  it('rejects stale approval and an unlinked roster person', () => {
    expect(() =>
      sumApprovedTipPayouts({ ...params, approvals: [{ ...params.approvals[0], status: 'rejected' }] })
    ).toThrow('needs manager approval');
    expect(() => sumApprovedTipPayouts({ ...params, roster: [{ id, user_profile_id: null }] })).toThrow(
      'without a linked timesheet account'
    );
  });
  it('rejects a tip week that extends beyond the selected pay period', () => {
    expect(() => sumApprovedTipPayouts({ ...params, periodEnd: '2026-09-30' })).toThrow('crosses the pay period');
  });
});
