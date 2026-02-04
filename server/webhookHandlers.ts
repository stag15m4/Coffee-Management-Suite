import { getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { log } from './index';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
    }

    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const tenantId = session.metadata?.tenantId;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (tenantId && subscriptionId) {
          await storage.updateTenantStripeInfo(tenantId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });
          log(`Tenant ${tenantId} subscription activated: ${subscriptionId}`, 'stripe');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        // Find tenant by customer ID and update subscription status
        const tenant = await findTenantByStripeCustomer(customerId);
        if (tenant) {
          await storage.updateTenantStripeInfo(tenant.id, {
            stripeSubscriptionId: subscription.id,
          });
          log(`Subscription updated for customer ${customerId}: ${subscription.status}`, 'stripe');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        const tenant = await findTenantByStripeCustomer(customerId);
        if (tenant) {
          // Clear subscription ID directly since the storage helper skips undefined values
          const { db } = await import('./db');
          const { sql } = await import('drizzle-orm');
          await db.execute(
            sql`UPDATE tenants SET stripe_subscription_id = NULL WHERE id = ${tenant.id}`
          );
          log(`Subscription deleted for customer ${customerId}`, 'stripe');
        }
        break;
      }

      default:
        log(`Unhandled webhook event: ${event.type}`, 'stripe');
    }
  }
}

async function findTenantByStripeCustomer(customerId: string) {
  // Use the db directly to find tenant by stripe_customer_id
  const { db } = await import('./db');
  const { sql } = await import('drizzle-orm');
  const result = await db.execute(
    sql`SELECT id FROM tenants WHERE stripe_customer_id = ${customerId} LIMIT 1`
  );
  return result.rows[0] as { id: string } | undefined;
}
