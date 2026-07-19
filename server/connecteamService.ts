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

async function connecteamFetch(apiKey: string, path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(path, API_BASE);
  for (const [k, v] of Object.entries(params || {})) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Connecteam API ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Validates an API key. Returns account info or throws. */
export async function validateApiKey(apiKey: string): Promise<any> {
  const body = await connecteamFetch(apiKey, '/me');
  return body?.data ?? body;
}

/** Lists the account's time clocks so the tenant can pick one. */
export async function listTimeClocks(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  const body = await connecteamFetch(apiKey, '/time-clock/v1/time-clocks');
  const clocks = body?.data?.timeClocks ?? body?.timeClocks ?? [];
  return clocks.map((c: any) => ({ id: String(c.id ?? c.timeClockId), name: c.name ?? `Time clock ${c.id}` }));
}

/** Lists Connecteam users (for the mapping UI). */
export async function listUsers(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  const body = await connecteamFetch(apiKey, '/users/v1/users', { limit: '200' });
  const users = body?.data?.users ?? body?.users ?? [];
  return users.map((u: any) => ({
    id: String(u.userId ?? u.id),
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || `User ${u.userId ?? u.id}`,
  }));
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
    { startDate, endDate }
  );
  const activities: ConnecteamTimeActivity[] = body?.data?.timeActivities ?? body?.timeActivities ?? [];

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
