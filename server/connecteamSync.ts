import { sql } from 'drizzle-orm';
import { db } from './db';
import { syncHoursForTenant, SYNC_TTL_HOURS } from './connecteamService';
import { log } from './index';

// The ticker runs frequently, but a tenant is only actually synced when its
// last sync is older than SYNC_TTL_HOURS (default 12h -> ~2 Connecteam pulls
// per day per tenant). Connecteam's rate limit is shared account-wide with
// other apps, and the timeclock data lags days anyway — freshness beyond
// twice a day buys nothing.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 45 * 1000;

async function runSync(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT t.id FROM tenants t
      JOIN connecteam_settings cs ON cs.tenant_id = t.id
      WHERE t.connecteam_sync_enabled = true
        AND cs.time_clock_id IS NOT NULL
        AND (t.connecteam_last_sync_at IS NULL
             OR t.connecteam_last_sync_at < NOW() - make_interval(hours => ${SYNC_TTL_HOURS}))
        AND (cs.rate_limited_until IS NULL OR cs.rate_limited_until < NOW())
    `);
    const tenants = result.rows as any[];
    if (!tenants.length) return;

    log(`Connecteam sync: processing ${tenants.length} tenant(s)`, 'connecteam');
    for (const tenant of tenants) {
      try {
        const r = await syncHoursForTenant(tenant.id);
        log(
          `Connecteam sync tenant ${tenant.id}: ${r.entriesUpserted} entries across ${r.weeksTouched.length} week(s), ${r.unmatchedUsers.length} unmatched`,
          'connecteam'
        );
      } catch (err: any) {
        log(`Connecteam sync error for tenant ${tenant.id}: ${err.message}`, 'connecteam');
      }
    }
  } catch (err: any) {
    // Table may not exist yet if migration 146 hasn't been applied — stay quiet but visible
    log(`Connecteam sync scheduler error: ${err.message}`, 'connecteam');
  }
}

export function startConnecteamSyncScheduler(): void {
  log(
    `Starting Connecteam sync scheduler (checks every 15 min, syncs each tenant every ${SYNC_TTL_HOURS}h)`,
    'connecteam'
  );
  setTimeout(runSync, INITIAL_DELAY_MS);
  setInterval(runSync, CHECK_INTERVAL_MS);
}
