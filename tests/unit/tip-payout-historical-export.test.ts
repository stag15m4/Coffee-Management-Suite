import { describe, it, expect } from 'vitest';
import {
  buildHistoricalGroupHtml,
  buildHistoricalIndividualHtml,
} from '../../client/src/components/tip-payout/export-helpers';
import { TipEmployee } from '../../client/src/components/tip-payout/types';

// Regression coverage for a real bug: an employee with tip_eligible === false
// (e.g. Ava) still had her hours counted in the rate divisor and still showed
// up with a nonzero payout in historical exports, even though the live
// weekly payout page correctly excludes her. This diluted every actually
// tip-eligible employee's rightful share, not just mis-attributed money to
// the ineligible employee.

function employee(id: string, name: string, tipEligible: boolean | null): TipEmployee {
  return { id, tenant_id: 't1', name, is_active: true, tip_eligible: tipEligible };
}

const eligible = employee('emp-1', 'Seth', true);
const ineligible = employee('emp-2', 'Ava', false);

const weeklyData = [{ week_key: '2026-09-21', cash_tips: 100, cc_tips: 0 }];

function hoursRow(emp: TipEmployee, hours: number, weekKey = '2026-09-21') {
  return { week_key: weekKey, hours, tip_employees: { id: emp.id, name: emp.name } };
}

describe('buildHistoricalGroupHtml — tip-eligibility filtering', () => {
  it('excludes a tip-ineligible employee from the rate divisor and the payout table', () => {
    const hoursData = [hoursRow(eligible, 10), hoursRow(ineligible, 5)];
    const html = buildHistoricalGroupHtml({
      startRange: '9/21/2026',
      endRange: '10/4/2026',
      weeklyData,
      hoursData,
      allEmployees: [eligible, ineligible],
    });

    // Rate should be computed over Seth's 10h only (pool $100 / 10h = $10/hr),
    // not diluted by Ava's 5h (which would give $100/15h = $6.67/hr).
    expect(html).toContain('$10.00');
    expect(html).not.toContain('Ava');
    expect(html).toContain('Seth');
    // Grand total payout should be the full $100 pool, all attributed to Seth.
    expect(html).toContain('$100.00');
  });

  it('still includes an employee with tip_eligible left null (treated as eligible)', () => {
    const nullEligible = employee('emp-3', 'Zoe', null);
    const hoursData = [hoursRow(nullEligible, 10)];
    const html = buildHistoricalGroupHtml({
      startRange: '9/21/2026',
      endRange: '10/4/2026',
      weeklyData,
      hoursData,
      allEmployees: [nullEligible],
    });
    expect(html).toContain('Zoe');
    expect(html).toContain('$100.00');
  });
});

describe('buildHistoricalIndividualHtml — tip-eligibility filtering', () => {
  it("does not let an ineligible coworker's hours dilute the displayed rate", () => {
    const hoursData = [hoursRow(eligible, 10), hoursRow(ineligible, 5)];
    const html = buildHistoricalIndividualHtml({
      employeeName: 'Seth',
      startRange: '9/21/2026',
      endRange: '10/4/2026',
      weeklyData,
      hoursData,
      employeeId: eligible.id,
      allEmployees: [eligible, ineligible],
    });

    expect(html).toContain('$10.00'); // rate: $100 / 10h, not /15h
    expect(html).toContain('$100.00'); // Seth's full payout
  });
});
