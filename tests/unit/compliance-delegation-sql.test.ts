import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { complianceFingerprint, complianceRenewalDate, workflowCommand } from '../../server/compliance-workflow-core';
let db: PGlite;
const tenant = '00000000-0000-0000-0000-000000000001';
const task = '00000000-0000-0000-0000-000000000002';
const child = '00000000-0000-0000-0000-000000000003';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE TABLE tenants(id UUID PRIMARY KEY); CREATE TABLE user_profiles(id UUID PRIMARY KEY);
 CREATE TABLE admin_tasks(id UUID PRIMARY KEY,tenant_id UUID,parent_task_id UUID,status TEXT,title TEXT,description TEXT,due_date DATE,recurrence TEXT);
 CREATE FUNCTION can_read_tenant_data(UUID) RETURNS boolean LANGUAGE sql AS 'SELECT true';
 INSERT INTO tenants VALUES ('${tenant}');
 INSERT INTO admin_tasks VALUES ('${task}','${tenant}',NULL,'pending','PCI',NULL,'2027-10-27','yearly');`);
  await db.exec(readFileSync('supabase-migrations/163_compliance_delegation.sql', 'utf8'));
  await db.exec(
    `INSERT INTO compliance_workflow_links(task_id,tenant_id,obligation_id,revision,owner_name,evidence_requirements) VALUES('${task}','${tenant}',gen_random_uuid(),1,'Owner','Renewal receipt');`
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe('verified compliance database boundary', () => {
  it('blocks direct completion, cancellation, deletion, and premature renewal', async () => {
    for (const status of ['completed', 'cancelled', 'in_progress'])
      await expect(db.query('UPDATE admin_tasks SET status=$1 WHERE id=$2', [status, task])).rejects.toThrow(
        'owner verification'
      );
    await expect(db.query('DELETE FROM admin_tasks WHERE id=$1', [task])).rejects.toThrow('verification history');
    await expect(db.query('INSERT INTO admin_tasks(id,parent_task_id) VALUES($1,$2)', [child, task])).rejects.toThrow(
      'verified completion'
    );
  });
  it('allows edits while open, then locks verified details and reopening', async () => {
    await db.query('UPDATE admin_tasks SET due_date=$1 WHERE id=$2', ['2027-11-27', task]);
    await db.exec(
      `BEGIN; SELECT set_config('cms.compliance_verified','on',true); UPDATE admin_tasks SET status='completed' WHERE id='${task}'; INSERT INTO admin_tasks(id,parent_task_id,status) VALUES('${child}','${task}','pending'); COMMIT;`
    );
    await expect(db.query('UPDATE admin_tasks SET due_date=$1 WHERE id=$2', ['2028-01-01', task])).rejects.toThrow(
      'owner verification'
    );
    await expect(db.query('UPDATE admin_tasks SET status=$1 WHERE id=$2', ['pending', task])).rejects.toThrow(
      'owner verification'
    );
    const policies = await db.query<{ tablename: string; cmd: string }>(
      "SELECT tablename,cmd FROM pg_policies WHERE tablename LIKE 'compliance_workflow_%'"
    );
    expect(policies.rows).toEqual([{ tablename: 'compliance_workflow_links', cmd: 'SELECT' }]);
  });
  it('matches the shared contract, renewal rules, and fails closed on malformed commands', () => {
    const fixture = JSON.parse(readFileSync('docs/compliance-workflow-v1.json', 'utf8'));
    for (const vector of fixture.fingerprints) expect(complianceFingerprint(vector)).toBe(vector.fingerprint);
    expect(complianceRenewalDate('2028-02-29', 'yearly')).toBe('2029-02-28');
    expect(complianceRenewalDate('2027-01-31', 'monthly')).toBe('2027-02-28');
    expect(workflowCommand.safeParse({ action: 'verify', tenant_id: tenant }).success).toBe(false);
  });
});
