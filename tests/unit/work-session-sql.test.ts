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
async function count(table: string) {
  return (await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sqlFile('tests/fixtures/time-clock-schema.sql'));
  await db.exec(sqlFile('supabase-migrations/150_secure_time_corrections.sql'));
  await db.exec(sqlFile('supabase-migrations/151_audited_work_sessions.sql'));
  await db.exec(
    'GRANT USAGE ON SCHEMA public, auth TO authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;'
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    'TRUNCATE tenants, user_profiles, time_clock_entries, time_clock_breaks, time_clock_edit_requests, time_clock_missing_requests, time_clock_audit_events CASCADE'
  );
  await db.query('INSERT INTO tenants VALUES ($1),($2)', [tenant, otherTenant]);
  await db.query(
    "INSERT INTO user_profiles(id,tenant_id,role,full_name) VALUES ($1,$2,'manager','Manager'),($3,$2,'employee','Employee'),($4,$5,'manager','Other manager')",
    [manager, tenant, employee, outsider, otherTenant]
  );
});

describe('audited work-session database workflow', () => {
  it('keeps employee requests out of official hours until a manager approves once', async () => {
    const request = await asUser(
      employee,
      async () =>
        (
          await db.query<{ id: string }>(
            "SELECT request_missing_time_session($1,'2026-09-29 07:00Z','2026-09-29 10:00Z','[]','Forgot to clock in') AS id",
            [tenant]
          )
        ).rows[0].id
    );
    expect(await count('time_clock_entries')).toBe(0);
    await expect(
      asUser(employee, () => db.query("SELECT review_missing_time_session($1,'approved')", [request]))
    ).rejects.toThrow('Manager approval required');
    await asUser(manager, () => db.query("SELECT review_missing_time_session($1,'approved')", [request]));
    expect(await count('time_clock_entries')).toBe(1);
    expect(await count('time_clock_audit_events')).toBe(1);
    await expect(
      asUser(manager, () => db.query("SELECT review_missing_time_session($1,'approved')", [request]))
    ).rejects.toThrow('no longer pending');
  });
  it('allows separate sessions on one day and rejects overlaps', async () => {
    await addSession();
    await addSession('2026-09-29T14:00:00Z', '2026-09-29T17:00:00Z');
    await expect(addSession('2026-09-29T09:00:00Z', '2026-09-29T11:00:00Z')).rejects.toThrow('overlaps');
    expect(await count('time_clock_entries')).toBe(2);
  });
  it('rejects unauthorized and cross-business manager writes', async () => {
    const args = [tenant, employee];
    const action = () =>
      db.query(
        "SELECT save_time_clock_session($1,$2,NULL,NULL,'2026-09-29 07:00Z','2026-09-29 10:00Z','[]','Test')",
        args
      );
    await expect(asUser(employee, action)).rejects.toThrow('Manager access required');
    await expect(asUser(outsider, action)).rejects.toThrow('Manager access required');
    expect(await count('time_clock_entries')).toBe(0);
  });
  it('validates multiple breaks inside overnight sessions and rolls back invalid proposals', async () => {
    await addSession('2026-09-29T22:00:00Z', '2026-09-30T06:00:00Z', [
      { break_start: '2026-09-29T23:00:00Z', break_end: '2026-09-29T23:15:00Z' },
      { break_start: '2026-09-30T02:00:00Z', break_end: '2026-09-30T02:30:00Z' },
    ]);
    expect(await count('time_clock_breaks')).toBe(2);
    const events = await count('time_clock_audit_events');
    await expect(
      addSession('2026-09-29T07:00:00Z', '2026-09-29T10:00:00Z', [
        { break_start: '2026-09-29T09:00:00Z', break_end: '2026-09-29T11:00:00Z' },
      ])
    ).rejects.toThrow('Breaks must');
    expect(await count('time_clock_entries')).toBe(1);
    expect(await count('time_clock_audit_events')).toBe(events);
  });
  it('rolls back the punch and history if a later break insert fails', async () => {
    await db.exec(
      "CREATE FUNCTION fail_break_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected break failure'; END $$; CREATE TRIGGER fail_break_test BEFORE INSERT ON time_clock_breaks FOR EACH ROW EXECUTE FUNCTION fail_break_test();"
    );
    try {
      await expect(
        addSession(undefined, undefined, [{ break_start: '2026-09-29T08:00:00Z', break_end: '2026-09-29T08:15:00Z' }])
      ).rejects.toThrow('Injected break failure');
      expect(await count('time_clock_entries')).toBe(0);
      expect(await count('time_clock_audit_events')).toBe(0);
    } finally {
      await db.exec('DROP TRIGGER fail_break_test ON time_clock_breaks; DROP FUNCTION fail_break_test();');
    }
  });
  it('rejects a stale editor after another session update', async () => {
    const id = await addSession();
    await expect(
      asUser(manager, () =>
        db.query(
          "SELECT save_time_clock_session($1,$2,$3,'2000-01-01','2026-09-29 07:00Z','2026-09-29 11:00Z','[]','Stale edit')",
          [tenant, employee, id]
        )
      )
    ).rejects.toThrow('changed while you were editing');
  });
  it('keeps before-and-after history when a session is deleted', async () => {
    const id = await addSession();
    const version = (
      await db.query<{ updated_at: Date }>('SELECT updated_at FROM time_clock_entries WHERE id=$1', [id])
    ).rows[0].updated_at;
    await asUser(manager, () =>
      db.query('SELECT delete_time_clock_session($1,$2,$3)', [id, version, 'Duplicate session'])
    );
    expect(await count('time_clock_entries')).toBe(0);
    const events = await db.query<{ reason: string; old_value: unknown }>(
      "SELECT reason,old_value FROM time_clock_audit_events WHERE action='delete'"
    );
    expect(events.rows[0].reason).toBe('Duplicate session');
    expect(events.rows[0].old_value).toBeTruthy();
  });
  it('does not allow employees to rewrite audit records or review their own missing request', async () => {
    await addSession();
    await asUser(employee, () => db.query("UPDATE time_clock_audit_events SET reason='fake'"));
    const result = await db.query<{ reason: string }>('SELECT reason FROM time_clock_audit_events');
    expect(result.rows[0].reason).toBe('Manager correction');
    await expect(
      asUser(employee, () =>
        db.query(
          "INSERT INTO time_clock_audit_events(tenant_id,entry_id,entity_type,action) VALUES ($1,gen_random_uuid(),'session','insert')",
          [tenant]
        )
      )
    ).rejects.toThrow('row-level security');
  });
  it('applies an existing staff correction with its reason in the audit trail', async () => {
    const id = await addSession();
    const request = await asUser(
      employee,
      async () =>
        (
          await db.query<{ id: string }>(
            "INSERT INTO time_clock_edit_requests(tenant_id,employee_id,time_clock_entry_id,original_clock_in,original_clock_out,requested_clock_out,reason) VALUES ($1,$2,$3,'2026-09-29 07:00Z','2026-09-29 10:00Z','2026-09-29 11:00Z','Missed the final hour') RETURNING id",
            [tenant, employee, id]
          )
        ).rows[0].id
    );
    await asUser(manager, () => db.query('SELECT review_time_clock_edit($1,true)', [request]));
    const events = await db.query<{ reason: string }>(
      "SELECT reason FROM time_clock_audit_events WHERE action='update'"
    );
    expect(events.rows[0].reason).toBe('Missed the final hour');
  });
  it('keeps an overlapping missed-session request pending when approval fails', async () => {
    await addSession();
    const id = await asUser(
      employee,
      async () =>
        (
          await db.query<{ id: string }>(
            "SELECT request_missing_time_session($1,'2026-09-29 08:00Z','2026-09-29 11:00Z','[]','Missing shift') AS id",
            [tenant]
          )
        ).rows[0].id
    );
    await expect(
      asUser(manager, () => db.query("SELECT review_missing_time_session($1,'approved')", [id]))
    ).rejects.toThrow('overlaps');
    const status = await db.query<{ status: string }>('SELECT status FROM time_clock_missing_requests WHERE id=$1', [
      id,
    ]);
    expect(status.rows[0].status).toBe('pending');
    expect(await count('time_clock_entries')).toBe(1);
  });
  it('updates break versions and rejects stale edits without losing the live change', async () => {
    const id = await addSession(undefined, undefined, [
      { break_start: '2026-09-29 08:00Z', break_end: '2026-09-29 08:15Z' },
    ]);
    const oldVersion = (
      await db.query<{ version: string }>('SELECT updated_at::text AS version FROM time_clock_entries WHERE id=$1', [
        id,
      ])
    ).rows[0].version;
    await asUser(manager, () =>
      db.query("UPDATE time_clock_breaks SET break_end='2026-09-29 08:30Z' WHERE time_clock_entry_id=$1", [id])
    );
    await expect(
      asUser(manager, () =>
        db.query(
          "SELECT save_time_clock_session($1,$2,$3,$4,'2026-09-29 07:00Z','2026-09-29 10:00Z','[]','Stale break snapshot')",
          [tenant, employee, id, oldVersion]
        )
      )
    ).rejects.toThrow('changed while you were editing');
    expect(await count('time_clock_breaks')).toBe(1);
  });
});
