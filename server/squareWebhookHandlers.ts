import { WebhooksHelper } from 'square';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { squareService, type SquareTimecard } from './squareService';
import { log } from './index';

interface SquareWebhookEvent {
  merchant_id: string;
  type: string;
  event_id: string;
  data?: {
    type?: string;
    id?: string;
    object?: Record<string, any>;
  };
}

export class SquareWebhookHandlers {
  static async processWebhook(
    payload: string,
    signature: string,
    signatureKey: string,
    notificationUrl: string
  ): Promise<void> {
    // Verify signature
    const isValid = await WebhooksHelper.verifySignature({
      requestBody: payload,
      signatureHeader: signature,
      signatureKey,
      notificationUrl,
    });

    if (!isValid) {
      throw new Error('Invalid Square webhook signature');
    }

    const event: SquareWebhookEvent = JSON.parse(payload);
    log(`Square webhook received: ${event.type} (${event.event_id})`, 'square');

    // Look up tenant by merchant_id
    const tenantResult = await db.execute(sql`
      SELECT id FROM tenants
      WHERE square_merchant_id = ${event.merchant_id}
        AND square_sync_enabled = true
      LIMIT 1
    `);

    if (!tenantResult.rows.length) {
      log(`No tenant found for Square merchant ${event.merchant_id}`, 'square');
      return;
    }

    const tenantId = (tenantResult.rows[0] as any).id;

    switch (event.type) {
      case 'labor.timecard.created':
      case 'labor.timecard.updated': {
        await this.handleTimecardEvent(tenantId, event);
        break;
      }
      default:
        log(`Unhandled Square webhook event type: ${event.type}`, 'square');
    }
  }

  private static async handleTimecardEvent(
    tenantId: string,
    event: SquareWebhookEvent
  ): Promise<void> {
    const timecardData = event.data?.object?.timecard;
    if (!timecardData) {
      log('No timecard data in webhook payload', 'square');
      return;
    }

    const tc: SquareTimecard = {
      id: timecardData.id,
      teamMemberId: timecardData.team_member_id,
      locationId: timecardData.location_id,
      startAt: timecardData.start_at,
      endAt: timecardData.end_at,
      status: timecardData.status,
      breaks: (timecardData.breaks || []).map((b: any) => ({
        id: b.id,
        startAt: b.start_at,
        endAt: b.end_at,
        name: b.name,
        isPaid: b.is_paid ?? false,
      })),
    };

    try {
      await squareService.processSingleTimecard(tenantId, tc);
      log(`Processed Square timecard ${tc.id} for tenant ${tenantId}`, 'square');
    } catch (err: any) {
      log(`Error processing Square timecard ${tc.id}: ${err.message}`, 'square');
    }
  }
}
