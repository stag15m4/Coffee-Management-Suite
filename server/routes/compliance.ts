import type { Express, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { parseAllowedTenantIds, timingSafeTokenMatch } from '../service-auth-core';
import logger from '../logger';

// pg parses PostgreSQL DATE as local-midnight Date objects. Preserve the civil
// components instead of slicing Date.toString() or converting it through UTC.
export function formatComplianceDate(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

// A separate read-only credential: Legal never receives Alfred's write access.
export function complianceScope(req: Request): string[] | null {
  if (!timingSafeTokenMatch(req.headers['x-compliance-token'], process.env.COMPLIANCE_SERVICE_TOKEN)) return null;
  return parseAllowedTenantIds(process.env.COMPLIANCE_ALLOWED_TENANT_IDS ?? process.env.ALFRED_ALLOWED_TENANT_IDS);
}

export function registerComplianceRoutes(app: Express) {
  const guard = (req: Request, res: Response) => {
    const ids = complianceScope(req);
    if (!ids) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    if (!ids.length) {
      res.status(403).json({ error: 'No businesses authorized' });
      return null;
    }
    res.setHeader('Cache-Control', 'no-store');
    return ids;
  };
  app.get('/api/integrations/compliance/tenants', async (req, res) => {
    const ids = guard(req, res);
    if (!ids) return;
    try {
      const rows = await db.execute(
        sql`SELECT id, name FROM tenants WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`, `
        )}) ORDER BY name`
      );
      res.json({ businesses: rows.rows });
    } catch (error) {
      logger.error({ err: error }, 'Compliance business lookup failed');
      res.status(500).json({ error: 'Business lookup failed' });
    }
  });
  app.get('/api/integrations/compliance', async (req, res) => {
    const ids = guard(req, res);
    if (!ids) return;
    const tenant = req.query.tenant_id;
    if (typeof tenant !== 'string' || !ids.includes(tenant)) {
      res.status(403).json({ error: 'Business not authorized' });
      return;
    }
    try {
      // Repeatable read keeps the paged snapshot internally consistent.
      const rows = await db.transaction(async (tx) => {
        await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
        return tx.execute(sql`SELECT t.id, t.title, t.description, t.due_date, t.status,
          t.completed_at, t.recurrence, t.updated_at, t.assigned_to
          FROM admin_tasks t JOIN admin_task_categories c ON c.id = t.category_id AND c.tenant_id = t.tenant_id
          WHERE t.tenant_id = ${tenant}::uuid AND lower(c.name) = 'compliance'
          AND t.due_date IS NOT NULL ORDER BY t.id LIMIT 10001`);
      });
      if (rows.rows.length > 10000) {
        res.status(413).json({ error: 'Compliance snapshot too large' });
        return;
      }
      res.json({
        version: 1,
        complete: true,
        business_id: tenant,
        deadlines: rows.rows.map((raw) => {
          const r = raw as Record<string, unknown>;
          return {
            id: r.id,
            title: r.title,
            notes: r.description,
            due_date: formatComplianceDate(r.due_date),
            status: r.status,
            completed_date: r.completed_at ? new Date(String(r.completed_at)).toISOString().slice(0, 10) : null,
            recurrence: r.recurrence,
            updated_at: r.updated_at,
            deadline_type: 'other',
            source_path: '/admin-tasks',
          };
        }),
      });
    } catch (error) {
      logger.error({ err: error }, 'Compliance snapshot failed');
      res.status(500).json({ error: 'Compliance snapshot failed' });
    }
  });
}
