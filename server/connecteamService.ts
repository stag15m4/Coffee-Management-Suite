/**
 * Connecteam integration service (phase 1: timeclock -> tip hours).
 *
 * CMS is the ONLY consumer of the Connecteam API key. Alfred and all other
 * readers get hours from CMS's own tables via the existing endpoints.
 *
 * API: https://developer.connecteam.com — auth via X-API-KEY header.
 * Time activities response shape (verified against the API reference):
 *   { timeActivities: [{ userId, shifts: [{ start: { timestamp, timezone },
 *     end: { timestamp, timezone } }], manualbreaks: [...] }] }
 */
import { sql } from 'drizzle-orm';
import { db } from './db';
import logger from './logger';

// Overridable for testing against a mock server
const API_BASE = process.env.CONNECTEAM_API_BASE || 'https://api.connecteam.com';

// ── Rate-limit protection ───────────────────────────────────────────────────
// Connecteam's rate limit is per company ACCOUNT and shared with other apps
// (Alfred, Lucy). CMS must be a polite citizen:
// - 429 opens a circuit breaker: no Connecteam calls for >= 20 min (or
//   Retry-After, whichever is longer), persisted in the DB so redeploys
//   don't reset it.
// - Reference data (time clocks, users) is cached in memory.
// - Scheduled syncs are throttled to CONNECTEAM_SYNC_TTL_HOURS (default 12h).

const COOLDOWN_MIN_MS = 20 * 60 * 1000;
export const SYNC_TTL_HOURS = Math.max(1, parseInt(process.env.CONNECTEAM_SYNC_TTL_HOURS || '12', 10) || 12);

export class ConnecteamRateLimitError extends Error {
  retryAt: Date;
  constructor(retryAt: Date) {
    super(`Connecteam rate limit hit — pausing all Connecteam calls until ${retryAt.toISOString()}`);
    this.name = 'ConnecteamRateLimitError';
    this.retryAt = retryAt;
  }
}

/** Parses a Retry-After header (seconds or HTTP-date) into milliseconds. */
function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

async function getCooldown(tenantId: string): Promise<Date | null> {
  const result = await db.execute(
    sql`SELECT rate_limited_until FROM connecteam_settings WHERE tenant_id = ${tenantId}::uuid LIMIT 1`
  );
  const until = (result.rows[0] as any)?.rate_limited_until;
  if (!until) return null;
  const untilDate = new Date(until);
  return untilDate.getTime() > Date.now() ? untilDate : null;
}

async function setCooldown(tenantId: string, until: Date): Promise<void> {
  await db.execute(
    sql`UPDATE connecteam_settings SET rate_limited_until = ${until.toISOString()}::timestamptz, updated_at = NOW()
        WHERE tenant_id = ${tenantId}::uuid`
  );
}

// In-memory caches for slow-changing reference data. Cleared on redeploy,
// which costs at most one refresh call each.
interface CacheEntry<T> {
  at: number;
  data: T;
}
const TIME_CLOCKS_TTL_MS = 24 * 60 * 60 * 1000;
const USERS_TTL_MS = 60 * 60 * 1000;
const timeClocksCache = new Map<string, CacheEntry<Array<{ id: string; name: string }>>>();
const usersCache = new Map<string, CacheEntry<Array<{ id: string; name: string }>>>();

function fromCache<T>(cache: Map<string, CacheEntry<T>>, key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  return entry && Date.now() - entry.at < ttlMs ? entry.data : null;
}

interface ConnecteamShift {
  start?: { timestamp?: number; timezone?: string };
  end?: { timestamp?: number; timezone?: string };
}

interface ConnecteamBreak {
  start?: { timestamp?: number };
  end?: { timestamp?: number };
  isPaid?: boolean;
  paid?: boolean;
  type?: string;
}

interface ConnecteamTimeActivity {
  userId: number | string;
  shifts?: ConnecteamShift[];
  manualbreaks?: ConnecteamBreak[];
  manualBreaks?: ConnecteamBreak[];
}

export interface SyncResult {
  entriesUpserted: number;
  weeksTouched: string[];
  unmatchedUsers: Array<{ connecteam_user_id: string; hours: number }>;
  mappedUsers: number;
  /** Diagnostics so an empty sync explains itself */
  activitiesReturned: number;
  confirmedMappings: number;
  dateRange: { start: string; end: string };
}

/**
 * All Connecteam HTTP goes through here. When tenantId is provided:
 * - the persisted circuit breaker is checked before calling
 * - a 429 opens the breaker (>= 20 min, honoring Retry-After) and persists it
 */
async function connecteamFetch(
  apiKey: string,
  path: string,
  params?: Record<string, string>,
  tenantId?: string
): Promise<any> {
  if (tenantId) {
    const cooldown = await getCooldown(tenantId);
    if (cooldown) throw new ConnecteamRateLimitError(cooldown);
  }

  const url = new URL(path, API_BASE);
  for (const [k, v] of Object.entries(params || {})) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
  });

  if (res.status === 429) {
    const retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'));
    const until = new Date(Date.now() + Math.max(COOLDOWN_MIN_MS, retryAfterMs ?? 0));
    if (tenantId) {
      await setCooldown(tenantId, until).catch((e) => logger.error({ e }, 'Failed to persist 429 cooldown'));
    }
    logger.warn({ tenantId, until: until.toISOString(), path }, 'Connecteam 429 — circuit breaker opened');
    throw new ConnecteamRateLimitError(until);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Connecteam API ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Validates an API key. Returns account info or throws. */
export async function validateApiKey(apiKey: string, tenantId?: string): Promise<any> {
  const body = await connecteamFetch(apiKey, '/me', undefined, tenantId);
  return body?.data ?? body;
}

/** Lists the account's time clocks (cached 24h — the roster of clocks barely changes). */
export async function listTimeClocks(apiKey: string, tenantId?: string): Promise<Array<{ id: string; name: string }>> {
  if (tenantId) {
    const cached = fromCache(timeClocksCache, tenantId, TIME_CLOCKS_TTL_MS);
    if (cached) return cached;
  }
  const body = await connecteamFetch(apiKey, '/time-clock/v1/time-clocks', undefined, tenantId);
  const clocks = body?.data?.timeClocks ?? body?.timeClocks ?? [];
  const mapped = clocks.map((c: any) => ({ id: String(c.id ?? c.timeClockId), name: c.name ?? `Time clock ${c.id}` }));
  if (tenantId) timeClocksCache.set(tenantId, { at: Date.now(), data: mapped });
  return mapped;
}

/** Lists Connecteam users for the mapping UI (cached 1h). */
export async function listUsers(apiKey: string, tenantId?: string): Promise<Array<{ id: string; name: string }>> {
  if (tenantId) {
    const cached = fromCache(usersCache, tenantId, USERS_TTL_MS);
    if (cached) return cached;
  }
  const body = await connecteamFetch(apiKey, '/users/v1/users', { limit: '200' }, tenantId);
  const users = body?.data?.users ?? body?.users ?? [];
  const mapped = users.map((u: any) => ({
    id: String(u.userId ?? u.id),
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || `User ${u.userId ?? u.id}`,
  }));
  if (tenantId) usersCache.set(tenantId, { at: Date.now(), data: mapped });
  return mapped;
}

/** Monday (YYYY-MM-DD) of the week containing the given date, in the shift's timezone. */
function mondayOf(timestampSec: number, timezone: string | undefined): string {
  const date = new Date(timestampSec * 1000);
  // Resolve the local calendar date in the shift's own timezone
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const localDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  const dayIdx = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 }[parts.weekday as string] ?? 0;
  localDate.setUTCDate(localDate.getUTCDate() - dayIdx);
  return localDate.toISOString().split('T')[0];
}

function breakIsUnpaid(b: ConnecteamBreak): boolean {
  if (b.isPaid === false || b.paid === false) return true;
  if (typeof b.type === 'string' && b.type.toLowerCase().includes('unpaid')) return true;
  return false;
}

/**
 * Computes net hours per (connecteam user, Monday week) from time activities.
 * Net = shift durations minus explicitly-unpaid manual breaks.
 */
export function aggregateHoursByWeek(activities: ConnecteamTimeActivity[]): Map<string, Map<string, number>> {
  const byUser = new Map<string, Map<string, number>>();

  for (const activity of activities) {
    const userId = String(activity.userId);
    const weeks = byUser.get(userId) ?? new Map<string, number>();

    for (const shift of activity.shifts || []) {
      const start = shift.start?.timestamp;
      const end = shift.end?.timestamp;
      if (!start || !end || end <= start) continue; // skip open/invalid shifts
      const week = mondayOf(start, shift.start?.timezone);
      weeks.set(week, (weeks.get(week) ?? 0) + (end - start) / 3600);
    }

    for (const brk of activity.manualbreaks || activity.manualBreaks || []) {
      const start = brk.start?.timestamp;
      const end = brk.end?.timestamp;
      if (!start || !end || end <= start || !breakIsUnpaid(brk)) continue;
      const week = mondayOf(start, undefined);
      weeks.set(week, (weeks.get(week) ?? 0) - (end - start) / 3600);
    }

    byUser.set(userId, weeks);
  }
  return byUser;
}

/**
 * Pulls time activities for the date range and upserts tip_employee_hours for
 * every CONFIRMED employee mapping. Returns what happened, including hours for
 * unmapped Connecteam users so the UI can prompt for mappings.
 */
export async function syncHoursForTenant(tenantId: string, startDate?: string, endDate?: string): Promise<SyncResult> {
  const settingsResult = await db.execute(
    sql`SELECT api_key, time_clock_id FROM connecteam_settings WHERE tenant_id = ${tenantId}::uuid LIMIT 1`
  );
  const settings = settingsResult.rows[0] as any;
  if (!settings?.api_key) throw new Error('Connecteam is not connected for this tenant');
  if (!settings.time_clock_id) throw new Error('No Connecteam time clock selected');

  // Default range: the current week and the previous week
  if (!startDate || !endDate) {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    const start = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0];
    startDate = startDate || start;
    endDate = endDate || end;
  }

  const body = await connecteamFetch(
    settings.api_key,
    `/time-clock/v1/time-clocks/${settings.time_clock_id}/time-activities`,
    { startDate, endDate },
    tenantId
  );
  // Real key is timeActivitiesByUsers (per the API reference); older docs show
  // timeActivities — accept both.
  const activities: ConnecteamTimeActivity[] =
    body?.data?.timeActivitiesByUsers ??
    body?.timeActivitiesByUsers ??
    body?.data?.timeActivities ??
    body?.timeActivities ??
    [];

  // If Connecteam answered but we parsed nothing, log the response shape so a
  // field-name mismatch is visible in the Railway logs (keys only, no PII).
  if (activities.length === 0 && body && typeof body === 'object') {
    logger.warn(
      {
        topLevelKeys: Object.keys(body),
        dataKeys: body.data && typeof body.data === 'object' ? Object.keys(body.data) : null,
      },
      'Connecteam time-activities returned no parseable activities'
    );
  }

  const hoursByUser = aggregateHoursByWeek(activities);

  // Confirmed mappings only
  const mappingsResult = await db.execute(sql`
    SELECT connecteam_user_id, tip_employee_id
    FROM connecteam_employee_mappings
    WHERE tenant_id = ${tenantId}::uuid AND status = 'confirmed' AND tip_employee_id IS NOT NULL
  `);
  const mapping = new Map((mappingsResult.rows as any[]).map((m) => [String(m.connecteam_user_id), m.tip_employee_id]));

  const result: SyncResult = {
    entriesUpserted: 0,
    weeksTouched: [],
    unmatchedUsers: [],
    mappedUsers: 0,
    activitiesReturned: activities.length,
    confirmedMappings: mapping.size,
    dateRange: { start: startDate, end: endDate },
  };
  const weeksTouched = new Set<string>();

  for (const [connecteamUserId, weeks] of hoursByUser) {
    const tipEmployeeId = mapping.get(connecteamUserId);
    if (!tipEmployeeId) {
      const total = [...weeks.values()].reduce((a, b) => a + b, 0);
      if (total > 0)
        result.unmatchedUsers.push({ connecteam_user_id: connecteamUserId, hours: Math.round(total * 100) / 100 });
      continue;
    }
    result.mappedUsers++;

    for (const [week, hours] of weeks) {
      const rounded = Math.round(Math.max(0, hours) * 100) / 100;
      await db.execute(sql`
        INSERT INTO tip_employee_hours (tenant_id, employee_id, week_key, hours)
        VALUES (${tenantId}::uuid, ${tipEmployeeId}::uuid, ${week}::date, ${rounded})
        ON CONFLICT (employee_id, week_key)
        DO UPDATE SET hours = ${rounded}, updated_at = NOW()
      `);
      result.entriesUpserted++;
      weeksTouched.add(week);
    }
  }

  result.weeksTouched = [...weeksTouched].sort();
  await db.execute(sql`UPDATE tenants SET connecteam_last_sync_at = NOW() WHERE id = ${tenantId}::uuid`);
  logger.info({ tenantId, ...result, unmatchedCount: result.unmatchedUsers.length }, 'Connecteam hours sync completed');
  return result;
}
