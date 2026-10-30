import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';
const actor = '00000000-0000-0000-0000-000000000010';
const serviceActor = 'a1fed000-0000-0000-0000-000000000000';
const migration = readFileSync('supabase-migrations/164_audit_log_access_hardening.sql', 'utf8');

it('rolls back fresh table creation when required tenant helpers are missing', async () => {
  const isolated = new PGlite();
  try {
    await isolated.exec('CREATE ROLE authenticated; CREATE TABLE public.tenants(id uuid PRIMARY KEY)');
    await expect(isolated.exec(migration)).rejects.toThrow(/can_access_tenant/);
    await isolated.exec('ROLLBACK');
    const result = await isolated.query("SELECT to_regclass('public.audit_logs') AS audit_table");
    expect(result.rows).toEqual([{ audit_table: null }]);
    expect((await isolated.query('SELECT * FROM public.tenants')).rows).toEqual([]);
  } finally {
    await isolated.close();
  }
}, 30000);

describe.each(['fresh', 'upgrade'] as const)('migration 164 %s path', (mode) => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
    CREATE FUNCTION can_access_tenant(id uuid) RETURNS boolean LANGUAGE sql STABLE AS
      $$ SELECT id::text = current_setting('test.tenant', true) $$;
    CREATE FUNCTION has_role_or_higher(role_name text) RETURNS boolean LANGUAGE sql STABLE AS
      $$ SELECT current_setting('test.role', true) IN ('manager', 'owner') $$;
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE platform_admins(id uuid PRIMARY KEY, is_active boolean);
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT SELECT ON platform_admins TO authenticated;
  `);
    if (mode === 'upgrade') {
      await db.exec(readFileSync('supabase-migrations/143_audit_logs.sql', 'utf8'));
      // Reproduce broad legacy grants before hardening.
      await db.exec('GRANT ALL ON audit_logs TO PUBLIC, anon, authenticated, service_role');
    } else {
      // Mimic hosted default grants when a new table is created.
      await db.exec(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role'
      );
      await db.exec(migration);
    }
    await db.query('INSERT INTO tenants VALUES ($1), ($2)', [tenantA, tenantB]);
    await db.query('INSERT INTO platform_admins VALUES ($1, true)', [actor]);
    await db.query(
      "INSERT INTO audit_logs(tenant_id, actor_id, action, resource_type) VALUES ($1,$3,'seed','test'),($2,$3,'seed','test')",
      [tenantA, tenantB, actor]
    );
    await db.exec(migration);
  }, 30000);

  afterAll(async () => db?.close());

  async function asRole(role: 'anon' | 'authenticated' | 'service_role', task: () => Promise<unknown>) {
    await db.exec(`SET ROLE ${role}`);
    try {
      return await task();
    } finally {
      await db.exec('RESET ROLE');
    }
  }

  async function identity(role: string, admin = false) {
    await db.query(
      "SELECT set_config('test.tenant', $1, false), set_config('test.role', $2, false), set_config('test.actor', $3, false)",
      [tenantA, role, admin ? actor : serviceActor]
    );
  }

  describe('migration 164 audit access boundaries', () => {
    it('can be reapplied without losing existing records', async () => {
      await db.exec(migration);
      expect((await db.query('SELECT * FROM audit_logs')).rows).toHaveLength(2);
    });

    it.each(['manager', 'owner'])('keeps %s reads limited to the authorized tenant', async (role) => {
      await identity(role);
      await asRole('authenticated', async () => {
        const result = await db.query<{ tenant_id: string }>('SELECT tenant_id FROM audit_logs');
        expect(result.rows).toEqual([{ tenant_id: tenantA }]);
      });
    });

    it('hides logs from ordinary employees', async () => {
      await identity('employee');
      await asRole('authenticated', async () => {
        expect((await db.query('SELECT * FROM audit_logs')).rows).toHaveLength(0);
      });
    });

    it('preserves active platform-admin reads across tenants', async () => {
      await identity('employee', true);
      await asRole('authenticated', async () => {
        expect((await db.query('SELECT * FROM audit_logs')).rows).toHaveLength(2);
      });
    });

    it('does not grant cross-tenant reads to inactive platform admins', async () => {
      await db.query('UPDATE platform_admins SET is_active=false WHERE id=$1', [actor]);
      try {
        await identity('employee', true);
        await asRole('authenticated', async () => {
          expect((await db.query('SELECT * FROM audit_logs')).rows).toHaveLength(0);
        });
      } finally {
        await db.query('UPDATE platform_admins SET is_active=true WHERE id=$1', [actor]);
      }
    });

    it.each([false, true])('blocks forged events even for platform admin=%s', async (admin) => {
      await identity('owner', admin);
      await asRole('authenticated', async () => {
        for (const tenant of [tenantA, tenantB]) {
          await expect(
            db.query("INSERT INTO audit_logs(tenant_id,actor_id,action,resource_type) VALUES ($1,$2,'forged','test')", [
              tenant,
              actor,
            ])
          ).rejects.toThrow(/permission denied/);
        }
      });
    });

    it.each(['authenticated', 'service_role'] as const)('denies update, delete and truncate to %s', async (role) => {
      await identity('owner', true);
      await asRole(role, async () => {
        for (const sql of [
          "UPDATE audit_logs SET action='tampered'",
          'DELETE FROM audit_logs',
          'TRUNCATE audit_logs',
        ]) {
          await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
        }
      });
    });

    it('denies anonymous reads and writes', async () => {
      await asRole('anon', async () => {
        await expect(db.exec('SELECT * FROM audit_logs')).rejects.toThrow(/permission denied/);
        await expect(
          db.query("INSERT INTO audit_logs(tenant_id,actor_id,action,resource_type) VALUES ($1,$2,'forged','test')", [
            tenantA,
            actor,
          ])
        ).rejects.toThrow(/permission denied/);
      });
    });

    it('allows trusted service and database-owner writers, including the Alfred actor', async () => {
      await asRole('service_role', async () => {
        const result = await db.query(
          "INSERT INTO audit_logs(tenant_id,actor_id,action,resource_type) VALUES ($1,$2,'service','test') RETURNING actor_id",
          [tenantA, serviceActor]
        );
        expect(result.rows).toEqual([{ actor_id: serviceActor }]);
      });
      const result = await db.query(
        "INSERT INTO audit_logs(tenant_id,actor_id,action,resource_type) VALUES ($1,$2,'server','test') RETURNING actor_id",
        [tenantB, actor]
      );
      expect(result.rows).toEqual([{ actor_id: actor }]);
    });
  });
});
