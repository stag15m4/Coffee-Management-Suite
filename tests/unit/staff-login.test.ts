import { describe, it, expect } from 'vitest';
import { loginEmail, staffAuthEmail, staffIdFromEmail } from '../../shared/staff-login';
import { mergeEmployeeIdentities } from '../../client/src/lib/employee-identities';
describe('staff identification', () => {
  it('supports email login unchanged and normalizes staff IDs', () => {
    expect(loginEmail(' name@example.com ')).toBe('name@example.com');
    expect(loginEmail(' COB-Lauren ')).toBe(staffAuthEmail('cob-lauren'));
    expect(staffIdFromEmail(staffAuthEmail('cob-lauren'))).toBe('cob-lauren');
    expect(staffIdFromEmail('name@example.com')).toBeNull();
  });
  it('rejects malformed staff IDs instead of silently changing identity', () => {
    for (const id of ['ab', '123staff', 'first name', '../staff', '@admin', 'a'.repeat(41)])
      expect(() => staffAuthEmail(id)).toThrow();
  });
  it('retains two profiles and a roster person with the same name', () => {
    const profiles = ['one', 'two'].map((id) => ({
      id,
      full_name: 'Same Name',
      email: id + '@example.com',
      avatar_url: null,
      role: 'employee',
    }));
    expect(mergeEmployeeIdentities(profiles, [{ id: 'tip', name: 'Same Name' }])).toHaveLength(3);
    const linked = mergeEmployeeIdentities(profiles, [{ id: 'tip', name: 'Different Name', user_profile_id: 'one' }]);
    expect(linked).toHaveLength(2);
    expect(linked.find((p) => p.user_profile_id === 'one')?.tip_employee_id).toBe('tip');
  });
});
