import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import express from 'express';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock('../../server/db', () => ({ db: state }));
vi.mock('../../server/routes/core', () => ({
  getUserIdFromRequest: async (req: Request) => ({
    userId: req.headers.authorization === 'Bearer valid-user' ? '10000000-0000-4000-8000-000000000001' : null,
  }),
}));
import { registerComplianceDelegationRoutes } from '../../server/routes/compliance-delegation';
import { complianceFingerprint } from '../../server/compliance-workflow-core';
const app = express();
registerComplianceDelegationRoutes(app);
let database: PGlite;
const tenant = '10000000-0000-4000-8000-000000000002';
const task = '10000000-0000-4000-8000-000000000003';
const worker = '10000000-0000-4000-8000-000000000001';
const obligation = '10000000-0000-4000-8000-000000000004';
const event = '10000000-0000-4000-8000-000000000005';
async function call(
  method: string,
  path: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  query: Record<string, string> = {}
) {
  const router = app as unknown as {
    _router: {
      stack: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: (req: Request, res: Response) => unknown }>;
        };
      }>;
    };
  };
  const layer = router._router.stack.find((x) => x.route?.path === path && x.route.methods[method.toLowerCase()]);
  if (!layer?.route) throw new Error('No route');
  let status = 200;
  let output: unknown;
  const res = {
    status: (code: number) => {
      status = code;
      return res;
    },
    json: (data: unknown) => {
      output = data;
      return res;
    },
    setHeader: () => res,
  } as unknown as Response;
  await layer.route.stack[0].handle({ headers, body, query, params: { id: obligation } } as unknown as Request, res);
  return { status, data: output as Record<string, unknown> };
}
beforeAll(async () => {
  vi.stubEnv('COMPLIANCE_WORKFLOW_TOKEN', 'write-key');
  vi.stubEnv('COMPLIANCE_SERVICE_TOKEN', 'read-key');
  vi.stubEnv('COMPLIANCE_ALLOWED_TENANT_IDS', tenant);
  vi.stubEnv('LEGAL_COMPLIANCE_URL', 'https://legal.example');
  vi.stubEnv('LEGAL_COMPLIANCE_RELAY_TOKEN', 'relay-key');
  database = new PGlite();
  const dialect = new PgDialect();
  state.execute.mockImplementation(async (sql: SQL) => {
    const q = dialect.sqlToQuery(sql);
    return database.query(q.sql, q.params);
  });
  state.transaction.mockImplementation(async (fn: (tx: typeof state) => Promise<unknown>) => {
    await database.exec('BEGIN');
    try {
      const result = await fn(state);
      await database.exec('COMMIT');
      return result;
    } catch (e) {
      await database.exec('ROLLBACK');
      throw e;
    }
  });
  await database.exec(`CREATE TYPE task_priority AS ENUM('medium'); CREATE TYPE recurrence_type AS ENUM('none','yearly');
 CREATE TABLE tenants(id UUID PRIMARY KEY); CREATE TABLE user_profiles(id UUID PRIMARY KEY,tenant_id UUID,full_name TEXT,is_active BOOL);
 CREATE TABLE admin_tasks(id UUID PRIMARY KEY,tenant_id UUID,title TEXT,description TEXT,category_id UUID,assigned_to UUID,created_by UUID,priority task_priority DEFAULT 'medium',due_date DATE,recurrence recurrence_type,status TEXT DEFAULT 'pending',parent_task_id UUID,is_admin_only BOOL DEFAULT false,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW(),completed_at TIMESTAMPTZ);
 CREATE FUNCTION can_read_tenant_data(UUID) RETURNS boolean LANGUAGE sql AS 'SELECT true';
 INSERT INTO tenants VALUES('${tenant}');INSERT INTO user_profiles VALUES('${worker}','${tenant}','Actual manager',true);
 INSERT INTO admin_tasks(id,tenant_id,title,due_date,recurrence,created_by) VALUES('${task}','${tenant}','PCI','2027-10-27','yearly','${worker}');`);
  await database.exec(readFileSync('supabase-migrations/163_compliance_delegation.sql', 'utf8'));
}, 30000);
afterAll(async () => {
  await database?.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const command = {
  version: 1,
  event_id: event,
  obligation_id: obligation,
  parent_obligation_id: null,
  revision: 1,
  action: 'bind',
  tenant_id: tenant,
  record_id: task,
  expected_fingerprint: complianceFingerprint({ title: 'PCI', due_date: '2027-10-27', recurrence: 'yearly' }),
  owner_name: 'Owner',
  assignee_id: worker,
  evidence_requirements: 'Upload receipt',
};
it('separates read/write credentials and scopes source commands', async () => {
  expect(
    (await call('POST', '/api/integrations/compliance/workflow', command, { 'x-compliance-token': 'read-key' })).status
  ).toBe(401);
  expect(
    (
      await call(
        'POST',
        '/api/integrations/compliance/workflow',
        { ...command, tenant_id: obligation },
        { 'x-compliance-workflow-token': 'write-key' }
      )
    ).status
  ).toBe(403);
  expect(
    (
      await call(
        'POST',
        '/api/integrations/compliance/workflow',
        { ...command, expected_fingerprint: '0'.repeat(64) },
        { 'x-compliance-workflow-token': 'write-key' }
      )
    ).status
  ).toBe(409);
});
it('applies bind and verification atomically and retries without duplicate renewals', async () => {
  const header = { 'x-compliance-workflow-token': 'write-key' };
  expect((await call('POST', '/api/integrations/compliance/workflow', command, header)).status).toBe(200);
  const verification = { ...command, event_id: '10000000-0000-4000-8000-000000000006', action: 'verify', revision: 3 };
  const first = await call('POST', '/api/integrations/compliance/workflow', verification, header);
  expect(first.status).toBe(200);
  expect((await call('POST', '/api/integrations/compliance/workflow', verification, header)).data).toEqual(first.data);
  const children = await database.query<{ id: string }>('SELECT id FROM admin_tasks WHERE parent_task_id=$1', [task]);
  expect(children.rows).toHaveLength(1);
  await expect(
    database.query('UPDATE admin_tasks SET status=$1 WHERE id=$2', ['completed', children.rows[0].id])
  ).rejects.toThrow('owner verification');
  const childBinding = {
    ...command,
    event_id: '10000000-0000-4000-8000-000000000007',
    obligation_id: '10000000-0000-4000-8000-000000000008',
    parent_obligation_id: obligation,
    record_id: children.rows[0].id,
    expected_fingerprint: complianceFingerprint({ title: 'PCI', due_date: '2028-10-27', recurrence: 'yearly' }),
  };
  expect((await call('POST', '/api/integrations/compliance/workflow', childBinding, header)).status).toBe(200);
});
it('derives relay identity from the active account and ignores browser impersonation', async () => {
  const fetcher = vi.fn(async () => ({ status: 200, json: async () => ({ status: 'submitted' }) }));
  vi.stubGlobal('fetch', fetcher);
  expect((await call('GET', '/api/compliance/work', {}, {})).status).toBe(401);
  expect(
    (await call('GET', '/api/compliance/work', {}, { authorization: 'Bearer valid-user' }, { tenant_id: obligation }))
      .status
  ).toBe(403);
  expect(
    (
      await call(
        'POST',
        '/api/compliance/work/:id/submit',
        { tenant_id: tenant, actor_id: 'spoof', actor_name: 'Spoof', notes: 'Evidence', revision: 1 },
        { authorization: 'Bearer valid-user' }
      )
    ).status
  ).toBe(200);
  const args = fetcher.mock.calls[0] as unknown as [URL, { body: string; headers: Record<string, string> }];
  const payload = JSON.parse(args[1].body);
  expect(payload.actor_id).toBe(worker);
  expect(payload.actor_name).toBe('Actual manager');
  expect(payload.tenant_id).toBe(tenant);
  await database.query('UPDATE user_profiles SET is_active=false WHERE id=$1', [worker]);
  expect((await call('GET', '/api/compliance/work', {}, { authorization: 'Bearer valid-user' })).status).toBe(403);
});
