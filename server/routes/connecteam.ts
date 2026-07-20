/**
 * Connecteam integration routes (manager+ only, tenant-scoped).
 * The API key is write-only from the client's perspective: it is stored in
 * connecteam_settings (no client RLS access) and never returned by any route.
 */
import type { Express, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import logger from '../logger';
import { getUserIdFromRequest, ROLE_HIERARCHY } from './core';
import {
  validateApiKey,
  listTimeClocks,
  listUsers,
  syncHoursForTenant,
  ConnecteamRateLimitError,
} from '../connecteamService';

/** Auth guard: session user must be manager+ in the requested tenant. */
async function requireManagerForTenant(req: Request, res: Response, tenantId: string): Promise<string | null> {
  const { userId } = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const profileResult = await db.execute(
    sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
  );
  const profile = profileResult.rows[0] as any;
  if (!profile || profile.tenant_id !== tenantId) {
    res.status(403).json({ error: 'Not authorized for this tenant' });
    return null;
  }
  if ((ROLE_HIERARCHY[profile.role] ?? 0) < ROLE_HIERARCHY['manager']) {
    res.status(403).json({ error: 'Requires manager or owner role' });
    return null;
  }
  return userId;
}

const connectSchema = z.object({ tenantId: z.string().uuid(), apiKey: z.string().min(10) });
const configSchema = z.object({
  tenantId: z.string().uuid(),
  timeClockId: z.string().optional(),
  syncEnabled: z.boolean().optional(),
});
const mappingsSchema = z.object({
  tenantId: z.string().uuid(),
  mappings: z
    .array(
      z.object({
        connecteam_user_id: z.string(),
        connecteam_user_name: z.string(),
        tip_employee_id: z.string().uuid().nullable(),
        status: z.enum(['suggested', 'confirmed', 'ignored']),
      })
    )
    .max(200),
});
const syncSchema = z.object({
  tenantId: z.string().uuid(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export function registerConnecteamRoutes(app: Express): void {
  // Connection status — never includes the API key
  app.get('/api/connecteam/status/:tenantId', async (req, res) => {
    try {
      const tenantId = req.params.tenantId;
      if (!(await requireManagerForTenant(req, res, tenantId))) return;

      const [settingsResult, tenantResult, mappingResult] = await Promise.all([
        db.execute(
          sql`SELECT time_clock_id, rate_limited_until FROM connecteam_settings WHERE tenant_id = ${tenantId}::uuid LIMIT 1`
        ),
        db.execute(
          sql`SELECT connecteam_sync_enabled, connecteam_last_sync_at FROM tenants WHERE id = ${tenantId}::uuid`
        ),
        db.execute(sql`
          SELECT status, COUNT(*)::int AS count FROM connecteam_employee_mappings
          WHERE tenant_id = ${tenantId}::uuid GROUP BY status
        `),
      ]);
      const settings = settingsResult.rows[0] as any;
      const tenant = tenantResult.rows[0] as any;
      const mappingCounts: Record<string, number> = {};
      for (const row of mappingResult.rows as any[]) mappingCounts[row.status] = row.count;

      res.json({
        connected: !!settings,
        timeClockId: settings?.time_clock_id ?? null,
        syncEnabled: tenant?.connecteam_sync_enabled ?? false,
        lastSyncAt: tenant?.connecteam_last_sync_at ?? null,
        rateLimitedUntil:
          settings?.rate_limited_until && new Date(settings.rate_limited_until) > new Date()
            ? settings.rate_limited_until
            : null,
        mappingCounts,
      });
    } catch (err) {
      logger.error({ err }, 'Error in connecteam status');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Connect: validate the key against /me, store it, return available time clocks
  app.post('/api/connecteam/connect', async (req, res) => {
    try {
      const body = connectSchema.parse(req.body);
      if (!(await requireManagerForTenant(req, res, body.tenantId))) return;

      await validateApiKey(body.apiKey, body.tenantId); // throws on bad key
      const timeClocks = await listTimeClocks(body.apiKey, body.tenantId);

      await db.execute(sql`
        INSERT INTO connecteam_settings (tenant_id, api_key, time_clock_id)
        VALUES (${body.tenantId}::uuid, ${body.apiKey}, ${timeClocks.length === 1 ? timeClocks[0].id : null})
        ON CONFLICT (tenant_id)
        DO UPDATE SET api_key = ${body.apiKey}, updated_at = NOW()
      `);

      res.json({ connected: true, timeClocks });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      if (err instanceof ConnecteamRateLimitError)
        return res.status(429).json({ error: err.message, retryAt: err.retryAt.toISOString() });
      if (String(err.message).includes('Connecteam API 401'))
        return res.status(400).json({ error: 'Invalid API key — check it in Connecteam admin > Settings > API' });
      logger.error({ err }, 'Error in connecteam connect');
      res.status(500).json({ error: 'Could not connect to Connecteam' });
    }
  });

  // Config: choose time clock / toggle scheduled sync
  app.post('/api/connecteam/config', async (req, res) => {
    try {
      const body = configSchema.parse(req.body);
      if (!(await requireManagerForTenant(req, res, body.tenantId))) return;

      if (body.timeClockId !== undefined) {
        await db.execute(sql`
          UPDATE connecteam_settings SET time_clock_id = ${body.timeClockId}, updated_at = NOW()
          WHERE tenant_id = ${body.tenantId}::uuid
        `);
      }
      if (body.syncEnabled !== undefined) {
        await db.execute(sql`
          UPDATE tenants SET connecteam_sync_enabled = ${body.syncEnabled} WHERE id = ${body.tenantId}::uuid
        `);
      }
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      logger.error({ err }, 'Error in connecteam config');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/connecteam/disconnect', async (req, res) => {
    try {
      const body = z.object({ tenantId: z.string().uuid() }).parse(req.body);
      if (!(await requireManagerForTenant(req, res, body.tenantId))) return;

      await db.execute(sql`DELETE FROM connecteam_settings WHERE tenant_id = ${body.tenantId}::uuid`);
      await db.execute(sql`UPDATE tenants SET connecteam_sync_enabled = false WHERE id = ${body.tenantId}::uuid`);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      logger.error({ err }, 'Error in connecteam disconnect');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // List time clocks (so the picker works after a page reload, not just at connect time)
  app.get('/api/connecteam/time-clocks/:tenantId', async (req, res) => {
    try {
      const tenantId = req.params.tenantId;
      if (!(await requireManagerForTenant(req, res, tenantId))) return;

      const settingsResult = await db.execute(
        sql`SELECT api_key FROM connecteam_settings WHERE tenant_id = ${tenantId}::uuid LIMIT 1`
      );
      const settings = settingsResult.rows[0] as any;
      if (!settings?.api_key) return res.status(400).json({ error: 'Connecteam is not connected' });

      res.json({ timeClocks: await listTimeClocks(settings.api_key, tenantId) });
    } catch (err: any) {
      if (err instanceof ConnecteamRateLimitError)
        return res.status(429).json({ error: err.message, retryAt: err.retryAt.toISOString() });
      logger.error({ err }, 'Error in connecteam time-clocks');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Connecteam users + auto-suggested mappings (by case-insensitive name match)
  app.get('/api/connecteam/users/:tenantId', async (req, res) => {
    try {
      const tenantId = req.params.tenantId;
      if (!(await requireManagerForTenant(req, res, tenantId))) return;

      const settingsResult = await db.execute(
        sql`SELECT api_key FROM connecteam_settings WHERE tenant_id = ${tenantId}::uuid LIMIT 1`
      );
      const settings = settingsResult.rows[0] as any;
      if (!settings?.api_key) return res.status(400).json({ error: 'Connecteam is not connected' });

      const [users, tipEmployeesResult, mappingsResult] = await Promise.all([
        listUsers(settings.api_key, tenantId),
        db.execute(
          sql`SELECT id, name, tip_eligible FROM tip_employees WHERE tenant_id = ${tenantId}::uuid AND is_active = true`
        ),
        db.execute(sql`SELECT * FROM connecteam_employee_mappings WHERE tenant_id = ${tenantId}::uuid`),
      ]);
      const tipEmployees = tipEmployeesResult.rows as any[];
      const existing = new Map((mappingsResult.rows as any[]).map((m) => [String(m.connecteam_user_id), m]));
      const byNameLower = new Map(tipEmployees.map((e) => [e.name.trim().toLowerCase(), e]));

      const rows = users.map((u) => {
        const current = existing.get(u.id);
        const suggested = current?.tip_employee_id ?? byNameLower.get(u.name.trim().toLowerCase())?.id ?? null;
        return {
          connecteam_user_id: u.id,
          connecteam_user_name: u.name,
          status: current?.status ?? 'suggested',
          tip_employee_id: current?.tip_employee_id ?? null,
          suggested_tip_employee_id: suggested,
        };
      });

      res.json({ users: rows, tip_employees: tipEmployees });
    } catch (err: any) {
      if (err instanceof ConnecteamRateLimitError)
        return res.status(429).json({ error: err.message, retryAt: err.retryAt.toISOString() });
      logger.error({ err }, 'Error in connecteam users');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Save mappings (bulk upsert)
  app.post('/api/connecteam/mappings', async (req, res) => {
    try {
      const body = mappingsSchema.parse(req.body);
      const userId = await requireManagerForTenant(req, res, body.tenantId);
      if (!userId) return;

      for (const m of body.mappings) {
        await db.execute(sql`
          INSERT INTO connecteam_employee_mappings
            (tenant_id, connecteam_user_id, connecteam_user_name, tip_employee_id, status, confirmed_by, confirmed_at)
          VALUES
            (${body.tenantId}::uuid, ${m.connecteam_user_id}, ${m.connecteam_user_name},
             ${m.tip_employee_id}, ${m.status},
             ${m.status === 'confirmed' ? userId : null}::uuid,
             ${m.status === 'confirmed' ? sql`NOW()` : sql`NULL`})
          ON CONFLICT (tenant_id, connecteam_user_id)
          DO UPDATE SET
            connecteam_user_name = ${m.connecteam_user_name},
            tip_employee_id = ${m.tip_employee_id},
            status = ${m.status},
            confirmed_by = ${m.status === 'confirmed' ? userId : null}::uuid,
            confirmed_at = ${m.status === 'confirmed' ? sql`NOW()` : sql`NULL`},
            updated_at = NOW()
        `);
      }
      res.json({ ok: true, saved: body.mappings.length });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      logger.error({ err }, 'Error in connecteam mappings');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Manual sync (also used by the "Sync now" button)
  app.post('/api/connecteam/sync', async (req, res) => {
    try {
      const body = syncSchema.parse(req.body);
      if (!(await requireManagerForTenant(req, res, body.tenantId))) return;

      const result = await syncHoursForTenant(body.tenantId, body.start_date, body.end_date);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
      if (err instanceof ConnecteamRateLimitError)
        return res.status(429).json({ error: err.message, retryAt: err.retryAt.toISOString() });
      logger.error({ err }, 'Error in connecteam sync');
      res.status(500).json({ error: err.message || 'Sync failed' });
    }
  });
}
