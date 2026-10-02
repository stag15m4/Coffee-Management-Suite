import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Verifies the raw SQL used by GET /api/alfred/time-clock-hours actually
// runs against real Postgres: the employee-name COALESCE across the two
// possible identity sources (user_profiles vs tip_employees), and —
// untested anywhere else in this codebase — passing a JS array as a query
// parameter into `= ANY($n::uuid[])`.

const tenant = '00000000-0000-0000-0000-000000000001';
const profileEmployee = '00000000-0000-0000-0000-000000000010';
const linkedTipRow = '00000000-0000-0000-0000-000000000011';
const unlinkedTipRow = '00000000-0000-0000-0000-000000000012';
const entryViaProfile = '00000000-0000-0000-0000-000000000020';
const entryViaUnlinkedRoster = '00000000-0000-0000-0000-000000000021';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE tenants (id uuid PRIMARY KEY);
    CREATE TABLE user_profiles (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants, full_name text);
    CREATE TABLE tip_employees (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants, name text, user_profile_id uuid);
    CREATE TABLE time_clock_entries (
      id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants,
      employee_id uuid REFERENCES user_profiles, tip_employee_id uuid REFERENCES tip_employees,
      clock_in timestamptz NOT NULL, clock_out timestamptz
    );
    CREATE TABLE time_clock_breaks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants,
      time_clock_entry_id uuid REFERENCES time_clock_entries,
      break_start timestamptz NOT NULL, break_end timestamptz, is_paid boolean DEFAULT false
    );
  `);
}, 30000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec('TRUNCATE tenants, user_profiles, tip_employees, time_clock_entries, time_clock_breaks CASCADE');
  await db.query('INSERT INTO tenants VALUES ($1)', [tenant]);
  await db.query("INSERT INTO user_profiles VALUES ($1, $2, 'Ava Profile')", [profileEmployee, tenant]);
  await db.query('INSERT INTO tip_employees VALUES ($1, $2, $3, $4)', [
    linkedTipRow,
    tenant,
    'Ava Roster',
    profileEmployee,
  ]);
  await db.query('INSERT INTO tip_employees VALUES ($1, $2, $3, NULL)', [unlinkedTipRow, tenant, 'Kiosk Kara']);
  await db.query(
    "INSERT INTO time_clock_entries VALUES ($1, $2, $3, NULL, '2026-10-01T13:00:00Z', '2026-10-01T21:00:00Z')",
    [entryViaProfile, tenant, profileEmployee]
  );
  await db.query(
    "INSERT INTO time_clock_entries VALUES ($1, $2, NULL, $3, '2026-10-01T13:00:00Z', '2026-10-01T17:00:00Z')",
    [entryViaUnlinkedRoster, tenant, unlinkedTipRow]
  );
});

async function fetchEntries(tenantId: string, start: string, end: string) {
  return db.query(
    `SELECT tce.id,
            COALESCE(tce.employee_id::text, tce.tip_employee_id::text) AS employee_key,
            COALESCE(up.full_name, te.name, 'Unknown') AS employee_name,
            tce.clock_in, tce.clock_out
     FROM time_clock_entries tce
     LEFT JOIN user_profiles up ON up.id = tce.employee_id
     LEFT JOIN tip_employees te ON te.id = tce.tip_employee_id
     WHERE tce.tenant_id = $1::uuid
       AND tce.clock_in >= $2::date
       AND tce.clock_in < $3::date`,
    [tenantId, start, end]
  );
}

async function fetchBreaks(tenantId: string, entryIds: string[]) {
  return db.query(
    `SELECT time_clock_entry_id, break_start, break_end, is_paid
     FROM time_clock_breaks
     WHERE tenant_id = $1::uuid AND time_clock_entry_id = ANY($2::uuid[])`,
    [tenantId, entryIds]
  );
}

describe('time-clock-hours raw SQL', () => {
  it('resolves the employee name from user_profiles when employee_id is set', async () => {
    const result = await fetchEntries(tenant, '2026-09-30', '2026-10-02');
    const row = (result.rows as any[]).find((r) => r.id === entryViaProfile);
    expect(row.employee_name).toBe('Ava Profile');
    expect(row.employee_key).toBe(profileEmployee);
  });

  it('falls back to tip_employees.name when only tip_employee_id is set (unlinked roster entry)', async () => {
    const result = await fetchEntries(tenant, '2026-09-30', '2026-10-02');
    const row = (result.rows as any[]).find((r) => r.id === entryViaUnlinkedRoster);
    expect(row.employee_name).toBe('Kiosk Kara');
    expect(row.employee_key).toBe(unlinkedTipRow);
  });

  it('excludes entries outside the requested clock_in window', async () => {
    const result = await fetchEntries(tenant, '2026-10-02', '2026-10-03');
    expect(result.rows).toHaveLength(0);
  });

  it('passing a JS string array into ANY($n::uuid[]) matches the right rows', async () => {
    await db.query(
      "INSERT INTO time_clock_breaks (tenant_id, time_clock_entry_id, break_start, break_end, is_paid) VALUES ($1, $2, '2026-10-01T17:00:00Z', '2026-10-01T17:30:00Z', false)",
      [tenant, entryViaProfile]
    );
    await db.query(
      "INSERT INTO time_clock_breaks (tenant_id, time_clock_entry_id, break_start, break_end, is_paid) VALUES ($1, $2, '2026-10-01T15:00:00Z', '2026-10-01T15:10:00Z', true)",
      [tenant, entryViaUnlinkedRoster]
    );

    const result = await fetchBreaks(tenant, [entryViaProfile]);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as any).is_paid).toBe(false);
  });

  it('an empty id array matches nothing (and does not error)', async () => {
    const result = await fetchBreaks(tenant, []);
    expect(result.rows).toHaveLength(0);
  });
});
