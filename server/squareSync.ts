import { sql } from 'drizzle-orm';
import { db } from './db';
import { squareService } from './squareService';
import { log } from './index';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const INITIAL_DELAY_MS = 30 * 1000; // 30 seconds after startup

async function runSync(): Promise<void> {
  try {
    // Find all tenants with Square sync enabled
    const result = await db.execute(sql`
      SELECT id FROM tenants
      WHERE square_sync_enabled = true
        AND square_access_token IS NOT NULL
        AND square_location_id IS NOT NULL
    `);

    const tenants = result.rows as any[];
    if (!tenants.length) return;

    log(`Square sync: processing ${tenants.length} tenant(s)`, 'square');

    for (const tenant of tenants) {
      try {
        const syncResult = await squareService.syncShiftsForTenant(tenant.id);
        log(
          `Square sync tenant ${tenant.id}: ${syncResult.synced} synced, ${syncResult.skipped} skipped, ${syncResult.errors} errors`,
          'square'
        );
      } catch (err: any) {
        log(`Square sync error for tenant ${tenant.id}: ${err.message}`, 'square');
      }
    }
  } catch (err: any) {
    log(`Square sync scheduler error: ${err.message}`, 'square');
  }
}

export function startSquareSyncScheduler(): void {
  // Check if Square integration is configured
  if (!process.env.SQUARE_APP_ID) {
    log('Square integration not configured, skipping sync scheduler', 'square');
    return;
  }

  log('Starting Square sync scheduler (every 15 min)', 'square');

  // Run first sync after a short delay
  setTimeout(runSync, INITIAL_DELAY_MS);

  // Then run periodically
  setInterval(runSync, SYNC_INTERVAL_MS);
}
