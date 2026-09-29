import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
const t = '00000000-0000-0000-0000-000000000100',
  other = '00000000-0000-0000-0000-000000000200';
const manager = '00000000-0000-0000-0000-000000000001',
  worker = '00000000-0000-0000-0000-000000000002',
  second = '00000000-0000-0000-0000-000000000003',
  tip = '00000000-0000-0000-0000-000000000004';
let db: PGlite;
const file = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
beforeAll(async () => {
  db = new PGlite();
  await db.exec(file('tests/fixtures/time-clock-schema.sql'));
  await db.exec(`CREATE ROLE anon; CREATE ROLE service_role;
 ALTER TABLE user_profiles ADD COLUMN email text;
 CREATE TABLE tip_employees(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants,name text,is_active boolean DEFAULT true,user_profile_id uuid REFERENCES user_profiles);
 ALTER TABLE time_clock_entries ADD COLUMN tip_employee_id uuid REFERENCES tip_employees;
 CREATE TABLE shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants,employee_id uuid REFERENCES user_profiles,tip_employee_id uuid REFERENCES tip_employees);
 CREATE TABLE shift_templates(LIKE shifts INCLUDING ALL);
 ALTER TABLE tip_employees ENABLE ROW LEVEL SECURITY;
 CREATE POLICY manager_roster ON tip_employees FOR ALL USING(can_access_tenant(tenant_id) AND has_role_or_higher('manager'));
 `);
  for (const name of [
    '150_secure_time_corrections',
    '151_audited_work_sessions',
    '152_timesheet_reapproval',
    '153_staff_identity',
  ])
    await db.exec(file(`supabase-migrations/${name}.sql`));
  await db.exec(
    'GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON tip_employees,user_profiles TO authenticated;'
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    'TRUNCATE tenants,user_profiles,tip_employees,time_clock_entries,time_clock_breaks,shifts,shift_templates,timesheet_approval_history,staff_identity_history,time_clock_audit_events CASCADE'
  );
  await db.query('INSERT INTO tenants VALUES($1),($2)', [t, other]);
  await db.query(
    "INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES($1,$4,'manager','Manager'),($2,$4,'employee','Same Name'),($3,$5,'employee','Same Name')",
    [manager, worker, second, t, other]
  );
  await db.query("INSERT INTO tip_employees(id,tenant_id,name) VALUES($1,$2,'Same Name')", [tip, t]);
});
async function link(actor = manager, profile = worker) {
  return db.query('SELECT link_staff_identity($1,$2,$3,$4)', [actor, t, tip, profile]);
}
async function addTipSession() {
  return (
    await db.query<{ id: string }>(
      "INSERT INTO time_clock_entries(tenant_id,tip_employee_id,clock_in,clock_out) VALUES($1,$2,'2026-09-29T08:00Z','2026-09-29T10:00Z') RETURNING id",
      [t, tip]
    )
  ).rows[0].id;
}
describe('explicit staff identity linking', () => {
  it('preserves entry and break IDs, tip roster and shift history when assigning the account', async () => {
    const entry = await addTipSession();
    const br = (
      await db.query<{ id: string }>(
        "INSERT INTO time_clock_breaks(tenant_id,time_clock_entry_id,break_start,break_end) VALUES($1,$2,'2026-09-29T09:00Z','2026-09-29T09:15Z') RETURNING id",
        [t, entry]
      )
    ).rows[0].id;
    await db.query('INSERT INTO shifts(tenant_id,tip_employee_id) VALUES($1,$2)', [t, tip]);
    await db.query('INSERT INTO shift_templates(tenant_id,tip_employee_id) VALUES($1,$2)', [t, tip]);
    await link();
    const row = (
      await db.query<{ id: string; employee_id: string; tip_employee_id: string }>('SELECT * FROM time_clock_entries')
    ).rows[0];
    expect(row).toMatchObject({ id: entry, employee_id: worker, tip_employee_id: tip });
    expect((await db.query<{ id: string }>('SELECT id FROM time_clock_breaks')).rows[0].id).toBe(br);
    for (const table of ['shifts', 'shift_templates'])
      expect((await db.query<{ employee_id: string }>(`SELECT employee_id FROM ${table}`)).rows[0].employee_id).toBe(
        worker
      );
    expect((await db.query<{ actor_id: string }>('SELECT actor_id FROM staff_identity_history')).rows[0].actor_id).toBe(
      manager
    );
  });
  it('rejects employees and cross-location target accounts without changing the link', async () => {
    await expect(link(worker)).rejects.toThrow('Manager access required');
    await expect(link(manager, second)).rejects.toThrow('Active account not found');
    expect(
      (await db.query<{ user_profile_id: string | null }>('SELECT user_profile_id FROM tip_employees')).rows[0]
        .user_profile_id
    ).toBeNull();
  });
  it('blocks moving an already linked roster person to another account', async () => {
    await link();
    await db.query('UPDATE user_profiles SET tenant_id=$1 WHERE id=$2', [t, second]);
    await expect(link(manager, second)).rejects.toThrow('already linked');
  });
  it('rejects overlapping time records and rolls the entire identity operation back', async () => {
    await addTipSession();
    await db.query(
      "INSERT INTO time_clock_entries(tenant_id,employee_id,clock_in,clock_out) VALUES($1,$2,'2026-09-29T09:00Z','2026-09-29T11:00Z')",
      [t, worker]
    );
    await expect(link()).rejects.toThrow('Overlapping work sessions');
    expect((await db.query('SELECT * FROM staff_identity_history')).rows).toHaveLength(0);
  });
  it('canonicalizes future imported clock and schedule records and rejects a mismatched account', async () => {
    await link();
    await addTipSession();
    expect(
      (await db.query<{ employee_id: string }>('SELECT employee_id FROM time_clock_entries')).rows[0].employee_id
    ).toBe(worker);
    await db.query('INSERT INTO shifts(tenant_id,tip_employee_id) VALUES($1,$2)', [t, tip]);
    expect((await db.query<{ employee_id: string }>('SELECT employee_id FROM shifts')).rows[0].employee_id).toBe(
      worker
    );
    await expect(
      db.query('INSERT INTO shifts(tenant_id,tip_employee_id,employee_id) VALUES($1,$2,$3)', [t, tip, manager])
    ).rejects.toThrow('identities do not match');
  });
  it('repairs historical tip-only records for a previously linked roster row on explicit confirmation', async () => {
    const id = await addTipSession();
    await db.query('UPDATE tip_employees SET user_profile_id=$1 WHERE id=$2', [worker, tip]);
    await link();
    await link();
    expect(
      (await db.query<{ id: string; employee_id: string }>('SELECT id,employee_id FROM time_clock_entries')).rows
    ).toEqual([{ id, employee_id: worker }]);
  });
  it('invalidates a previously approved account period when historical hours are linked', async () => {
    await addTipSession();
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [manager]);
    await db.query("SELECT review_timesheet_period($1,$2,'2026-09-28','2026-10-11','UTC','[]',true,NULL)", [t, worker]);
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
    await link();
    expect((await db.query<{ status: string }>('SELECT status FROM timesheet_approvals')).rows[0].status).toBe(
      'pending'
    );
  });
  it('rejects browser writes to identity fields and does not expose the server linking function', async () => {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [manager]);
    await db.exec('SET ROLE authenticated');
    try {
      await expect(link()).rejects.toThrow('permission denied');
      await expect(db.query('UPDATE tip_employees SET user_profile_id=$1 WHERE id=$2', [worker, tip])).rejects.toThrow(
        'Roster links are managed'
      );
      await expect(db.query("UPDATE user_profiles SET staff_login_id='forged' WHERE id=$1", [worker])).rejects.toThrow(
        'Staff IDs are managed'
      );
    } finally {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
    }
  });
  it('keeps identical names separate until explicit linking', async () => {
    await addTipSession();
    expect(
      (await db.query<{ employee_id: string | null }>('SELECT employee_id FROM time_clock_entries')).rows[0].employee_id
    ).toBeNull();
  });
});
