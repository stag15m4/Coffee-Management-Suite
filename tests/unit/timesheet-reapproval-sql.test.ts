import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

const tenant = '00000000-0000-0000-0000-000000000100';
const otherTenant = '00000000-0000-0000-0000-000000000200';
const manager = '00000000-0000-0000-0000-000000000001';
const employee = '00000000-0000-0000-0000-000000000002';
const outsider = '00000000-0000-0000-0000-000000000003';
let db: PGlite;
const sqlFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

async function asUser<T>(id: string, action: () => Promise<T>) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('SET ROLE authenticated');
  try {
    return await action();
  } finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}
async function addSession(start = '2026-09-29T07:00:00Z', end = '2026-09-29T10:00:00Z', breaks: unknown[] = []) {
  return asUser(
    manager,
    async () =>
      (
        await db.query<{ id: string }>('SELECT save_time_clock_session($1,$2,NULL,NULL,$3,$4,$5,$6) AS id', [
          tenant,
          employee,
          start,
          end,
          JSON.stringify(breaks),
          'Manager correction',
        ])
      ).rows[0].id
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(sqlFile('tests/fixtures/time-clock-schema.sql'));
  await db.exec(sqlFile('supabase-migrations/150_secure_time_corrections.sql'));
  await db.exec(sqlFile('supabase-migrations/151_audited_work_sessions.sql'));
  await db.exec('CREATE ROLE anon');
  const approvalSchema = sqlFile('supabase-migrations/094_timeclock_overhaul.sql');
  await db.exec(
    approvalSchema.slice(
      approvalSchema.indexOf('CREATE TABLE IF NOT EXISTS timesheet_approvals'),
      approvalSchema.indexOf('-- RLS policies')
    )
  );
  await db.exec(
    'ALTER TABLE timesheet_approvals ENABLE ROW LEVEL SECURITY; CREATE POLICY read_approvals ON timesheet_approvals FOR SELECT USING (can_access_tenant(tenant_id))'
  );
  await db.exec(
    'GRANT USAGE ON SCHEMA public, auth TO authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;'
  );
  await db.exec(sqlFile('supabase-migrations/152_timesheet_reapproval.sql'));
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    'TRUNCATE tenants, user_profiles, time_clock_entries, time_clock_breaks, time_clock_edit_requests, time_clock_missing_requests, time_clock_audit_events, timesheet_approval_history, timesheet_approvals CASCADE'
  );
  await db.query('INSERT INTO tenants VALUES ($1),($2)', [tenant, otherTenant]);
  await db.query(
    "INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES ($1,$2,'manager','Manager'),($3,$2,'employee','Employee'),($4,$5,'manager','Other manager')",
    [manager, tenant, employee, outsider, otherTenant]
  );
});

async function snapshot(start = '2026-09-28', end = '2026-10-11', zone = 'America/New_York') {
  return (
    await db.query<{ value: unknown }>(
      'SELECT timesheet_snapshot($1,$2,$3::date::timestamp AT TIME ZONE $5,($4::date+1)::timestamp AT TIME ZONE $5) value',
      [tenant, employee, start, end, zone]
    )
  ).rows[0].value;
}
async function approve(expected?: unknown, start = '2026-09-28', end = '2026-10-11', zone = 'America/New_York') {
  const value = expected ?? (await snapshot(start, end, zone));
  return asUser(manager, () =>
    db.query<{ status: string; approval_count: number; total_regular_hours: string }>(
      'SELECT * FROM review_timesheet_period($1,$2,$3,$4,$5,$6,true,NULL)',
      [tenant, employee, start, end, zone, JSON.stringify(value)]
    )
  );
}
async function exportCheck(expected?: unknown) {
  const value = expected ?? (await snapshot());
  return asUser(manager, () =>
    db.query('SELECT * FROM validate_timesheet_export($1,$2,$3,$4,$5)', [
      tenant,
      '2026-09-28',
      '2026-10-11',
      'America/New_York',
      JSON.stringify(value),
    ])
  );
}
async function status() {
  return (
    await db.query<{ status: string; invalidated_at: unknown; approved_by: unknown; total_regular_hours: unknown }>(
      'SELECT * FROM timesheet_approvals ORDER BY period_start'
    )
  ).rows[0];
}

describe('timesheet reapproval database workflow', () => {
  it('resets approval and retains the previous approver and totals in history after a punch change', async () => {
    const id = await addSession();
    await approve();
    await db.query("UPDATE time_clock_entries SET clock_out='2026-09-29T11:00Z' WHERE id=$1", [id]);
    expect(await status()).toMatchObject({ status: 'pending', approved_by: null, total_regular_hours: null });
    expect((await status()).invalidated_at).not.toBeNull();
    const history = await db.query<{ old_value: { status: string; approved_by: string } }>(
      'SELECT old_value FROM timesheet_approval_history ORDER BY created_at DESC LIMIT 1'
    );
    expect(history.rows[0].old_value).toMatchObject({ status: 'approved', approved_by: manager });
    await expect(exportCheck()).rejects.toThrow('Every timesheet must be approved');
    const renewed = await approve();
    expect(renewed.rows[0]).toMatchObject({ status: 'approved', approval_count: 2 });
    await expect(exportCheck()).resolves.toBeDefined();
  });
  it('rejects stale snapshots after another manager changes time without sending updated_at', async () => {
    const id = await addSession();
    const prior = await snapshot();
    await db.query("UPDATE time_clock_entries SET clock_out='2026-09-29T11:00Z' WHERE id=$1", [id]);
    await expect(approve(prior)).rejects.toThrow('Recorded time changed');
  });
  it('invalidates for break inserts, updates and deletes', async () => {
    const id = await addSession();
    await approve();
    const b = (
      await db.query<{ id: string }>(
        "INSERT INTO time_clock_breaks(tenant_id,time_clock_entry_id,break_start,break_end) VALUES($1,$2,'2026-09-29T08:00Z','2026-09-29T08:15Z') RETURNING id",
        [tenant, id]
      )
    ).rows[0].id;
    expect((await status()).status).toBe('pending');
    await approve();
    await db.query("UPDATE time_clock_breaks SET break_end='2026-09-29T08:30Z' WHERE id=$1", [b]);
    expect((await status()).status).toBe('pending');
    await approve();
    await db.query('DELETE FROM time_clock_breaks WHERE id=$1', [b]);
    expect((await status()).status).toBe('pending');
  });
  it('invalidates after adding or deleting a session', async () => {
    await addSession();
    await approve();
    const id = await addSession('2026-09-29T12:00Z', '2026-09-29T13:00Z');
    expect((await status()).status).toBe('pending');
    await approve();
    await db.query('DELETE FROM time_clock_entries WHERE id=$1', [id]);
    expect((await status()).status).toBe('pending');
  });
  it('invalidates both old and new pay periods when moving a session', async () => {
    const id = await addSession();
    await approve();
    await approve(undefined, '2026-10-12', '2026-10-25');
    await db.query(
      "UPDATE time_clock_entries SET clock_in='2026-10-13T07:00Z',clock_out='2026-10-13T10:00Z' WHERE id=$1",
      [id]
    );
    expect(
      (await db.query<{ status: string }>('SELECT status FROM timesheet_approvals')).rows.map((r) => r.status)
    ).toEqual(['pending', 'pending']);
  });
  it('leaves approvals unchanged for notes-only writes and unrelated dates', async () => {
    const id = await addSession();
    await approve();
    await db.query("UPDATE time_clock_entries SET notes='Note only' WHERE id=$1", [id]);
    await addSession('2026-10-20T07:00Z', '2026-10-20T10:00Z');
    expect((await status()).status).toBe('approved');
  });
  it('rolls approval invalidation back when the edit transaction fails', async () => {
    const id = await addSession();
    await approve();
    await db.exec('BEGIN');
    await db.query("UPDATE time_clock_entries SET clock_out='2026-09-29T11:00Z' WHERE id=$1", [id]);
    await db.exec('ROLLBACK');
    expect((await status()).status).toBe('approved');
  });
  it('keeps pending staff requests separate from official hours, but blocks approval until review', async () => {
    await addSession();
    await approve();
    await asUser(employee, () =>
      db.query("SELECT request_missing_time_session($1,'2026-09-30T07:00Z','2026-09-30T08:00Z','[]','Forgot')", [
        tenant,
      ])
    );
    expect((await status()).status).toBe('approved');
    const id = (await db.query<{ id: string }>('SELECT id FROM time_clock_missing_requests')).rows[0].id;
    await asUser(manager, () => db.query("SELECT review_missing_time_session($1,'approved',NULL)", [id]));
    expect((await status()).status).toBe('pending');
  });
  it('blocks approval of open sessions and unresolved correction requests', async () => {
    const id = await addSession();
    await db.query('UPDATE time_clock_entries SET clock_out=NULL WHERE id=$1', [id]);
    await expect(approve()).rejects.toThrow('End open work sessions');
    await db.query("UPDATE time_clock_entries SET clock_out='2026-09-29T10:00Z' WHERE id=$1", [id]);
    await asUser(employee, () =>
      db.query("SELECT request_missing_time_session($1,'2026-09-30T07:00Z','2026-09-30T08:00Z','[]','Forgot')", [
        tenant,
      ])
    );
    await expect(approve()).rejects.toThrow('Review pending time corrections');
  });
  it('includes overnight time at a local pay-period boundary and clips approval totals', async () => {
    const id = await addSession('2026-09-28T02:00Z', '2026-09-28T06:00Z');
    const result = await approve();
    expect(Number(result.rows[0].total_regular_hours)).toBe(2);
    await db.query("UPDATE time_clock_entries SET clock_out='2026-09-28T07:00Z' WHERE id=$1", [id]);
    expect((await status()).status).toBe('pending');
  });
  it('rejects staff, cross-tenant managers, direct approval writes and history tampering', async () => {
    await addSession();
    const expected = JSON.stringify(await snapshot());
    for (const actor of [employee, outsider]) {
      await expect(
        asUser(actor, () =>
          db.query("SELECT review_timesheet_period($1,$2,'2026-09-28','2026-10-11','America/New_York',$3,true,NULL)", [
            tenant,
            employee,
            expected,
          ])
        )
      ).rejects.toThrow('Manager access required');
    }
    await approve();
    await expect(asUser(manager, () => db.query("UPDATE timesheet_approvals SET status='approved'"))).rejects.toThrow(
      'permission denied'
    );
    await expect(
      asUser(employee, () => db.query('DELETE FROM timesheet_approval_history RETURNING id'))
    ).rejects.toThrow('permission denied');
  });
  it('rejects a second approval and prevents reapproval from being counted as a first PTO award', async () => {
    const id = await addSession();
    expect((await approve()).rows[0].approval_count).toBe(1);
    await expect(approve()).rejects.toThrow('already approved');
    await db.query("UPDATE time_clock_entries SET clock_out='2026-09-29T11:00Z' WHERE id=$1", [id]);
    expect((await approve()).rows[0].approval_count).toBe(2);
  });
  it('checks exports against the current snapshot and blocks newly added unapproved employees', async () => {
    await addSession();
    await approve();
    const prior = await snapshot();
    await db.query(
      "INSERT INTO time_clock_entries(tenant_id,employee_id,clock_in,clock_out) VALUES($1,$2,'2026-09-29T07:00Z','2026-09-29T08:00Z')",
      [tenant, manager]
    );
    await expect(exportCheck(prior)).rejects.toThrow('Recorded time changed');
  });
});

// Production regression: migrations 150/151 can exist without the older approval table.
it('installs migration 152 when migration 094 never created the approval table', async () => {
  const fresh = new PGlite();
  try {
    await fresh.exec(sqlFile('tests/fixtures/time-clock-schema.sql'));
    await fresh.exec('CREATE ROLE anon');
    await fresh.exec(sqlFile('supabase-migrations/150_secure_time_corrections.sql'));
    await fresh.exec(sqlFile('supabase-migrations/151_audited_work_sessions.sql'));
    await fresh.exec(sqlFile('supabase-migrations/152_timesheet_reapproval.sql'));
    const result = await fresh.query<{ rls: boolean; write: boolean; read: boolean }>(`SELECT
      relrowsecurity AS rls,
      has_table_privilege('authenticated','public.timesheet_approvals','INSERT') AS write,
      has_table_privilege('authenticated','public.timesheet_approvals','SELECT') AS read
      FROM pg_class WHERE oid='public.timesheet_approvals'::regclass`);
    expect(result.rows[0]).toEqual({ rls: true, write: false, read: true });
    await fresh.query('INSERT INTO tenants VALUES ($1)', [tenant]);
    await fresh.query("INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES ($1,$2,'manager','Manager')", [
      manager,
      tenant,
    ]);
    await fresh.exec('GRANT USAGE ON SCHEMA public, auth TO authenticated');
    await fresh.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [manager]);
    await fresh.exec('SET ROLE authenticated');
    const approval = await fresh.query<{ status: string }>(
      "SELECT * FROM review_timesheet_period($1,$2,'2026-09-28','2026-10-11','America/New_York','[]',true,NULL)",
      [tenant, manager]
    );
    expect(approval.rows[0].status).toBe('approved');
    await expect(fresh.query("UPDATE timesheet_approvals SET status='approved'")).rejects.toThrow('permission denied');
  } finally {
    await fresh.close();
  }
}, 30000);
