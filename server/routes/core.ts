import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getSupabaseAdmin } from '../supabaseAdmin';
import rateLimit from 'express-rate-limit';
import logger from '../logger';

// ── Role Hierarchy ──────────────────────────────────────────
// Shared constant used across all route files for role-based access control.
export const ROLE_HIERARCHY: Record<string, number> = {
  employee: 0,
  lead: 1,
  manager: 2,
  owner: 3,
};

// ── Rate Limiters ───────────────────────────────────────────
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

export const kioskVerifyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 attempts per minute (multiple employees may use same kiosk IP)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Please wait a moment.' },
});

export const licenseValidateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per window — generous for legitimate signup flow
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many validation attempts. Please try again later.' },
});

// ── Enforce Map Limit ───────────────────────────────────────
// Evicts oldest entries (first inserted) when the map exceeds maxSize.
// Prevents OOM from unbounded growth of in-memory Maps.
export function enforceMapLimit<K, V>(map: Map<K, V>, maxSize: number): void {
  if (map.size <= maxSize) return;
  const excess = map.size - maxSize;
  const iter = map.keys();
  for (let i = 0; i < excess; i++) {
    const { value, done } = iter.next();
    if (done) break;
    map.delete(value);
  }
}

// ── Auth Helpers ────────────────────────────────────────────

// Extract user ID from request via Authorization Bearer JWT
export async function getUserIdFromRequest(
  req: Request
): Promise<{ userId: string | null; userEmail: string | null; debug: string }> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null, userEmail: null, debug: 'No Bearer token' };
  }

  const token = authHeader.slice(7);
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (!error && user?.id) {
      return { userId: user.id, userEmail: user.email ?? null, debug: 'JWT verified' };
    }
    return { userId: null, userEmail: null, debug: `JWT verify failed: ${error?.message || 'no user returned'}` };
  } catch (err: any) {
    return { userId: null, userEmail: null, debug: `JWT error: ${err.message}` };
  }
}

// Build a trusted base URL from request, preferring APP_URL env var.
// Falls back to request headers only for known safe domains (Codespaces, localhost).
export function getTrustedBaseUrl(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  // Only trust hosts that match known patterns
  if (host.startsWith('localhost') || host.endsWith('.app.github.dev') || host.endsWith('.preview.app.github.dev')) {
    return `${proto}://${host}`;
  }
  // Reject unknown hosts — require APP_URL in production
  throw new Error('APP_URL environment variable must be set for this operation');
}

// Helper to verify platform admin status
export async function verifyPlatformAdmin(userId: string | undefined): Promise<{ isAdmin: boolean; debug: string }> {
  if (!userId) {
    return { isAdmin: false, debug: 'No userId provided' };
  }
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM platform_admins
      WHERE id = ${userId}::uuid AND is_active = true
      LIMIT 1
    `);
    return {
      isAdmin: result.rows.length > 0,
      debug: result.rows.length > 0 ? 'Admin verified' : `userId ${userId} not found in platform_admins`,
    };
  } catch (error: any) {
    return { isAdmin: false, debug: `DB error: ${error.message}` };
  }
}

// Middleware to require platform admin
export const requirePlatformAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, debug: authDebug } = await getUserIdFromRequest(req);
  const { isAdmin, debug: adminDebug } = await verifyPlatformAdmin(userId ?? undefined);
  if (!isAdmin) {
    logger.warn({ authDebug, adminDebug }, 'Platform admin access denied');
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  (req as any).userId = userId;
  next();
};

// Resolve tenant_id from an authenticated user's profile
export async function getTenantIdForUser(userId: string): Promise<string | null> {
  const result = await db.execute(
    sql`SELECT tenant_id FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
  );
  const row = result.rows[0] as any;
  return row?.tenant_id ?? null;
}

// ── Audit Logging Helper ─────────────────────────────────────
export async function logAuditEvent(
  tenantId: string,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null,
  ipAddress: string | undefined
) {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (tenant_id, actor_id, action, resource_type, resource_id, old_value, new_value, ip_address)
      VALUES (
        ${tenantId}::uuid,
        ${actorId}::uuid,
        ${action},
        ${resourceType},
        ${resourceId ? sql`${resourceId}::uuid` : sql`NULL`},
        ${oldValue ? JSON.stringify(oldValue) : null}::jsonb,
        ${newValue ? JSON.stringify(newValue) : null}::jsonb,
        ${ipAddress ?? null}
      )
    `);
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
}
