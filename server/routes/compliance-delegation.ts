import type { Express, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db';
import { getUserIdFromRequest } from './core';
import { timingSafeTokenMatch, parseAllowedTenantIds } from '../service-auth-core';
import { complianceScope } from './compliance';
import { workflowCommand, complianceFingerprint, complianceRenewalDate } from '../compliance-workflow-core';
import logger from '../logger';
class WorkflowConflict extends Error {}

async function relayIdentity(req: Request, res: Response) {
  const { userId } = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const result = await db.execute(
    sql`SELECT id,tenant_id,full_name FROM user_profiles WHERE id=${userId}::uuid AND is_active=true`
  );
  const row = result.rows[0] as { id: string; tenant_id: string; full_name: string } | undefined;
  if (!row) {
    res.status(403).json({ error: 'Active business account required' });
    return null;
  }
  const requested = req.query.tenant_id ?? req.body?.tenant_id;
  if (requested && requested !== row.tenant_id) {
    res.status(403).json({ error: 'Business not authorized' });
    return null;
  }
  return { tenant_id: row.tenant_id, actor_id: row.id, actor_name: row.full_name };
}
async function relay(path: string, identity: Record<string, string>, body?: Record<string, unknown>) {
  const base = process.env.LEGAL_COMPLIANCE_URL,
    token = process.env.LEGAL_COMPLIANCE_RELAY_TOKEN;
  if (!base || !token) throw new Error('Compliance submission unavailable');
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid compliance hub');
  const target = new URL('/api/compliance/relay' + path, url);
  if (!body) for (const [k, v] of Object.entries(identity)) target.searchParams.set(k, v);
  return fetch(target, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Compliance-Relay-Token': token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify({ ...body, ...identity }) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
}
export function registerComplianceDelegationRoutes(app: Express) {
  app.get('/api/integrations/compliance/people', async (req, res) => {
    const scope = complianceScope(req);
    const tenant = req.query.tenant_id;
    if (!scope) return res.status(401).json({ error: 'Unauthorized' });
    if (typeof tenant !== 'string' || !scope.includes(tenant))
      return res.status(403).json({ error: 'Business not authorized' });
    const people = await db.execute(
      sql`SELECT id,full_name name FROM user_profiles WHERE tenant_id=${tenant}::uuid AND is_active=true ORDER BY full_name`
    );
    return res.json({ business_id: tenant, people: people.rows });
  });
  app.get('/api/compliance/work', async (req, res) => {
    try {
      const identity = await relayIdentity(req, res);
      if (!identity) return;
      if (!process.env.LEGAL_COMPLIANCE_RELAY_TOKEN) return res.json({ duties: [], configured: false });
      const response = await relay('/work', identity);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(response.status).json(await response.json());
    } catch {
      return res.status(503).json({ error: 'Assigned compliance duties are temporarily unavailable.' });
    }
  });
  app.post('/api/compliance/work/:id/submit', async (req, res) => {
    try {
      const identity = await relayIdentity(req, res);
      if (!identity) return;
      const response = await relay(`/work/${encodeURIComponent(req.params.id)}/submit`, identity, req.body || {});
      return res.status(response.status).json(await response.json());
    } catch {
      return res.status(503).json({ error: 'Submission unavailable. Your duty has not been marked complete.' });
    }
  });
  app.post('/api/integrations/compliance/workflow', async (req, res) => {
    if (!timingSafeTokenMatch(req.headers['x-compliance-workflow-token'], process.env.COMPLIANCE_WORKFLOW_TOKEN))
      return res.status(401).json({ error: 'Unauthorized' });
    const parsed = workflowCommand.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow command' });
    const p = parsed.data;
    const scope = parseAllowedTenantIds(
      process.env.COMPLIANCE_ALLOWED_TENANT_IDS ?? process.env.ALFRED_ALLOWED_TENANT_IDS
    );
    if (!scope.includes(p.tenant_id)) return res.status(403).json({ error: 'Business not authorized' });
    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${p.tenant_id}),hashtext(${p.record_id}))`);
        const old = await tx.execute(
          sql`SELECT response FROM compliance_workflow_receipts WHERE event_id=${p.event_id}::uuid AND tenant_id=${p.tenant_id}::uuid AND task_id=${p.record_id}::uuid`
        );
        if (old.rows[0]) return (old.rows[0] as { response: unknown }).response;
        const records = await tx.execute(
          sql`SELECT id,title,description notes,to_char(due_date,'YYYY-MM-DD') due_date,recurrence,status,category_id,created_by,priority,is_admin_only FROM admin_tasks WHERE id=${p.record_id}::uuid AND tenant_id=${p.tenant_id}::uuid FOR UPDATE`
        );
        const record = records.rows[0] as
          | {
              id: string;
              title: string;
              notes: string | null;
              due_date: string;
              recurrence: string;
              status: string;
              category_id: string;
              created_by: string;
              priority: string;
              is_admin_only: boolean;
            }
          | undefined;
        if (!record || complianceFingerprint(record) !== p.expected_fingerprint) throw new WorkflowConflict();
        const links = await tx.execute(
          sql`SELECT * FROM compliance_workflow_links WHERE task_id=${p.record_id}::uuid FOR UPDATE`
        );
        const link = links.rows[0] as
          | {
              obligation_id: string;
              parent_obligation_id: string;
              is_placeholder: boolean;
              revision: number;
              assignee_id: string | null;
            }
          | undefined;
        if (
          link &&
          link.obligation_id !== p.obligation_id &&
          !(p.action === 'bind' && link.is_placeholder && link.parent_obligation_id === p.parent_obligation_id)
        )
          throw new WorkflowConflict();
        if (link && link.revision > p.revision) throw new WorkflowConflict();
        let nextRecordId: string | null = null;
        if (p.action === 'bind') {
          if (record.status === 'completed' || record.status === 'cancelled') throw new WorkflowConflict();
          if (p.assignee_id) {
            const member = await tx.execute(
              sql`SELECT 1 FROM user_profiles WHERE id=${p.assignee_id}::uuid AND tenant_id=${p.tenant_id}::uuid AND is_active=true`
            );
            if (!member.rows.length) throw new WorkflowConflict();
          }
          await tx.execute(sql`INSERT INTO compliance_workflow_links(task_id,tenant_id,obligation_id,parent_obligation_id,is_placeholder,revision,owner_name,assignee_id,evidence_requirements)
            VALUES(${p.record_id}::uuid,${p.tenant_id}::uuid,${p.obligation_id}::uuid,${p.parent_obligation_id ?? null}::uuid,false,${p.revision},${p.owner_name},${p.assignee_id}::uuid,${p.evidence_requirements})
            ON CONFLICT(task_id) DO UPDATE SET obligation_id=excluded.obligation_id,parent_obligation_id=excluded.parent_obligation_id,is_placeholder=false,revision=excluded.revision,owner_name=excluded.owner_name,assignee_id=excluded.assignee_id,evidence_requirements=excluded.evidence_requirements`);
          await tx.execute(
            sql`UPDATE admin_tasks SET assigned_to=${record.is_admin_only ? null : p.assignee_id}::uuid WHERE id=${p.record_id}::uuid AND tenant_id=${p.tenant_id}::uuid`
          );
        } else {
          if (
            !link ||
            link.is_placeholder ||
            link.obligation_id !== p.obligation_id ||
            p.revision <= link.revision ||
            record.status === 'completed' ||
            record.status === 'cancelled'
          )
            throw new WorkflowConflict();
          await tx.execute(sql`SELECT set_config('cms.compliance_verified','on',true)`);
          await tx.execute(
            sql`UPDATE admin_tasks SET status='completed',completed_at=NOW(),updated_at=NOW() WHERE id=${p.record_id}::uuid AND tenant_id=${p.tenant_id}::uuid`
          );
          await tx.execute(
            sql`UPDATE compliance_workflow_links SET revision=${p.revision} WHERE task_id=${p.record_id}::uuid`
          );
          if (record.recurrence !== 'none') {
            const children = await tx.execute(
              sql`SELECT id FROM admin_tasks WHERE parent_task_id=${p.record_id}::uuid AND tenant_id=${p.tenant_id}::uuid ORDER BY created_at LIMIT 1`
            );
            nextRecordId = (children.rows[0] as { id: string } | undefined)?.id ?? crypto.randomUUID();
            if (!children.rows.length) {
              const nextDue = complianceRenewalDate(record.due_date, record.recurrence);
              const member = p.assignee_id
                ? await tx.execute(
                    sql`SELECT id FROM user_profiles WHERE id=${p.assignee_id}::uuid AND tenant_id=${p.tenant_id}::uuid AND is_active=true`
                  )
                : null;
              const nextAssignee = member?.rows.length ? p.assignee_id : null;
              await tx.execute(sql`INSERT INTO admin_tasks(id,tenant_id,title,description,category_id,assigned_to,created_by,priority,due_date,recurrence,parent_task_id,is_admin_only)
                VALUES(${nextRecordId}::uuid,${p.tenant_id}::uuid,${record.title},${record.notes},${record.category_id}::uuid,${record.is_admin_only ? null : nextAssignee}::uuid,${record.created_by}::uuid,${record.priority}::task_priority,${nextDue}::date,${record.recurrence}::recurrence_type,${p.record_id}::uuid,${record.is_admin_only})`);
              await tx.execute(sql`INSERT INTO compliance_workflow_links(task_id,tenant_id,obligation_id,parent_obligation_id,is_placeholder,revision,owner_name,assignee_id,evidence_requirements)
                VALUES(${nextRecordId}::uuid,${p.tenant_id}::uuid,${p.obligation_id}::uuid,${p.obligation_id}::uuid,true,0,${p.owner_name},${nextAssignee}::uuid,${p.evidence_requirements})`);
            }
          }
        }
        const response = {
          status: 'applied',
          event_id: p.event_id,
          obligation_id: p.obligation_id,
          next_record_id: nextRecordId,
        };
        await tx.execute(
          sql`INSERT INTO compliance_workflow_receipts(event_id,tenant_id,task_id,response) VALUES(${p.event_id}::uuid,${p.tenant_id}::uuid,${p.record_id}::uuid,${JSON.stringify(response)}::jsonb)`
        );
        return response;
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof WorkflowConflict)
        return res
          .status(409)
          .json({ error: 'source_changed', message: 'The deadline or assignment changed. Review it before retrying.' });
      logger.error({ err: error }, 'Compliance workflow command failed');
      return res.status(503).json({
        error: 'workflow_unavailable',
        message: 'Compliance workflow unavailable. Check migration 163 and the connection.',
      });
    }
  });
}
