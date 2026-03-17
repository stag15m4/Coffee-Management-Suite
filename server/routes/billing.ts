import type { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { storage } from '../storage';
import logger from '../logger';
import { getUserIdFromRequest, getTrustedBaseUrl } from './core';

export async function registerBillingRoutes(app: Express): Promise<void> {
  const { stripeService } = await import('../stripeService');
  const { getStripePublishableKey } = await import('../stripeClient');

  // =====================================================
  // STRIPE ROUTES
  // =====================================================

  app.get('/api/stripe/publishable-key', async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get Stripe publishable key');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/stripe/products', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      const products = await stripeService.listProductsWithPrices();

      if (!userId) {
        // Unauthenticated: return only public-safe fields (no pricing details)
        const publicProducts = products.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
        }));
        return res.json({ data: publicProducts });
      }

      res.json({ data: products });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to list Stripe products');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/stripe/checkout', async (req, res) => {
    try {
      const { priceId, tenantId, tenantEmail, tenantName } = req.body;

      if (!priceId || !tenantId || !tenantEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Authenticate via JWT
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userProfileResult = await db.execute(sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}`);
      const userProfile = userProfileResult.rows[0] as any;

      if (!userProfile || userProfile.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

      if (userProfile.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can manage billing' });
      }

      let stripeCustomerId = null;

      const tenantResult = await storage.getTenant(tenantId);
      if (tenantResult?.stripe_customer_id) {
        stripeCustomerId = tenantResult.stripe_customer_id;
      } else {
        const customer = await stripeService.createCustomer(tenantEmail, tenantId, tenantName || 'Tenant');
        stripeCustomerId = customer.id;
        await storage.updateTenantStripeInfo(tenantId, { stripeCustomerId: customer.id });
      }

      const baseUrl = getTrustedBaseUrl(req);
      const session = await stripeService.createCheckoutSession(
        stripeCustomerId,
        priceId,
        `${baseUrl}/billing?success=true`,
        `${baseUrl}/billing?canceled=true`,
        tenantId
      );

      res.json({ url: session.url });
    } catch (error: any) {
      logger.error({ err: error }, 'Checkout error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/stripe/portal', async (req, res) => {
    try {
      const { tenantId } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'Missing tenantId' });
      }

      // Authenticate via JWT
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userProfileResult = await db.execute(sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}`);
      const userProfile = userProfileResult.rows[0] as any;

      if (!userProfile || userProfile.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

      if (userProfile.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can manage billing' });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant?.stripe_customer_id) {
        return res.status(400).json({ error: 'No Stripe customer found for this tenant' });
      }

      const baseUrl = getTrustedBaseUrl(req);
      const session = await stripeService.createCustomerPortalSession(tenant.stripe_customer_id, `${baseUrl}/billing`);

      res.json({ url: session.url });
    } catch (error: any) {
      logger.error({ err: error }, 'Portal error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/stripe/subscription/:tenantId', async (req, res) => {
    try {
      // Require authentication + tenant ownership
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const tenantId = req.params.tenantId;
      const profileResult = await db.execute(
        sql`SELECT tenant_id FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
      );
      const profile = profileResult.rows[0] as any;
      if (!profile || profile.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant?.stripe_subscription_id) {
        return res.json({ subscription: null });
      }

      const subscription = await stripeService.getSubscription(tenant.stripe_subscription_id);
      res.json({ subscription });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  // =====================================================
  // BILLING DETAILS
  // =====================================================

  app.get('/api/stripe/billing-details/:tenantId', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tenantId = req.params.tenantId;

      // Verify user belongs to this tenant
      const profileResult = await db.execute(
        sql`SELECT tenant_id FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
      );
      const userProfile = profileResult.rows[0] as any;
      if (!userProfile || userProfile.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Get tenant plan info from DB
      const tenantInfo = await db.execute(sql`
        SELECT subscription_plan, subscription_status, trial_ends_at,
               stripe_customer_id, stripe_subscription_id, stripe_subscription_status,
               license_code_id, billable_locations, billing_interval, is_grandfathered
        FROM tenants WHERE id = ${tenantId}
      `);
      const tenantData = tenantInfo.rows[0] as any;

      const result: any = {
        subscription_plan: tenantData?.subscription_plan || 'free',
        subscription_status: tenantData?.subscription_status || 'trial',
        trial_ends_at: tenantData?.trial_ends_at || null,
        stripe_subscription_status: tenantData?.stripe_subscription_status || null,
        license_code_id: tenantData?.license_code_id || null,
        billable_locations: tenantData?.billable_locations || 1,
        billing_interval: tenantData?.billing_interval || 'monthly',
        is_grandfathered: tenantData?.is_grandfathered || false,
        subscription: null,
        upcoming_invoice: null,
      };

      // If has Stripe subscription, fetch details
      if (tenantData?.stripe_subscription_id) {
        result.subscription = await stripeService.getSubscriptionDetails(tenantData.stripe_subscription_id);
      }

      // If has Stripe customer, fetch upcoming invoice
      if (tenantData?.stripe_customer_id) {
        result.upcoming_invoice = await stripeService.getUpcomingInvoice(tenantData.stripe_customer_id);
      }

      // If redeemed via license code, fetch license info
      if (tenantData?.license_code_id) {
        const licenseResult = await db.execute(sql`
          SELECT code, subscription_plan, redeemed_at, expires_at
          FROM license_codes WHERE id = ${tenantData.license_code_id}
        `);
        result.license_code = licenseResult.rows[0] || null;
      }

      res.json(result);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to fetch billing details');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =====================================================
  // BILLING MODULES
  // =====================================================

  app.get('/api/billing/modules', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);

      if (!userId) {
        // Unauthenticated: return only public-safe fields (no pricing details)
        const result = await db.execute(sql`
          SELECT id, name, description, display_order
          FROM modules
          ORDER BY display_order, name
        `);
        return res.json(result.rows);
      }

      const result = await db.execute(sql`
        SELECT id, name, description, monthly_price, is_premium_only, display_order
        FROM modules
        ORDER BY display_order, name
      `);
      res.json(result.rows);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to list billing modules');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
