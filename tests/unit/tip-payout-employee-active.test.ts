import { describe, it, expect } from 'vitest';
import { isEmployeeActive, isEmployeeTipEligible, TipEmployee } from '../../client/src/components/tip-payout/types';

const emp = (overrides: Partial<TipEmployee> = {}): TipEmployee => ({
  id: overrides.id ?? 'e1',
  tenant_id: 't1',
  name: overrides.name ?? 'Employee',
  is_active: true,
  tip_eligible: true,
  // `??` treats an explicit null the same as undefined, which would
  // silently coalesce a deliberate `is_active: null` override back to
  // true — the opposite of what these tests need to exercise. Spreading
  // overrides last preserves an explicit null.
  ...overrides,
});

describe('isEmployeeActive', () => {
  // Older tip_employees rows predate is_active being consistently set, and
  // server code elsewhere (e.g. squareService's employee matching: "is_active
  // IS NULL OR is_active = true") already treats a null row as active. This
  // is the contract loadEmployees() must honor when building the list that
  // feeds the weekly hours dropdown.
  it('treats null as active', () => {
    expect(isEmployeeActive(emp({ is_active: null }))).toBe(true);
  });

  it('treats explicit true as active', () => {
    expect(isEmployeeActive(emp({ is_active: true }))).toBe(true);
  });

  it('treats explicit false as inactive', () => {
    expect(isEmployeeActive(emp({ is_active: false }))).toBe(false);
  });
});

describe('isEmployeeTipEligible', () => {
  it('treats null as eligible', () => {
    expect(isEmployeeTipEligible(emp({ tip_eligible: null }))).toBe(true);
  });

  it('treats explicit false as ineligible', () => {
    expect(isEmployeeTipEligible(emp({ tip_eligible: false }))).toBe(false);
  });
});

describe('the active-employee list loadEmployees() builds', () => {
  // Regression test for the reported bug: employees (e.g. with a null
  // is_active from before that column was consistently populated) were
  // silently missing from the weekly Tip Payout hours entry, forcing staff
  // to re-add them and hand-enter their hours every week. The bug was a
  // plain `employee.is_active` truthy filter, which excludes null. Manage
  // Employees uses isEmployeeActive() for its "Inactive" badge, so the same
  // employee looked perfectly active there — nothing pointed at why they
  // were missing from hours entry specifically.
  const roster = [
    emp({ id: '1', name: 'Lauren', is_active: null }),
    emp({ id: '2', name: 'Isabella', is_active: null }),
    emp({ id: '3', name: 'Active Andy', is_active: true }),
    emp({ id: '4', name: 'Deactivated Dana', is_active: false }),
  ];

  it('the old plain-truthy filter drops null-active employees (documents the bug)', () => {
    const buggy = roster.filter((e) => e.is_active);
    expect(buggy.map((e) => e.name)).toEqual(['Active Andy']);
  });

  it('filtering with isEmployeeActive keeps null-active employees, excludes only explicit false', () => {
    const fixed = roster.filter(isEmployeeActive);
    expect(fixed.map((e) => e.name).sort()).toEqual(['Active Andy', 'Isabella', 'Lauren']);
  });
});
