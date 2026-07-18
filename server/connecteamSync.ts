import { sql } from 'drizzle-orm';
import { db } from './db';
import { syncHoursForTenant } from './connecteamService';
import { log } from './index';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes, matching the Square scheduler
const INITIAL_DELAY_MS = 45 * 1000;

async function runSync(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT t.id FROM tenants t
      JOIN connecteam_settings cs ON cs.tenant_id = t.id
      WHERE t.connecteam_sync_enabled = true AND cs.time_clock_id IS NOT NULL
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
  log('Starting Connecteam sync scheduler (every 15 min)', 'connecteam');
  setTimeout(runSync, INITIAL_DELAY_MS);
  setInterval(runSync, SYNC_INTERVAL_MS);
}
