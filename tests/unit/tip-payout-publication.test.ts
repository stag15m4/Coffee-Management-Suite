import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tenant = '00000000-0000-0000-0000-000000000001';
const manager = '00000000-0000-0000-0000-000000000002';
const staff = '00000000-0000-0000-0000-000000000003';
const tip = '00000000-0000-0000-0000-000000000004';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE user_profiles(id uuid PRIMARY KEY, tenant_id uuid, role text, is_active boolean DEFAULT true);
    CREATE FUNCTION can_access_tenant(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION has_role_or_higher(text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE TABLE tip_employees(id uuid PRIMARY KEY, tenant_id uuid, name text, is_active boolean,tip_eligible boolean,user_profile_id uuid);
    CREATE TABLE tip_weekly_data(tenant_id uuid,week_key date,cash_tips numeric,cc_tips numeric,cash_entries jsonb,cc_entries jsonb);
    CREATE TABLE tip_employee_hours(tenant_id uuid,week_key date,employee_id uuid,hours numeric);
    CREATE TABLE tip_payout_approvals(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,week_key date,
      cash_tips numeric,cc_tips numeric,cc_fee_rate numeric,total_pool numeric,total_hours numeric,
      hourly_rate numeric,distribution_method text,employee_payouts jsonb,calculated_by uuid,
      calculated_at timestamptz,approved_by uuid,approved_at timestamptz,status text,updated_at timestamptz,
      CONSTRAINT uq_tip_payout_approvals_tenant_week UNIQUE(tenant_id,week_key));
    ALTER TABLE tip_payout_approvals ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view tip payout approvals" ON tip_payout_approvals FOR SELECT USING(true);
    GRANT SELECT,INSERT,UPDATE,DELETE ON tip_payout_approvals TO authenticated;
    INSERT INTO tenants VALUES('${tenant}');
    INSERT INTO user_profiles(id,tenant_id,role) VALUES('${manager}','${tenant}','manager'),('${staff}','${tenant}','employee');
    INSERT INTO tip_employees VALUES('${tip}','${tenant}','Worker',true,true,'${staff}');
    INSERT INTO tip_weekly_data VALUES('${tenant}','2026-09-28',10,20,'[]','[]');
    INSERT INTO tip_employee_hours VALUES('${tenant}','2026-09-28','${tip}',10);
    INSERT INTO tip_payout_approvals(tenant_id,week_key,employee_payouts,status)
      VALUES('${tenant}','2026-09-28','[{"employee_id":"${tip}","payout":29.30,"hours":10}]','approved');
  `);
  await db.exec(
    readFileSync(new URL('../../supabase-migrations/154_tip_payout_publication.sql', import.meta.url), 'utf8')
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe('tip payout publication', () => {
  it('creates the approval baseline when migration 141 was not previously applied', async () => {
    const fresh = new PGlite();
    try {
      await fresh.exec(`
        CREATE ROLE authenticated; CREATE ROLE anon;
        CREATE TABLE tenants(id uuid PRIMARY KEY);
        CREATE TABLE user_profiles(id uuid PRIMARY KEY);
        CREATE TABLE tip_employees(id uuid PRIMARY KEY, tenant_id uuid, is_active boolean,tip_eligible boolean,name text,user_profile_id uuid);
        CREATE TABLE tip_weekly_data(tenant_id uuid,week_key date,cash_tips numeric,cc_tips numeric,cash_entries jsonb,cc_entries jsonb);
        CREATE TABLE tip_employee_hours(tenant_id uuid,week_key date,employee_id uuid,hours numeric);
        CREATE FUNCTION can_access_tenant(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true';
        CREATE FUNCTION has_role_or_higher(text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
      `);
      await fresh.exec(
        readFileSync(new URL('../../supabase-migrations/154_tip_payout_publication.sql', import.meta.url), 'utf8')
      );
      expect((await fresh.query("SELECT to_regclass('public.tip_payout_approvals') AS tbl")).rows[0]).toMatchObject({
        tbl: 'tip_payout_approvals',
      });
    } finally {
      await fresh.close();
    }
  });
  it('revokes browser approval writes and broad reads', async () => {
    const policies = await db.query<{ policyname: string }>(
      "SELECT policyname FROM pg_policies WHERE tablename='tip_payout_approvals'"
    );
    expect(policies.rows.map((p) => p.policyname)).toEqual(['Managers read tip payout approvals']);
    await db.exec('SET ROLE authenticated');
    try {
      await expect(db.query("UPDATE tip_payout_approvals SET status='approved'")).rejects.toThrow('permission denied');
    } finally {
      await db.exec('RESET ROLE');
    }
  });
  it('invalidates an approved week when imported hours change and preserves the old snapshot', async () => {
    await db.exec("UPDATE tip_employee_hours SET hours=12 WHERE week_key='2026-09-28'");
    expect((await db.query<{ status: string }>('SELECT status FROM tip_payout_approvals')).rows[0].status).toBe(
      'rejected'
    );
    const history = await db.query<{ previous_record: { status: string } }>(
      'SELECT previous_record FROM tip_payout_approval_history'
    );
    expect(history.rows[0].previous_record.status).toBe('approved');
    await db.exec("UPDATE tip_payout_approvals SET status='approved',total_hours=12 WHERE week_key='2026-09-28'");
    expect((await db.query('SELECT * FROM tip_payout_approval_history')).rows).toHaveLength(2);
    await db.exec("DELETE FROM tip_employee_hours WHERE week_key='2026-09-28'");
    expect((await db.query<{ status: string }>('SELECT status FROM tip_payout_approvals')).rows[0].status).toBe(
      'rejected'
    );
  });
});
