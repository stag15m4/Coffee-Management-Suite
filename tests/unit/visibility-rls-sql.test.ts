import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Regression tests for migrations 155-157: equipment/maintenance assignment
// visibility (and closing the write bypass that let any employee edit any
// equipment), tighter time-off/time-clock SELECT, and the pay-rate column
// revoke + scoped view. Run against a real Postgres (pglite) so RLS and
// column grants are actually exercised, not just read as SQL text.

const tenant = '00000000-0000-0000-0000-000000000100';
const manager = '00000000-0000-0000-0000-000000000001';
const owner = '00000000-0000-0000-0000-000000000002';
const assignee = '00000000-0000-0000-0000-000000000003';
const bystander = '00000000-0000-0000-0000-000000000004';

let db: PGlite;
const file = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

async function asUser<T>(id: string, action: () => Promise<T>): Promise<T> {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('SET ROLE authenticated');
  try {
    return await action();
  } finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    CREATE TYPE user_role AS ENUM ('owner', 'manager', 'lead', 'employee');

    CREATE TABLE tenants (id uuid PRIMARY KEY);
    CREATE TABLE user_profiles (
      id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants, role user_role,
      full_name text, is_active boolean DEFAULT true, manager_id uuid REFERENCES user_profiles,
      is_exempt boolean NOT NULL DEFAULT false,
      hourly_rate numeric(8,2), annual_salary numeric(10,2), pay_frequency text DEFAULT 'biweekly'
    );

    CREATE FUNCTION can_access_tenant(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND tenant_id = t) $$;
    CREATE FUNCTION can_read_tenant_data(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT can_access_tenant(t) $$;
    CREATE FUNCTION has_role_or_higher(r user_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS (
        SELECT 1 FROM user_profiles WHERE id = auth.uid()
        AND CASE role WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'lead' THEN 2 ELSE 1 END
          >= CASE r WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'lead' THEN 2 ELSE 1 END
      )
    $$;
    CREATE FUNCTION is_owner_or_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner','manager')) $$;
    CREATE FUNCTION get_my_tenant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1 $$;

    CREATE TABLE equipment (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
      name text NOT NULL, assigned_to uuid REFERENCES user_profiles ON DELETE SET NULL
    );
    CREATE TABLE maintenance_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
      equipment_id uuid NOT NULL REFERENCES equipment, name text NOT NULL
    );
    CREATE TABLE maintenance_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
      task_id uuid NOT NULL REFERENCES maintenance_tasks, notes text
    );
    CREATE TABLE time_off_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
      employee_id uuid NOT NULL REFERENCES user_profiles, reason text, status text DEFAULT 'pending'
    );
    CREATE TABLE time_clock_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants,
      employee_id uuid REFERENCES user_profiles, clock_in timestamptz NOT NULL, clock_out timestamptz
    );

    ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
    ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE time_clock_entries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "self or tenant mgmt read" ON user_profiles FOR SELECT USING (can_access_tenant(tenant_id));

    -- Seed-data INSERT policies (tenant-wide); 155/156/157 only touch
    -- SELECT/UPDATE, so these stand in for the real, already-shipped INSERT
    -- policies (migrations 041/050/071) that this fixture doesn't replay.
    CREATE POLICY "insert equipment" ON equipment FOR INSERT WITH CHECK (can_access_tenant(tenant_id));
    CREATE POLICY "insert maintenance_tasks" ON maintenance_tasks FOR INSERT WITH CHECK (can_access_tenant(tenant_id));
    CREATE POLICY "insert maintenance_logs" ON maintenance_logs FOR INSERT WITH CHECK (can_access_tenant(tenant_id));
    CREATE POLICY "insert time_off_requests" ON time_off_requests FOR INSERT WITH CHECK (can_access_tenant(tenant_id));
    CREATE POLICY "insert time_clock_entries" ON time_clock_entries FOR INSERT WITH CHECK (can_access_tenant(tenant_id));

    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      equipment, maintenance_tasks, maintenance_logs, time_off_requests, time_clock_entries, user_profiles, tenants
      TO authenticated;
  `);

  // Apply the real migrations under test, exactly as they'd run in production.
  for (const name of [
    '155_equipment_assignment_visibility',
    '156_scope_time_off_and_clock_select',
    '157_scope_pay_rate_visibility',
  ]) {
    await db.exec(file(`supabase-migrations/${name}.sql`));
  }
}, 30000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(
    'TRUNCATE tenants, user_profiles, equipment, maintenance_tasks, maintenance_logs, time_off_requests, time_clock_entries CASCADE'
  );
  await db.query('INSERT INTO tenants VALUES ($1)', [tenant]);
  await db.query(
    `INSERT INTO user_profiles (id, tenant_id, role, full_name) VALUES
       ($1, $5, 'owner', 'Owner'), ($2, $5, 'manager', 'Manager'),
       ($3, $5, 'employee', 'Assignee'), ($4, $5, 'employee', 'Bystander')`,
    [owner, manager, assignee, bystander, tenant]
  );
});

describe('equipment visibility and write access', () => {
  async function addEquipment(name: string, assignedTo: string | null) {
    return (
      await asUser(manager, () =>
        db.query<{ id: string }>(
          'INSERT INTO equipment (tenant_id, name, assigned_to) VALUES ($1, $2, $3) RETURNING id',
          [tenant, name, assignedTo]
        )
      )
    ).rows[0].id;
  }

  it('shows unassigned (shop) equipment to everyone', async () => {
    await addEquipment('Espresso Machine', null);
    for (const viewer of [owner, manager, assignee, bystander]) {
      const rows = (await asUser(viewer, () => db.query('SELECT * FROM equipment'))).rows;
      expect(rows).toHaveLength(1);
    }
  });

  it('hides assigned equipment from everyone but the assignee and managers+', async () => {
    await addEquipment('Delivery Van', assignee);
    expect((await asUser(assignee, () => db.query('SELECT * FROM equipment'))).rows).toHaveLength(1);
    expect((await asUser(manager, () => db.query('SELECT * FROM equipment'))).rows).toHaveLength(1);
    expect((await asUser(owner, () => db.query('SELECT * FROM equipment'))).rows).toHaveLength(1);
    expect((await asUser(bystander, () => db.query('SELECT * FROM equipment'))).rows).toHaveLength(0);
  });

  it("hides an assigned vehicle's maintenance tasks and logs from an unrelated employee", async () => {
    const equipmentId = await addEquipment('Lawn Mower', assignee);
    const taskId = (
      await asUser(manager, () =>
        db.query<{ id: string }>(
          'INSERT INTO maintenance_tasks (tenant_id, equipment_id, name) VALUES ($1, $2, $3) RETURNING id',
          [tenant, equipmentId, 'Blade sharpening']
        )
      )
    ).rows[0].id;
    await asUser(manager, () =>
      db.query('INSERT INTO maintenance_logs (tenant_id, task_id, notes) VALUES ($1, $2, $3)', [
        tenant,
        taskId,
        'Sharpened',
      ])
    );

    expect((await asUser(bystander, () => db.query('SELECT * FROM maintenance_tasks'))).rows).toHaveLength(0);
    expect((await asUser(bystander, () => db.query('SELECT * FROM maintenance_logs'))).rows).toHaveLength(0);
    expect((await asUser(assignee, () => db.query('SELECT * FROM maintenance_tasks'))).rows).toHaveLength(1);
    expect((await asUser(manager, () => db.query('SELECT * FROM maintenance_logs'))).rows).toHaveLength(1);
  });

  // The actual bug: migration 013's "All team members can update equipment"
  // was never dropped when 041 added a manager-only UPDATE policy, so it
  // silently stayed live and OR'd permissively with it — any employee could
  // edit (or move the assignment of) any equipment. This proves it's closed.
  it("no longer lets an unrelated employee update someone else's assigned equipment", async () => {
    const equipmentId = await addEquipment('Delivery Van', assignee);
    const result = await asUser(bystander, () =>
      db.query('UPDATE equipment SET name = $1 WHERE id = $2', ['Renamed', equipmentId])
    );
    expect(result.affectedRows ?? 0).toBe(0);
    const row = (
      await asUser(manager, () => db.query<{ name: string }>('SELECT name FROM equipment WHERE id = $1', [equipmentId]))
    ).rows[0];
    expect(row.name).toBe('Delivery Van');
  });

  it('still lets the assignee update their own assigned equipment', async () => {
    const equipmentId = await addEquipment('Delivery Van', assignee);
    await asUser(assignee, () =>
      db.query('UPDATE equipment SET name = $1 WHERE id = $2', ['Serviced Van', equipmentId])
    );
    const row = (
      await asUser(assignee, () =>
        db.query<{ name: string }>('SELECT name FROM equipment WHERE id = $1', [equipmentId])
      )
    ).rows[0];
    expect(row.name).toBe('Serviced Van');
  });

  it('still lets anyone update unassigned (shop) equipment', async () => {
    const equipmentId = await addEquipment('Espresso Machine', null);
    await asUser(bystander, () => db.query('UPDATE equipment SET name = $1 WHERE id = $2', ['Descaled', equipmentId]));
    const row = (
      await asUser(bystander, () =>
        db.query<{ name: string }>('SELECT name FROM equipment WHERE id = $1', [equipmentId])
      )
    ).rows[0];
    expect(row.name).toBe('Descaled');
  });
});

describe('time off and time clock visibility', () => {
  it('lets an employee see only their own time-off requests and clock entries', async () => {
    await asUser(manager, () =>
      db.query("INSERT INTO time_off_requests (tenant_id, employee_id, reason) VALUES ($1, $2, 'personal')", [
        tenant,
        assignee,
      ])
    );
    await asUser(manager, () =>
      db.query("INSERT INTO time_off_requests (tenant_id, employee_id, reason) VALUES ($1, $2, 'medical')", [
        tenant,
        bystander,
      ])
    );
    await asUser(manager, () =>
      db.query('INSERT INTO time_clock_entries (tenant_id, employee_id, clock_in) VALUES ($1, $2, now())', [
        tenant,
        assignee,
      ])
    );

    expect((await asUser(assignee, () => db.query('SELECT * FROM time_off_requests'))).rows).toHaveLength(1);
    expect((await asUser(assignee, () => db.query('SELECT * FROM time_clock_entries'))).rows).toHaveLength(1);
    expect((await asUser(bystander, () => db.query('SELECT * FROM time_clock_entries'))).rows).toHaveLength(0);
  });

  it("lets a lead see everyone's time off, but only a manager+ see everyone's clock entries", async () => {
    await db.query("UPDATE user_profiles SET role = 'lead' WHERE id = $1", [bystander]);
    await asUser(manager, () =>
      db.query("INSERT INTO time_off_requests (tenant_id, employee_id, reason) VALUES ($1, $2, 'personal')", [
        tenant,
        assignee,
      ])
    );
    await asUser(manager, () =>
      db.query('INSERT INTO time_clock_entries (tenant_id, employee_id, clock_in) VALUES ($1, $2, now())', [
        tenant,
        assignee,
      ])
    );

    expect((await asUser(bystander, () => db.query('SELECT * FROM time_off_requests'))).rows).toHaveLength(1);
    expect((await asUser(bystander, () => db.query('SELECT * FROM time_clock_entries'))).rows).toHaveLength(0);
    expect((await asUser(manager, () => db.query('SELECT * FROM time_clock_entries'))).rows).toHaveLength(1);
  });
});

describe('pay rate column protection', () => {
  beforeEach(async () => {
    await db.query('UPDATE user_profiles SET hourly_rate = 25 WHERE id = $1', [assignee]);
    await db.query('UPDATE user_profiles SET hourly_rate = 30 WHERE id = $1', [bystander]);
  });

  // Column-level REVOKE itself (migration 157's `REVOKE SELECT (hourly_rate,
  // ...) ... FROM authenticated`) can't be exercised here: pglite accepts
  // the statement but doesn't actually enforce per-column privileges (verified
  // separately — a column-granted-then-revoked SELECT still succeeds and
  // information_schema.column_privileges still lists it). This is a real,
  // decades-old Postgres feature that Supabase's actual database does
  // enforce; it's specifically pglite's simplified permission model that
  // can't verify it here. What IS fully testable (and covered below) is the
  // `user_pay_rates` view's own self-or-manager WHERE clause, which is the
  // part every client call site actually goes through.

  it('still lets a manager select hourly_rate directly off the base table', async () => {
    const row = (
      await asUser(manager, () =>
        db.query<{ hourly_rate: string }>('SELECT hourly_rate FROM user_profiles WHERE id = $1', [assignee])
      )
    ).rows[0];
    expect(Number(row.hourly_rate)).toBe(25);
  });

  it('user_pay_rates view returns only your own rate for a plain employee', async () => {
    const rows = (await asUser(assignee, () => db.query('SELECT * FROM user_pay_rates'))).rows;
    expect(rows).toHaveLength(1);
    expect((rows[0] as { id: string }).id).toBe(assignee);
  });

  it("user_pay_rates view returns every tenant member's rate for a manager", async () => {
    const rows = (await asUser(manager, () => db.query('SELECT * FROM user_pay_rates'))).rows;
    expect(rows.map((r) => (r as { id: string }).id).sort()).toEqual([assignee, bystander, manager, owner].sort());
  });

  it('blocks a plain employee from giving themself a raise', async () => {
    await expect(
      asUser(assignee, () => db.query('UPDATE user_profiles SET hourly_rate = 999 WHERE id = $1', [assignee]))
    ).rejects.toThrow();
  });

  it('blocks a plain employee from reassigning their own manager_id', async () => {
    await expect(
      asUser(assignee, () => db.query('UPDATE user_profiles SET manager_id = $1 WHERE id = $2', [assignee, assignee]))
    ).rejects.toThrow();
  });

  it('still lets a manager toggle their own is_exempt (the TimeClockTab self-toggle)', async () => {
    await asUser(manager, () => db.query('UPDATE user_profiles SET is_exempt = true WHERE id = $1', [manager]));
    const row = (
      await asUser(manager, () =>
        db.query<{ is_exempt: boolean }>('SELECT is_exempt FROM user_profiles WHERE id = $1', [manager])
      )
    ).rows[0];
    expect(row.is_exempt).toBe(true);
  });

  it('blocks a plain employee from toggling their own is_exempt', async () => {
    await expect(
      asUser(assignee, () => db.query('UPDATE user_profiles SET is_exempt = true WHERE id = $1', [assignee]))
    ).rejects.toThrow();
  });

  it("still lets a manager update another employee's hourly_rate", async () => {
    await asUser(manager, () => db.query('UPDATE user_profiles SET hourly_rate = 27 WHERE id = $1', [assignee]));
    const row = (
      await asUser(manager, () =>
        db.query<{ hourly_rate: string }>('SELECT hourly_rate FROM user_profiles WHERE id = $1', [assignee])
      )
    ).rows[0];
    expect(Number(row.hourly_rate)).toBe(27);
  });
});
