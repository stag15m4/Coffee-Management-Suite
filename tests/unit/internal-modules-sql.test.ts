import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Regression tests for migration 159: "internal" (and "beta") modules
// should unlock for every member of the tenant whose OWNER is a platform
// admin (the platform creator's own dogfooding tenant), not just for a
// caller who is personally flagged as a platform admin. A different
// tenant's owner — a real customer, not the platform creator — must not
// get the same unlock just by holding the owner role.

const seedTenant = '00000000-0000-0000-0000-000000000100'; // owner is a platform admin
const customerTenant = '00000000-0000-0000-0000-000000000200'; // ordinary paying tenant

const seth = '00000000-0000-0000-0000-000000000001'; // owner of seedTenant, platform admin
const ava = '00000000-0000-0000-0000-000000000002'; // employee of seedTenant, not an admin
const customerOwner = '00000000-0000-0000-0000-000000000003'; // owner of customerTenant, not an admin

let db: PGlite;
const file = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

async function asUser<T>(id: string | null, action: () => Promise<T>): Promise<T> {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  try {
    return await action();
  } finally {
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}

async function enabledModulesFor(tenantId: string, callerId: string | null): Promise<string[]> {
  const result = await asUser(callerId, () =>
    db.query<{ get_tenant_enabled_modules: string[] }>('SELECT get_tenant_enabled_modules($1)', [tenantId])
  );
  return result.rows[0].get_tenant_enabled_modules ?? [];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    CREATE TABLE tenants (id uuid PRIMARY KEY, parent_tenant_id uuid, subscription_plan text);
    CREATE TABLE user_profiles (
      id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants, role text, is_active boolean DEFAULT true
    );
    CREATE TABLE platform_admins (id uuid PRIMARY KEY, is_active boolean DEFAULT true);
    CREATE TABLE modules (id text PRIMARY KEY, rollout_status text NOT NULL DEFAULT 'ga');
    CREATE TABLE subscription_plan_modules (plan_id text, module_id text REFERENCES modules);
    CREATE TABLE tenant_module_overrides (tenant_id uuid, module_id text REFERENCES modules, is_enabled boolean);
    CREATE TABLE tenant_module_subscriptions (tenant_id uuid, module_id text REFERENCES modules);

    CREATE FUNCTION is_platform_admin() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN RETURN EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid() AND is_active = true); END;
    $$;
  `);

  await db.exec(file('supabase-migrations/159_internal_modules_for_platform_owner_tenant.sql'));
}, 30000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(
    'TRUNCATE tenants, user_profiles, platform_admins, modules, subscription_plan_modules, tenant_module_overrides, tenant_module_subscriptions CASCADE'
  );
  await db.query("INSERT INTO tenants (id, subscription_plan) VALUES ($1, 'free'), ($2, 'free')", [
    seedTenant,
    customerTenant,
  ]);
  await db.query(
    `INSERT INTO user_profiles (id, tenant_id, role) VALUES
       ($1, $4, 'owner'), ($2, $4, 'employee'), ($3, $5, 'owner')`,
    [seth, ava, customerOwner, seedTenant, customerTenant]
  );
  await db.query('INSERT INTO platform_admins (id) VALUES ($1)', [seth]);
  await db.query(
    "INSERT INTO modules (id, rollout_status) VALUES ('ga-feature', 'ga'), ('beta-feature', 'beta'), ('internal-feature', 'internal')"
  );
  await db.query(
    "INSERT INTO subscription_plan_modules (plan_id, module_id) VALUES ('free', 'ga-feature'), ('free', 'beta-feature'), ('free', 'internal-feature')"
  );
});

describe('internal/beta module visibility', () => {
  it("unlocks internal modules for an ordinary employee of the platform creator's tenant", async () => {
    const modules = await enabledModulesFor(seedTenant, ava);
    expect(modules).toContain('internal-feature');
    expect(modules).toContain('beta-feature');
  });

  it('still unlocks internal modules for the platform-admin owner themself', async () => {
    const modules = await enabledModulesFor(seedTenant, seth);
    expect(modules).toContain('internal-feature');
  });

  it("does not unlock internal modules for another tenant's owner", async () => {
    const modules = await enabledModulesFor(customerTenant, customerOwner);
    expect(modules).not.toContain('internal-feature');
    expect(modules).not.toContain('beta-feature');
  });

  it('ga modules are visible to everyone regardless of tenant', async () => {
    expect(await enabledModulesFor(customerTenant, customerOwner)).toContain('ga-feature');
    expect(await enabledModulesFor(seedTenant, ava)).toContain('ga-feature');
  });

  it("a platform admin who only joined a tenant as a non-owner does not unlock it for that tenant's other members", async () => {
    // A platform admin supporting a customer tenant as a plain employee
    // still personally sees internal features (caller_is_admin), but must
    // not grant that tenant's OTHER members the same unlock — only the
    // tenant the admin actually owns qualifies.
    const supportAdmin = '00000000-0000-0000-0000-000000000004';
    await db.query('INSERT INTO user_profiles (id, tenant_id, role) VALUES ($1, $2, $3)', [
      supportAdmin,
      customerTenant,
      'employee',
    ]);
    await db.query('INSERT INTO platform_admins (id) VALUES ($1)', [supportAdmin]);

    expect(await enabledModulesFor(customerTenant, supportAdmin)).toContain('internal-feature');
    expect(await enabledModulesFor(customerTenant, customerOwner)).not.toContain('internal-feature');
  });
});
