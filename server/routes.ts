import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { sendOrderEmail, sendFeedbackEmail, sendBetaInviteEmail, type OrderEmailData, type FeedbackEmailData } from "./resend";
import { registerObjectStorageRoutes } from "./objectStorageRoutes";
import { db } from "./db";
import { sql } from "drizzle-orm";
import ical from "node-ical";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Extract user ID from request: tries Authorization Bearer JWT first, falls back to x-user-id header
async function getUserIdFromRequest(req: Request): Promise<{ userId: string | null; debug: string }> {
  const debugParts: string[] = [];

  // Try Authorization Bearer token (Supabase JWT)
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    debugParts.push(`Bearer token present (${token.length} chars)`);
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user?.id) {
        return { userId: user.id, debug: 'JWT verified' };
      }
      debugParts.push(`JWT verify failed: ${error?.message || 'no user returned'}`);
    } catch (err: any) {
      debugParts.push(`JWT error: ${err.message}`);
    }
  } else {
    debugParts.push(authHeader ? `Auth header present but not Bearer: ${authHeader.slice(0, 20)}` : 'No Authorization header');
  }

  // Fallback to x-user-id header (for local dev / backward compatibility)
  const xUserId = req.headers['x-user-id'] as string;
  if (xUserId) {
    debugParts.push('Fell back to x-user-id');
    return { userId: xUserId, debug: debugParts.join(' | ') };
  }
  debugParts.push('No x-user-id header either');
  return { userId: null, debug: debugParts.join(' | ') };
}

// Helper to verify platform admin status
async function verifyPlatformAdmin(userId: string | undefined): Promise<{ isAdmin: boolean; debug: string }> {
  if (!userId) {
    return { isAdmin: false, debug: 'No userId provided' };
  }
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM platform_admins
      WHERE id = ${userId}::uuid AND is_active = true
      LIMIT 1
    `);
    return { isAdmin: result.rows.length > 0, debug: result.rows.length > 0 ? 'Admin verified' : `userId ${userId} not found in platform_admins` };
  } catch (error: any) {
    return { isAdmin: false, debug: `DB error: ${error.message}` };
  }
}

// Middleware to require platform admin
const requirePlatformAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, debug: authDebug } = await getUserIdFromRequest(req);
  const { isAdmin, debug: adminDebug } = await verifyPlatformAdmin(userId ?? undefined);
  if (!isAdmin) {
    console.error(`[platform-admin] Access denied: ${authDebug} | ${adminDebug}`);
    return res.status(403).json({ error: 'Platform admin access required', debug: `${authDebug} | ${adminDebug}` });
  }
  (req as any).userId = userId;
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Ingredients Routes
  app.get(api.ingredients.list.path, async (req, res) => {
    const ingredients = await storage.getIngredients();
    res.json(ingredients);
  });

  app.post(api.ingredients.create.path, async (req, res) => {
    try {
      const input = api.ingredients.create.input.parse(req.body);
      const ingredient = await storage.createIngredient(input);
      res.status(201).json(ingredient);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.ingredients.get.path, async (req, res) => {
    const ingredient = await storage.getIngredient(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    res.json(ingredient);
  });

  app.put(api.ingredients.update.path, async (req, res) => {
    try {
      const input = api.ingredients.update.input.parse(req.body);
      const ingredient = await storage.updateIngredient(req.params.id, input);
      if (!ingredient) {
        return res.status(404).json({ message: 'Ingredient not found' });
      }
      res.json(ingredient);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.ingredients.delete.path, async (req, res) => {
    await storage.deleteIngredient(req.params.id);
    res.status(204).end();
  });

  // Coffee Order Email Route
  app.post('/api/coffee-order/send-email', async (req, res) => {
    try {
      const data = sendOrderEmailSchema.parse(req.body);
      const result = await sendOrderEmail({
        vendorEmail: data.vendorEmail,
        ccEmail: data.ccEmail || undefined,
        vendorName: data.vendorName,
        orderItems: data.orderItems,
        totalUnits: data.totalUnits,
        totalCost: data.totalCost,
        notes: data.notes,
        tenantName: data.tenantName
      });
      
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: err.errors[0].message
        });
      }
      console.error('Email send error:', err);
      res.status(500).json({ success: false, error: 'Failed to send email' });
    }
  });

  // Feedback Submit Route with basic rate limiting
  const feedbackRateLimit: Map<string, { count: number; resetTime: number }> = new Map();
  const FEEDBACK_LIMIT = 5; // max 5 submissions per hour
  const FEEDBACK_WINDOW = 60 * 60 * 1000; // 1 hour in ms

  app.post('/api/feedback/submit', async (req, res) => {
    try {
      const data = sendFeedbackEmailSchema.parse(req.body);
      
      // Require user email and tenant ID (only authenticated users have these)
      if (!data.userEmail || !data.tenantId) {
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required to submit feedback' 
        });
      }
      
      // Rate limiting by IP + email
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `${clientIP}:${data.userEmail}`;
      const now = Date.now();
      
      const rateData = feedbackRateLimit.get(rateLimitKey);
      if (rateData) {
        if (now < rateData.resetTime) {
          if (rateData.count >= FEEDBACK_LIMIT) {
            return res.status(429).json({ 
              success: false, 
              error: 'Too many feedback submissions. Please try again later.' 
            });
          }
          rateData.count++;
        } else {
          feedbackRateLimit.set(rateLimitKey, { count: 1, resetTime: now + FEEDBACK_WINDOW });
        }
      } else {
        feedbackRateLimit.set(rateLimitKey, { count: 1, resetTime: now + FEEDBACK_WINDOW });
      }
      
      const result = await sendFeedbackEmail({
        feedbackType: data.feedbackType,
        subject: data.subject,
        description: data.description,
        pageUrl: data.pageUrl,
        browserInfo: data.browserInfo,
        userEmail: data.userEmail,
        userName: data.userName,
        tenantId: data.tenantId,
        tenantName: data.tenantName
      });
      
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: err.errors[0].message
        });
      }
      console.error('Feedback send error:', err);
      res.status(500).json({ success: false, error: 'Failed to submit feedback' });
    }
  });

  // Recipes Routes
  app.get(api.recipes.list.path, async (req, res) => {
    const recipes = await storage.getRecipes();
    res.json(recipes);
  });

  app.post(api.recipes.create.path, async (req, res) => {
    try {
      const input = api.recipes.create.input.parse(req.body);
      const recipe = await storage.createRecipe(input);
      res.status(201).json(recipe);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.recipes.get.path, async (req, res) => {
    const recipe = await storage.getRecipe(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    res.json(recipe);
  });

  app.put(api.recipes.update.path, async (req, res) => {
     try {
      const input = api.recipes.update.input.parse(req.body);
      const recipe = await storage.updateRecipe(req.params.id, input);
      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }
      res.json(recipe);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.recipes.delete.path, async (req, res) => {
    await storage.deleteRecipe(req.params.id);
    res.status(204).end();
  });

  // Recipe Ingredients Routes
  app.post(api.recipeIngredients.create.path, async (req, res) => {
    try {
      const recipeId = req.params.recipeId;
      const bodySchema = api.recipeIngredients.create.input.extend({
         recipeId: z.string().default(recipeId) // inject recipeId
      });

      const input = bodySchema.parse({ ...req.body, recipeId });
      
      const item = await storage.addRecipeIngredient(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.recipeIngredients.delete.path, async (req, res) => {
    await storage.deleteRecipeIngredient(req.params.id);
    res.status(204).end();
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Stripe Routes
  const { stripeService } = await import('./stripeService');
  const { getStripePublishableKey } = await import('./stripeClient');

  app.get('/api/stripe/publishable-key', async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/stripe/products', async (req, res) => {
    try {
      const products = await stripeService.listProductsWithPrices();
      res.json({ data: products });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/stripe/checkout', async (req, res) => {
    try {
      const { priceId, tenantId, tenantEmail, tenantName, userId } = req.body;
      
      if (!priceId || !tenantId || !tenantEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userProfileResult = await db.execute(
        sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}`
      );
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

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCheckoutSession(
        stripeCustomerId,
        priceId,
        `${baseUrl}/billing?success=true`,
        `${baseUrl}/billing?canceled=true`,
        tenantId
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/stripe/portal', async (req, res) => {
    try {
      const { tenantId, userId } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Missing tenantId' });
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userProfileResult = await db.execute(
        sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}`
      );
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

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCustomerPortalSession(
        tenant.stripe_customer_id,
        `${baseUrl}/billing`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Portal error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/stripe/subscription/:tenantId', async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.params.tenantId);
      if (!tenant?.stripe_subscription_id) {
        return res.json({ subscription: null });
      }

      const subscription = await stripeService.getSubscription(tenant.stripe_subscription_id);
      res.json({ subscription });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // SQUARE INTEGRATION ROUTES
  // =====================================================
  const { squareService } = await import('./squareService');
  const { getSquareOAuthUrl } = await import('./squareClient');

  // Helper: verify user is owner/manager of the given tenant
  async function verifySquareAdmin(req: Request, res: Response): Promise<{ userId: string; tenantId: string } | null> {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return null;
    }
    const profileResult = await db.execute(sql`
      SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}::uuid
    `);
    const profile = profileResult.rows[0] as any;
    if (!profile || !['owner', 'manager'].includes(profile.role)) {
      res.status(403).json({ error: 'Owner or manager access required' });
      return null;
    }
    return { userId, tenantId: profile.tenant_id };
  }

  // --- OAuth ---

  app.get('/api/square/auth-url', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      // Use X-Forwarded headers (set by Codespace proxy / reverse proxies) to build the real URL
      const proto = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');
      // Redirect to server-side callback handler (not the SPA) for instant code exchange
      const redirectUri = `${proto}://${host}/api/square/oauth/callback`;
      const url = getSquareOAuthUrl(auth.tenantId, redirectUri);
      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Server-side OAuth callback — Square redirects here with ?code=...&state=tenantId
  // This exchanges the code instantly (no SPA load delay) then redirects to the frontend.
  app.get('/api/square/oauth/callback', async (req, res) => {
    const { code, state: tenantId } = req.query;
    const frontendUrl = '/admin/integrations';

    if (!code || !tenantId) {
      return res.redirect(`${frontendUrl}?square_error=${encodeURIComponent('Missing authorization code or state')}`);
    }

    try {
      // Reconstruct the redirect URI that was used in the authorize request (must match exactly)
      const proto = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');
      const redirectUri = `${proto}://${host}/api/square/oauth/callback`;
      const tokens = await squareService.exchangeCodeForTokens(code as string, redirectUri);
      await squareService.saveTenantSquareTokens(
        tenantId as string,
        tokens.merchantId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt
      );

      res.redirect(`${frontendUrl}?square_connected=true`);
    } catch (error: any) {
      console.error('[square] OAuth callback error:', error.message);
      res.redirect(`${frontendUrl}?square_error=${encodeURIComponent(error.message)}`);
    }
  });

  app.post('/api/square/disconnect', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      await squareService.disconnectSquare(auth.tenantId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/square/status/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const status = await squareService.getSquareStatus(auth.tenantId);
      res.json(status || { connected: false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Location & Sync ---

  app.post('/api/square/set-location/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const { locationId } = req.body;
      if (!locationId) {
        return res.status(400).json({ error: 'Missing locationId' });
      }

      await squareService.setSquareLocation(auth.tenantId, locationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/square/toggle-sync/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const { enabled } = req.body;
      await squareService.toggleSquareSync(auth.tenantId, !!enabled);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/square/sync/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const result = await squareService.syncShiftsForTenant(auth.tenantId, {
        startDate: req.body.startDate,
        endDate: req.body.endDate,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/square/locations/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const locations = await squareService.listLocations(auth.tenantId);
      res.json(locations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Employee Mapping ---

  app.get('/api/square/team-members/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const members = await squareService.listTeamMembers(auth.tenantId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/square/suggest-mappings/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const suggestions = await squareService.suggestEmployeeMappings(auth.tenantId);
      res.json(suggestions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/square/mappings/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const mappings = await squareService.getMappings(auth.tenantId);
      res.json(mappings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/square/mappings/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const { mappingId, action, userProfileId, tipEmployeeId } = req.body;
      if (!mappingId || !action) {
        return res.status(400).json({ error: 'Missing mappingId or action' });
      }

      if (action === 'confirm') {
        await squareService.confirmMapping(mappingId, userProfileId || null, tipEmployeeId || null, auth.userId);
      } else if (action === 'ignore') {
        await squareService.ignoreMapping(mappingId);
      } else if (action === 'delete') {
        await squareService.deleteMapping(mappingId);
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // BILLING MODULES
  // =====================================================

  app.get('/api/billing/modules', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, name, description, monthly_price, is_premium_only, display_order
        FROM modules
        ORDER BY display_order, name
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // REFERRAL CODES
  // =====================================================

  // Generate a referral code for the tenant
  app.post('/api/referral-codes/generate', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      // Verify owner
      const userProfileResult = await db.execute(
        sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}`
      );
      const userProfile = userProfileResult.rows[0] as any;
      if (!userProfile || userProfile.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can generate referral codes' });
      }

      // Check if tenant already has a code
      const existing = await db.execute(sql`
        SELECT id, code FROM referral_codes WHERE tenant_id = ${tenantId}
      `);
      if (existing.rows.length > 0) {
        return res.json(existing.rows[0]);
      }

      // Generate unique code: XXXX-XXXX format
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars[Math.floor(Math.random() * chars.length)];
      }

      const result = await db.execute(sql`
        INSERT INTO referral_codes (tenant_id, code)
        VALUES (${tenantId}, ${code})
        RETURNING id, code, tenant_id, is_active, created_at
      `);

      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get the tenant's referral code + stats
  app.get('/api/referral-codes/mine/:tenantId', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tenantId = req.params.tenantId;

      const codeResult = await db.execute(sql`
        SELECT id, code, is_active, created_at FROM referral_codes
        WHERE tenant_id = ${tenantId}
      `);

      if (codeResult.rows.length === 0) {
        return res.json({ referral_code: null, stats: { total_referrals: 0, rewards_applied: 0 } });
      }

      const referralCode = codeResult.rows[0] as any;

      // Get redemption stats
      const statsResult = await db.execute(sql`
        SELECT
          COUNT(*) as total_referrals,
          COUNT(*) FILTER (WHERE referrer_reward_applied = true) as rewards_applied
        FROM referral_redemptions
        WHERE referral_code_id = ${referralCode.id}
      `);
      const stats = statsResult.rows[0] as any;

      res.json({
        referral_code: referralCode,
        stats: {
          total_referrals: parseInt(stats.total_referrals) || 0,
          rewards_applied: parseInt(stats.rewards_applied) || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Redeem a referral code
  app.post('/api/referral-codes/redeem', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { code, tenantId } = req.body;
      if (!code || !tenantId) {
        return res.status(400).json({ error: 'code and tenantId are required' });
      }

      // Look up the referral code
      const codeResult = await db.execute(sql`
        SELECT id, tenant_id FROM referral_codes
        WHERE code = ${code} AND is_active = true
      `);

      if (codeResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or inactive referral code' });
      }

      const referralCode = codeResult.rows[0] as any;

      // Can't refer yourself
      if (referralCode.tenant_id === tenantId) {
        return res.status(400).json({ error: 'Cannot use your own referral code' });
      }

      // Check if tenant already redeemed a referral
      const alreadyRedeemed = await db.execute(sql`
        SELECT id FROM referral_redemptions WHERE referred_tenant_id = ${tenantId}
      `);
      if (alreadyRedeemed.rows.length > 0) {
        return res.status(400).json({ error: 'A referral code has already been redeemed for this account' });
      }

      // Create the redemption record
      await db.execute(sql`
        INSERT INTO referral_redemptions (referral_code_id, referrer_tenant_id, referred_tenant_id)
        VALUES (${referralCode.id}, ${referralCode.tenant_id}, ${tenantId})
      `);

      // Extend referee's trial by 30 days
      await db.execute(sql`
        UPDATE tenants
        SET trial_ends_at = GREATEST(trial_ends_at, NOW()) + INTERVAL '30 days'
        WHERE id = ${tenantId}
      `);

      res.json({ success: true, message: 'Referral code redeemed! Your trial has been extended by 30 days.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // RESELLER & LICENSE CODE ROUTES (Platform Admin Only)
  // =====================================================
  
  // Get reseller volume discount tiers
  app.get('/api/reseller-volume-tiers', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM reseller_volume_tiers ORDER BY min_locations
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all resellers (platform admin only)
  app.get('/api/resellers', requirePlatformAdmin, async (req, res) => {
    try {
      const resellers = await db.execute(sql`
        SELECT * FROM resellers 
        ORDER BY created_at DESC
      `);
      res.json(resellers.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single reseller with license codes (platform admin only)
  app.get('/api/resellers/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const reseller = await db.execute(sql`
        SELECT * FROM resellers WHERE id = ${req.params.id}
      `);
      if (!reseller.rows.length) {
        return res.status(404).json({ error: 'Reseller not found' });
      }
      
      const licenseCodes = await db.execute(sql`
        SELECT lc.*, t.name as tenant_name, v.display_name as vertical_name
        FROM license_codes lc
        LEFT JOIN tenants t ON lc.tenant_id = t.id
        LEFT JOIN verticals v ON lc.vertical_id = v.id
        WHERE lc.reseller_id = ${req.params.id}
        ORDER BY lc.created_at DESC
      `);

      const verticals = await db.execute(sql`
        SELECT v.*, (SELECT COUNT(*) FROM tenants t WHERE t.vertical_id = v.id) as tenant_count
        FROM verticals v
        WHERE v.reseller_id = ${req.params.id}
        ORDER BY v.created_at DESC
      `);

      const referredTenants = await db.execute(sql`
        SELECT t.id, t.name, t.created_at, v.display_name as vertical_name
        FROM tenants t
        LEFT JOIN verticals v ON t.vertical_id = v.id
        WHERE t.reseller_id = ${req.params.id}
        ORDER BY t.created_at DESC
      `);

      res.json({
        ...reseller.rows[0],
        licenseCodes: licenseCodes.rows,
        verticals: verticals.rows,
        referredTenants: referredTenants.rows,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create reseller (platform admin only)
  app.post('/api/resellers', requirePlatformAdmin, async (req, res) => {
    try {
      const { name, contactEmail, contactName, phone, companyAddress, seatsTotal, revenueSharePercent, notes,
              tier, discountPercent, minimumSeats, billingCycle, annualCommitment } = req.body;

      const result = await db.execute(sql`
        INSERT INTO resellers (name, contact_email, contact_name, phone, company_address, seats_total,
                               revenue_share_percent, notes, tier, discount_percent, minimum_seats,
                               billing_cycle, annual_commitment, tier_updated_at)
        VALUES (${name}, ${contactEmail}, ${contactName}, ${phone}, ${companyAddress}, ${seatsTotal || 0},
                ${revenueSharePercent || 0}, ${notes}, ${tier || 'authorized'}, ${discountPercent || 20},
                ${minimumSeats || 0}, ${billingCycle || 'monthly'}, ${annualCommitment || 0}, NOW())
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update reseller (platform admin only)
  app.put('/api/resellers/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const { name, contactEmail, contactName, phone, companyAddress, seatsTotal, revenueSharePercent, notes, isActive,
              tier, discountPercent, minimumSeats, billingCycle, annualCommitment } = req.body;

      const result = await db.execute(sql`
        UPDATE resellers
        SET name = ${name},
            contact_email = ${contactEmail},
            contact_name = ${contactName},
            phone = ${phone},
            company_address = ${companyAddress},
            seats_total = ${seatsTotal},
            revenue_share_percent = ${revenueSharePercent || 0},
            notes = ${notes},
            is_active = ${isActive},
            tier = ${tier || 'authorized'},
            discount_percent = ${discountPercent || 20},
            minimum_seats = ${minimumSeats || 0},
            billing_cycle = ${billingCycle || 'monthly'},
            annual_commitment = ${annualCommitment || 0},
            tier_updated_at = NOW(),
            updated_at = NOW()
        WHERE id = ${req.params.id}
        RETURNING *
      `);

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Reseller not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete reseller (platform admin only)
  app.delete('/api/resellers/:id', requirePlatformAdmin, async (req, res) => {
    try {
      await db.execute(sql`DELETE FROM resellers WHERE id = ${req.params.id}`);
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate license codes for a reseller (platform admin only)
  app.post('/api/resellers/:id/generate-codes', requirePlatformAdmin, async (req, res) => {
    try {
      const { count = 1, subscriptionPlan = 'premium', expiresAt, verticalId } = req.body;
      const resellerId = req.params.id;
      
      // Check reseller exists and has available seats
      const reseller = await db.execute(sql`
        SELECT * FROM resellers WHERE id = ${resellerId}
      `);
      
      if (!reseller.rows.length) {
        return res.status(404).json({ error: 'Reseller not found' });
      }
      
      const resellerData = reseller.rows[0] as any;
      const availableSeats = resellerData.seats_total - resellerData.seats_used;
      
      // Count existing unredeemed codes
      const unredeemedCodes = await db.execute(sql`
        SELECT COUNT(*) as count FROM license_codes 
        WHERE reseller_id = ${resellerId} AND redeemed_at IS NULL
      `);
      const pendingCodes = parseInt((unredeemedCodes.rows[0] as any).count) || 0;
      
      if (count > availableSeats - pendingCodes) {
        return res.status(400).json({ 
          error: `Cannot generate ${count} codes. Only ${availableSeats - pendingCodes} seats available.` 
        });
      }
      
      const codes = [];
      for (let i = 0; i < count; i++) {
        // Generate unique code
        const codeResult = await db.execute(sql`SELECT generate_license_code() as code`);
        const code = (codeResult.rows[0] as any).code;
        
        const result = await db.execute(sql`
          INSERT INTO license_codes (code, reseller_id, subscription_plan, expires_at, vertical_id)
          VALUES (${code}, ${resellerId}, ${subscriptionPlan}, ${expiresAt || null}, ${verticalId || null})
          RETURNING *
        `);
        codes.push(result.rows[0]);
      }
      
      res.status(201).json(codes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate a license code (public endpoint for signup flow)
  app.get('/api/license-codes/validate/:code', async (req, res) => {
    try {
      const code = req.params.code.toUpperCase().replace(/-/g, '');
      
      const result = await db.execute(sql`
        SELECT lc.*, r.name as reseller_name, v.display_name as vertical_name, v.slug as vertical_slug
        FROM license_codes lc
        JOIN resellers r ON lc.reseller_id = r.id
        LEFT JOIN verticals v ON lc.vertical_id = v.id
        WHERE REPLACE(lc.code, '-', '') = ${code}
        AND lc.redeemed_at IS NULL
        AND (lc.expires_at IS NULL OR lc.expires_at > NOW())
        AND r.is_active = true
      `);

      if (!result.rows.length) {
        return res.status(404).json({ valid: false, error: 'Invalid or expired license code' });
      }

      const license = result.rows[0] as any;
      res.json({
        valid: true,
        code: license.code,
        subscriptionPlan: license.subscription_plan,
        resellerName: license.reseller_name,
        verticalName: license.vertical_name,
        verticalSlug: license.vertical_slug,
      });
    } catch (error: any) {
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // Redeem a license code (called during signup - requires authenticated user)
  app.post('/api/license-codes/redeem', async (req, res) => {
    try {
      const { code } = req.body;
      const { userId } = await getUserIdFromRequest(req);

      // Require authentication
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!code) {
        return res.status(400).json({ error: 'License code is required' });
      }
      
      // Get the tenant ID server-side from the user's profile (don't trust client)
      const userProfile = await db.execute(sql`
        SELECT tenant_id FROM user_profiles 
        WHERE user_id = ${userId}::uuid
        LIMIT 1
      `);
      
      if (!userProfile.rows.length) {
        return res.status(403).json({ error: 'User profile not found' });
      }
      
      const tenantId = (userProfile.rows[0] as any).tenant_id;
      
      if (!tenantId) {
        return res.status(403).json({ error: 'User has no associated tenant' });
      }
      
      const result = await db.execute(sql`
        SELECT redeem_license_code(${code}, ${tenantId}::uuid) as license_id
      `);
      
      const licenseId = (result.rows[0] as any).license_id;
      
      if (!licenseId) {
        return res.status(400).json({ error: 'Invalid or already redeemed license code' });
      }
      
      res.json({ success: true, licenseId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all license codes (platform admin only)
  app.get('/api/license-codes', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT lc.*, r.name as reseller_name, t.name as tenant_name
        FROM license_codes lc
        JOIN resellers r ON lc.reseller_id = r.id
        LEFT JOIN tenants t ON lc.tenant_id = t.id
        ORDER BY lc.created_at DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a license code (platform admin only, only if unredeemed)
  app.delete('/api/license-codes/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        DELETE FROM license_codes 
        WHERE id = ${req.params.id} AND redeemed_at IS NULL
        RETURNING *
      `);
      
      if (!result.rows.length) {
        return res.status(400).json({ error: 'Cannot delete redeemed license code' });
      }
      
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // BETA INVITE ROUTES (Platform Admin Only)
  // =====================================================

  app.post('/api/beta-invite', requirePlatformAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      // Find or create "Platform Direct" reseller for beta invites
      let resellerResult = await db.execute(sql`
        SELECT id FROM resellers WHERE name = 'Platform Direct' LIMIT 1
      `);
      let resellerId: string;
      if (resellerResult.rows.length === 0) {
        const created = await db.execute(sql`
          INSERT INTO resellers (name, contact_email, contact_name, seats_total, notes)
          VALUES ('Platform Direct', 'admin@coffeemanagementsuite.com', 'Platform', 9999, 'System reseller for direct beta invites')
          RETURNING id
        `);
        resellerId = (created.rows[0] as any).id;
      } else {
        resellerId = (resellerResult.rows[0] as any).id;
      }

      // Generate license code
      const codeResult = await db.execute(sql`SELECT generate_license_code() as code`);
      const code = (codeResult.rows[0] as any).code;

      // Insert license code
      await db.execute(sql`
        INSERT INTO license_codes (code, reseller_id, subscription_plan, invited_email, expires_at)
        VALUES (${code}, ${resellerId}, 'beta', ${email}, NOW() + INTERVAL '90 days')
      `);

      // Send invite email — use APP_URL in production so links aren't localhost
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const emailResult = await sendBetaInviteEmail({
        recipientEmail: email,
        licenseCode: code,
        signupUrl: `${baseUrl}/signup/${code}`,
      });

      if (!emailResult.success) {
        // Code was created but email failed — still return success with warning
        return res.json({ success: true, code, email, emailSent: false, emailError: emailResult.error });
      }

      res.json({ success: true, code, email, emailSent: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/beta-invites', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT lc.id, lc.code, lc.invited_email, lc.subscription_plan,
               lc.redeemed_at, lc.expires_at, lc.created_at,
               t.name as tenant_name
        FROM license_codes lc
        LEFT JOIN tenants t ON lc.tenant_id = t.id
        WHERE lc.subscription_plan = 'beta'
        ORDER BY lc.created_at DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/beta-invite/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(sql`
        DELETE FROM license_codes WHERE id = ${id}::uuid AND subscription_plan = 'beta'
      `);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // BETA SIGNUP (Public — license code is the auth gate)
  // =====================================================

  app.post('/api/beta-signup', async (req, res) => {
    try {
      const { code, email, password, fullName, businessName } = req.body;
      if (!code || !email || !password || !fullName || !businessName) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // 1. Validate license code
      const cleanCode = code.toUpperCase().replace(/-/g, '');
      const licenseResult = await db.execute(sql`
        SELECT lc.*, r.name as reseller_name
        FROM license_codes lc
        JOIN resellers r ON lc.reseller_id = r.id
        WHERE REPLACE(lc.code, '-', '') = ${cleanCode}
        AND lc.redeemed_at IS NULL
        AND (lc.expires_at IS NULL OR lc.expires_at > NOW())
        AND r.is_active = true
      `);

      if (!licenseResult.rows.length) {
        return res.status(400).json({ error: 'Invalid or expired license code' });
      }

      const license = licenseResult.rows[0] as any;

      // 2. Create tenant
      let slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let tenantResult;
      try {
        tenantResult = await db.execute(sql`
          INSERT INTO tenants (name, slug, subscription_plan, subscription_status)
          VALUES (${businessName}, ${slug}, ${license.subscription_plan}, 'active')
          RETURNING id, name, slug
        `);
      } catch (slugError: any) {
        // Slug conflict — append random suffix
        if (slugError.message?.includes('unique') || slugError.code === '23505') {
          slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
          tenantResult = await db.execute(sql`
            INSERT INTO tenants (name, slug, subscription_plan, subscription_status)
            VALUES (${businessName}, ${slug}, ${license.subscription_plan}, 'active')
            RETURNING id, name, slug
          `);
        } else {
          throw slugError;
        }
      }
      const tenant = tenantResult.rows[0] as { id: string; name: string; slug: string };

      // 3. Create tenant branding with default coffee theme
      await db.execute(sql`
        INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, background_color, company_name)
        VALUES (${tenant.id}::uuid, '#334155', '#0F172A', '#F1F5F9', '#FFFFFF', ${businessName})
      `);

      // 4. Create Supabase auth user via admin API
      const supabaseAdmin = (await import('./supabaseAdmin')).getSupabaseAdmin();
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError || !newUserData?.user) {
        // Clean up tenant on failure
        await db.execute(sql`DELETE FROM tenant_branding WHERE tenant_id = ${tenant.id}::uuid`);
        await db.execute(sql`DELETE FROM tenants WHERE id = ${tenant.id}::uuid`);
        const msg = createError?.message || 'Failed to create user account';
        const friendlyMsg = msg.includes('already been registered')
          ? 'An account with this email already exists. Please sign in instead.'
          : msg;
        return res.status(400).json({ error: friendlyMsg });
      }

      const userId = newUserData.user.id;

      // 5. Create user_profiles row
      await db.execute(sql`
        INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
        VALUES (${userId}::uuid, ${tenant.id}::uuid, ${email}, ${fullName}, 'owner', true)
      `);

      // 6. Enable modules that match the plan's rollout phase
      // Only add modules whose rollout_status is 'ga' or matches the plan tier
      // (e.g., beta plan gets 'ga' + 'beta' modules; internal modules are admin-only)
      const planModules = await db.execute(sql`
        SELECT m.id FROM modules m
        INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = ${license.subscription_plan}
        WHERE m.rollout_status = 'ga'
           OR (m.rollout_status = 'beta' AND ${license.subscription_plan} IN ('beta', 'premium'))
      `);
      for (const mod of planModules.rows) {
        await db.execute(sql`
          INSERT INTO tenant_module_subscriptions (tenant_id, module_id)
          VALUES (${tenant.id}::uuid, ${(mod as any).id})
          ON CONFLICT DO NOTHING
        `);
      }

      // 7. Redeem license code
      // Note: The redeem_license_code() DB function has a WHERE clause bug that fails
      // to match codes stored with dashes. We handle redemption inline instead.
      await db.execute(sql`
        UPDATE license_codes
        SET redeemed_at = NOW(), tenant_id = ${tenant.id}::uuid
        WHERE id = ${license.id}::uuid AND redeemed_at IS NULL
      `);
      await db.execute(sql`
        UPDATE tenants
        SET reseller_id = ${license.reseller_id}::uuid, license_code_id = ${license.id}::uuid
        WHERE id = ${tenant.id}::uuid
      `);
      await db.execute(sql`
        UPDATE resellers SET seats_used = seats_used + 1
        WHERE id = ${license.reseller_id}::uuid
      `);

      res.status(201).json({
        success: true,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        user: { id: userId, email },
      });
    } catch (error: any) {
      console.error('Beta signup error:', error);
      res.status(500).json({ error: error.message || 'Signup failed' });
    }
  });

  // =====================================================
  // ANALYTICS ROUTES (Platform Admin Only)
  // =====================================================

  app.get('/api/analytics/module-usage', requirePlatformAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const modules = await db.execute(sql`
        SELECT
          details->>'module_id' as module_id,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) as visit_count,
          COUNT(DISTINCT tenant_id) as tenant_count
        FROM tenant_activity_log
        WHERE action = 'module_visit'
          AND created_at >= NOW() - make_interval(days => ${days})
        GROUP BY details->>'module_id'
        ORDER BY visit_count DESC
      `);

      const trend = await db.execute(sql`
        SELECT
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as visits
        FROM tenant_activity_log
        WHERE action = 'module_visit'
          AND created_at >= NOW() - make_interval(days => ${days})
        GROUP BY DATE(created_at)
        ORDER BY date
      `);

      res.json({ modules: modules.rows, trend: trend.rows });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // VERTICAL MANAGEMENT ROUTES (Platform Admin Only)
  // =====================================================

  // Get all verticals (public for landing pages, full list for admins)
  app.get('/api/verticals', async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT v.*, r.name as reseller_name
        FROM verticals v
        LEFT JOIN resellers r ON v.reseller_id = r.id
        ORDER BY v.is_system DESC, v.created_at ASC
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get verticals for a specific reseller
  app.get('/api/resellers/:id/verticals', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM verticals
        WHERE reseller_id = ${req.params.id}
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a vertical (platform admin, optionally for a reseller)
  app.post('/api/verticals', requirePlatformAdmin, async (req, res) => {
    try {
      const {
        slug, productName, displayName, resellerId,
        theme, terms, workflows, suggestedModules,
        landingContent, domains, isPublished
      } = req.body;

      if (!slug || !productName || !displayName) {
        return res.status(400).json({ error: 'slug, productName, and displayName are required' });
      }

      const result = await db.execute(sql`
        INSERT INTO verticals (
          slug, product_name, display_name, reseller_id, is_system,
          theme, terms, workflows, suggested_modules,
          landing_content, domains, is_published
        ) VALUES (
          ${slug}, ${productName}, ${displayName}, ${resellerId || null}, ${!resellerId},
          ${JSON.stringify(theme || {})}::jsonb,
          ${JSON.stringify(terms || {})}::jsonb,
          ${JSON.stringify(workflows || {})}::jsonb,
          ${suggestedModules || []}::text[],
          ${JSON.stringify(landingContent || {})}::jsonb,
          ${domains || []}::text[],
          ${isPublished ?? false}
        )
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error.message?.includes('unique')) {
        return res.status(409).json({ error: 'A vertical with that slug already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update a vertical
  app.put('/api/verticals/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const {
        slug, productName, displayName,
        theme, terms, workflows, suggestedModules,
        landingContent, domains, isPublished
      } = req.body;

      const result = await db.execute(sql`
        UPDATE verticals SET
          slug = COALESCE(${slug}, slug),
          product_name = COALESCE(${productName}, product_name),
          display_name = COALESCE(${displayName}, display_name),
          theme = COALESCE(${theme ? JSON.stringify(theme) : null}::jsonb, theme),
          terms = COALESCE(${terms ? JSON.stringify(terms) : null}::jsonb, terms),
          workflows = COALESCE(${workflows ? JSON.stringify(workflows) : null}::jsonb, workflows),
          suggested_modules = COALESCE(${suggestedModules}::text[], suggested_modules),
          landing_content = COALESCE(${landingContent ? JSON.stringify(landingContent) : null}::jsonb, landing_content),
          domains = COALESCE(${domains}::text[], domains),
          is_published = COALESCE(${isPublished}, is_published),
          updated_at = NOW()
        WHERE id = ${req.params.id}
        RETURNING *
      `);

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Vertical not found' });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a vertical (only non-system verticals with no tenants)
  app.delete('/api/verticals/:id', requirePlatformAdmin, async (req, res) => {
    try {
      // Check for active tenants
      const tenantCheck = await db.execute(sql`
        SELECT COUNT(*) as count FROM tenants WHERE vertical_id = ${req.params.id}
      `);
      if (parseInt((tenantCheck.rows[0] as any).count) > 0) {
        return res.status(400).json({ error: 'Cannot delete vertical with active tenants' });
      }

      const result = await db.execute(sql`
        DELETE FROM verticals WHERE id = ${req.params.id} AND is_system = false
        RETURNING *
      `);

      if (!result.rows.length) {
        return res.status(400).json({ error: 'Cannot delete system verticals' });
      }

      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reseller analytics — signups, active tenants, revenue per vertical
  app.get('/api/resellers/:id/analytics', requirePlatformAdmin, async (req, res) => {
    try {
      const resellerId = req.params.id;

      // Total tenants via this reseller
      const tenants = await db.execute(sql`
        SELECT t.id, t.name, t.created_at, v.display_name as vertical_name,
               lc.subscription_plan
        FROM tenants t
        LEFT JOIN verticals v ON t.vertical_id = v.id
        LEFT JOIN license_codes lc ON t.license_code_id = lc.id
        WHERE t.reseller_id = ${resellerId}
        ORDER BY t.created_at DESC
      `);

      // Revenue share info
      const reseller = await db.execute(sql`
        SELECT revenue_share_percent, seats_total, seats_used
        FROM resellers WHERE id = ${resellerId}
      `);

      // Verticals created by this reseller
      const verticals = await db.execute(sql`
        SELECT v.id, v.slug, v.display_name, v.is_published,
               (SELECT COUNT(*) FROM tenants t WHERE t.vertical_id = v.id) as tenant_count
        FROM verticals v
        WHERE v.reseller_id = ${resellerId}
        ORDER BY v.created_at DESC
      `);

      const resellerData = reseller.rows[0] as any;

      res.json({
        tenants: tenants.rows,
        totalTenants: tenants.rows.length,
        verticals: verticals.rows,
        revenueSharePercent: parseFloat(resellerData?.revenue_share_percent || '0'),
        seatsTotal: resellerData?.seats_total || 0,
        seatsUsed: resellerData?.seats_used || 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // TENANT CREATION (handles existing users)
  // =====================================================

  app.post('/api/tenants', requirePlatformAdmin, async (req, res) => {
    try {
      const { name, slug, ownerEmail, ownerName, ownerPassword } = req.body;
      if (!name || !slug || !ownerEmail) {
        return res.status(400).json({ error: 'name, slug, and ownerEmail are required' });
      }

      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // 1. Create the tenant
      const tenantResult = await db.execute(sql`
        INSERT INTO tenants (name, slug)
        VALUES (${name}, ${cleanSlug})
        RETURNING id, name, slug
      `);
      const tenant = tenantResult.rows[0] as { id: string; name: string; slug: string };

      // 2. Create tenant branding
      await db.execute(sql`
        INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, background_color, company_name)
        VALUES (${tenant.id}::uuid, '#334155', '#0F172A', '#F1F5F9', '#FFFFFF', ${name})
      `);

      // 3. Find or create user via Supabase admin API
      const supabaseAdmin = (await import('./supabaseAdmin')).getSupabaseAdmin();
      let userId: string;

      // Try to create the user first
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword || undefined,
        email_confirm: true,
        user_metadata: { full_name: ownerName || ownerEmail.split('@')[0] },
      });

      if (newUserData?.user) {
        userId = newUserData.user.id;
      } else {
        // User likely already exists — look them up
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) throw listError;
        const existing = listData.users.find((u: any) => u.email === ownerEmail);
        if (!existing) {
          throw new Error(createError?.message || 'Could not find or create user with this email');
        }
        userId = existing.id;
      }

      // 4. Upsert user_profiles — set them as owner of this tenant
      await db.execute(sql`
        INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
        VALUES (${userId}::uuid, ${tenant.id}::uuid, ${ownerEmail}, ${ownerName || ownerEmail.split('@')[0]}, 'owner', true)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = ${tenant.id}::uuid,
          role = 'owner',
          is_active = true
      `);

      res.status(201).json({ tenant, userId });
    } catch (error: any) {
      // If tenant was created but later steps failed, try to clean up
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // PLATFORM ADMIN MANAGEMENT ROUTES
  // =====================================================

  // List all platform admins
  app.get('/api/platform-admins', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, email, full_name, is_active, created_at
        FROM platform_admins
        ORDER BY created_at ASC
      `);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add a new platform admin by email
  app.post('/api/platform-admins', requirePlatformAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Look up the user via Supabase admin API
      const supabaseAdmin = (await import('./supabaseAdmin')).getSupabaseAdmin();
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      const authUser = listData.users.find((u: any) => u.email === email);

      if (!authUser) {
        return res.status(404).json({ error: 'No user found with that email. They must have an account first.' });
      }

      // Check if already a platform admin
      const existingResult = await db.execute(sql`
        SELECT id FROM platform_admins WHERE id = ${authUser.id}::uuid
      `);

      if (existingResult.rows.length) {
        return res.status(409).json({ error: 'This user is already a platform admin' });
      }

      // Insert into platform_admins
      const insertResult = await db.execute(sql`
        INSERT INTO platform_admins (id, email, full_name, is_active)
        VALUES (${authUser.id}::uuid, ${authUser.email}, ${req.body.full_name || null}, true)
        RETURNING id, email, full_name, is_active, created_at
      `);

      res.status(201).json(insertResult.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove a platform admin
  app.delete('/api/platform-admins/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const requesterId = (req as any).userId as string;

      // Prevent removing yourself
      if (req.params.id === requesterId) {
        return res.status(400).json({ error: 'You cannot remove yourself as a platform admin' });
      }

      const result = await db.execute(sql`
        DELETE FROM platform_admins WHERE id = ${req.params.id}::uuid RETURNING *
      `);

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Platform admin not found' });
      }

      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // USER INVITE ROUTE
  // =====================================================

  app.post('/api/users/invite', async (req, res) => {
    try {
      const { email, fullName, role, tenantId, requestingUserId } = req.body;

      if (!email || !tenantId || !requestingUserId) {
        return res.status(400).json({ error: 'Email, tenantId, and requestingUserId are required' });
      }

      // Verify the requesting user is an owner or manager of this tenant
      const requesterResult = await db.execute(sql`
        SELECT role FROM user_profiles
        WHERE id = ${requestingUserId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true
        LIMIT 1
      `);
      if (!requesterResult.rows.length || !['owner', 'manager'].includes((requesterResult.rows[0] as any).role)) {
        return res.status(403).json({ error: 'Only owners and managers can invite users' });
      }

      const supabaseAdmin = (await import('./supabaseAdmin')).getSupabaseAdmin();
      let userId: string;
      let isNewUser = false;

      // Try to invite the user (creates auth user + sends Supabase invite email)
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName || email.split('@')[0] },
      });

      if (inviteData?.user) {
        userId = inviteData.user.id;
        isNewUser = true;
      } else {
        // User already exists in auth — look them up
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) throw listError;
        const existing = listData.users.find((u: any) => u.email === email);
        if (!existing) {
          throw new Error(inviteError?.message || 'Could not find or create user with this email');
        }
        userId = existing.id;

        // Send password recovery email so the user can set their own password
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const anonClient = createClient(supabaseUrl, supabaseKey);
          const { error: resetError } = await anonClient.auth.resetPasswordForEmail(email);
          if (resetError) {
            console.warn('Password reset email failed:', resetError.message);
          }
        }
      }

      // Upsert user profile
      await db.execute(sql`
        INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
        VALUES (${userId}::uuid, ${tenantId}::uuid, ${email}, ${fullName || email.split('@')[0]}, ${role || 'employee'}, true)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = ${tenantId}::uuid,
          role = ${role || 'employee'},
          full_name = ${fullName || email.split('@')[0]},
          is_active = true
      `);

      res.status(201).json({ userId, email, isNewUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── iCal Sync ───────────────────────────────────────────────
  app.post('/api/calendar/sync-ical', async (req: Request, res: Response) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' });

    try {
      // Fetch subscription
      const subResult = await db.execute(sql`
        SELECT * FROM ical_subscriptions WHERE id = ${subscriptionId}::uuid
      `);
      if (!subResult.rows.length) return res.status(404).json({ error: 'Subscription not found' });
      const sub = subResult.rows[0] as any;

      // Verify user belongs to this tenant with lead+ role
      const roleResult = await db.execute(sql`
        SELECT role FROM user_profiles
        WHERE id = ${userId}::uuid AND tenant_id = ${sub.tenant_id}::uuid
      `);
      if (!roleResult.rows.length) return res.status(403).json({ error: 'Not authorized' });
      const role = (roleResult.rows[0] as any).role;
      if (!['owner', 'manager', 'lead'].includes(role)) {
        return res.status(403).json({ error: 'Lead role or higher required' });
      }

      // Fetch + parse iCal feed (webcal:// → https://)
      const feedUrl = (sub.url as string).replace(/^webcal:\/\//i, 'https://');
      const events = await ical.async.fromURL(feedUrl);
      let syncCount = 0;

      for (const [, event] of Object.entries(events)) {
        if ((event as any).type !== 'VEVENT') continue;
        const vevent = event as ical.VEvent;

        const startDate = vevent.start?.toISOString().split('T')[0];
        if (!startDate) continue;
        const endDate = vevent.end?.toISOString().split('T')[0] || startDate;
        const title = vevent.summary || 'Untitled Event';
        const description = vevent.description || null;
        const location = vevent.location || null;
        const uid = vevent.uid || null;

        if (!uid) continue;

        await db.execute(sql`
          INSERT INTO calendar_events (
            tenant_id, title, description, start_date, end_date,
            location, color, source, ical_uid, ical_subscription_id
          ) VALUES (
            ${sub.tenant_id}::uuid,
            ${title},
            ${description},
            ${startDate},
            ${endDate},
            ${location},
            ${sub.color || '#3b82f6'},
            'ical',
            ${uid},
            ${subscriptionId}::uuid
          )
          ON CONFLICT (ical_subscription_id, ical_uid)
          WHERE ical_uid IS NOT NULL
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            location = EXCLUDED.location,
            updated_at = NOW()
        `);
        syncCount++;
      }

      // Update last_synced_at
      await db.execute(sql`
        UPDATE ical_subscriptions
        SET last_synced_at = NOW(), sync_error = NULL, updated_at = NOW()
        WHERE id = ${subscriptionId}::uuid
      `);

      res.json({ success: true, count: syncCount });
    } catch (err: any) {
      // Store error on subscription for visibility
      try {
        await db.execute(sql`
          UPDATE ical_subscriptions
          SET sync_error = ${err.message || 'Unknown error'}, updated_at = NOW()
          WHERE id = ${subscriptionId}::uuid
        `);
      } catch { /* ignore */ }
      res.status(500).json({ error: 'Failed to sync iCal feed', details: err.message });
    }
  });

  // ─── KIOSK ENDPOINTS ──────────────────────────────────────

  // Rate limiting for PIN attempts
  const kioskRateLimit = new Map<string, { count: number; resetTime: number }>();
  function checkKioskRate(ip: string): boolean {
    const now = Date.now();
    const entry = kioskRateLimit.get(ip);
    if (!entry || now >= entry.resetTime) {
      kioskRateLimit.set(ip, { count: 1, resetTime: now + 60_000 });
      return true;
    }
    if (entry.count >= 10) return false;
    entry.count++;
    return true;
  }

  // POST /api/kiosk/verify — validate store code, return tenant info
  app.post('/api/kiosk/verify', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Store code is required' });
      }
      const result = await db.execute(sql`
        SELECT t.id, t.name, tb.logo_url
        FROM tenants t
        LEFT JOIN tenant_branding tb ON tb.tenant_id = t.id
        WHERE UPPER(t.kiosk_code) = UPPER(${code.trim()})
        LIMIT 1
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Store not found' });
      }
      const row = result.rows[0] as any;
      res.json({ tenantId: row.id, tenantName: row.name, logoUrl: row.logo_url || null });
    } catch (err: any) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/kiosk/punch — look up employee by PIN, return clock status
  app.post('/api/kiosk/punch', async (req, res) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkKioskRate(ip)) {
        return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
      }
      const { tenantId, pin } = req.body;
      if (!tenantId || !pin) {
        return res.status(400).json({ error: 'Missing tenantId or pin' });
      }

      // Look up in user_profiles first, then tip_employees
      let emp: { id: string; fullName: string; avatarUrl: string | null; role: string; source: 'user_profile' | 'tip_employee' } | null = null;

      const upResult = await db.execute(sql`
        SELECT id, full_name, avatar_url, role
        FROM user_profiles
        WHERE tenant_id = ${tenantId}::uuid AND kiosk_pin = ${pin} AND is_active = true
        LIMIT 1
      `);
      if (upResult.rows.length > 0) {
        const r = upResult.rows[0] as any;
        emp = { id: r.id, fullName: r.full_name, avatarUrl: r.avatar_url, role: r.role, source: 'user_profile' };
      } else {
        // Check tip_employees
        const teResult = await db.execute(sql`
          SELECT id, name, avatar_url
          FROM tip_employees
          WHERE tenant_id = ${tenantId}::uuid AND kiosk_pin = ${pin} AND is_active = true
          LIMIT 1
        `);
        if (teResult.rows.length > 0) {
          const r = teResult.rows[0] as any;
          emp = { id: r.id, fullName: r.name, avatarUrl: r.avatar_url || null, role: 'employee', source: 'tip_employee' };
        }
      }

      if (!emp) {
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      // Check for active clock entry (could be under employee_id or tip_employee_id)
      const entryResult = emp.source === 'user_profile'
        ? await db.execute(sql`
            SELECT tce.id, tce.clock_in,
                   tcb.id AS break_id, tcb.break_start
            FROM time_clock_entries tce
            LEFT JOIN time_clock_breaks tcb
              ON tcb.time_clock_entry_id = tce.id AND tcb.break_end IS NULL
            WHERE tce.employee_id = ${emp.id}::uuid
              AND tce.tenant_id = ${tenantId}::uuid
              AND tce.clock_out IS NULL
            ORDER BY tce.clock_in DESC
            LIMIT 1
          `)
        : await db.execute(sql`
            SELECT tce.id, tce.clock_in,
                   tcb.id AS break_id, tcb.break_start
            FROM time_clock_entries tce
            LEFT JOIN time_clock_breaks tcb
              ON tcb.time_clock_entry_id = tce.id AND tcb.break_end IS NULL
            WHERE tce.tip_employee_id = ${emp.id}::uuid
              AND tce.tenant_id = ${tenantId}::uuid
              AND tce.clock_out IS NULL
            ORDER BY tce.clock_in DESC
            LIMIT 1
          `);

      let status: 'clocked_out' | 'clocked_in' | 'on_break' = 'clocked_out';
      let activeEntryId: string | null = null;
      let clockInTime: string | null = null;
      let activeBreakId: string | null = null;
      let breakStartTime: string | null = null;

      if (entryResult.rows.length > 0) {
        const row = entryResult.rows[0] as any;
        activeEntryId = row.id;
        clockInTime = row.clock_in;
        if (row.break_id) {
          status = 'on_break';
          activeBreakId = row.break_id;
          breakStartTime = row.break_start;
        } else {
          status = 'clocked_in';
        }
      }

      res.json({
        employee: { id: emp.id, fullName: emp.fullName, avatarUrl: emp.avatarUrl, role: emp.role, source: emp.source },
        status,
        activeEntryId,
        clockInTime,
        activeBreakId,
        breakStartTime,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/kiosk/clock-in
  app.post('/api/kiosk/clock-in', async (req, res) => {
    try {
      const { tenantId, employeeId, source, employeeName } = req.body;
      if (!tenantId || !employeeId) {
        return res.status(400).json({ error: 'Missing tenantId or employeeId' });
      }
      const isTipEmployee = source === 'tip_employee';

      // Verify employee belongs to tenant
      const empCheck = isTipEmployee
        ? await db.execute(sql`SELECT name FROM tip_employees WHERE id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true LIMIT 1`)
        : await db.execute(sql`SELECT full_name as name FROM user_profiles WHERE id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true LIMIT 1`);
      if (empCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Invalid employee' });
      }
      const name = employeeName || (empCheck.rows[0] as any).name;

      // Verify not already clocked in
      const idCol = isTipEmployee ? 'tip_employee_id' : 'employee_id';
      const openCheck = await db.execute(
        isTipEmployee
          ? sql`SELECT 1 FROM time_clock_entries WHERE tip_employee_id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND clock_out IS NULL LIMIT 1`
          : sql`SELECT 1 FROM time_clock_entries WHERE employee_id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid AND clock_out IS NULL LIMIT 1`
      );
      if (openCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Already clocked in' });
      }

      const result = isTipEmployee
        ? await db.execute(sql`
            INSERT INTO time_clock_entries (tenant_id, tip_employee_id, employee_name, clock_in)
            VALUES (${tenantId}::uuid, ${employeeId}::uuid, ${name}, NOW())
            RETURNING id, clock_in
          `)
        : await db.execute(sql`
            INSERT INTO time_clock_entries (tenant_id, employee_id, employee_name, clock_in)
            VALUES (${tenantId}::uuid, ${employeeId}::uuid, ${name}, NOW())
            RETURNING id, clock_in
          `);
      const row = result.rows[0] as any;
      res.json({ success: true, entryId: row.id, clockIn: row.clock_in });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to clock in' });
    }
  });

  // POST /api/kiosk/clock-out
  app.post('/api/kiosk/clock-out', async (req, res) => {
    try {
      const { tenantId, employeeId, entryId } = req.body;
      if (!tenantId || !employeeId || !entryId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      // End any active breaks
      await db.execute(sql`
        UPDATE time_clock_breaks
        SET break_end = NOW()
        WHERE time_clock_entry_id = ${entryId}::uuid AND break_end IS NULL
      `);
      // Clock out
      const result = await db.execute(sql`
        UPDATE time_clock_entries
        SET clock_out = NOW(), updated_at = NOW()
        WHERE id = ${entryId}::uuid AND employee_id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid
        RETURNING clock_out
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      const row = result.rows[0] as any;
      res.json({ success: true, clockOut: row.clock_out });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to clock out' });
    }
  });

  // POST /api/kiosk/break-start
  app.post('/api/kiosk/break-start', async (req, res) => {
    try {
      const { tenantId, employeeId, entryId } = req.body;
      if (!tenantId || !employeeId || !entryId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      // Verify no active break
      const activeBreak = await db.execute(sql`
        SELECT 1 FROM time_clock_breaks
        WHERE time_clock_entry_id = ${entryId}::uuid AND break_end IS NULL
        LIMIT 1
      `);
      if (activeBreak.rows.length > 0) {
        return res.status(409).json({ error: 'Already on break' });
      }
      const result = await db.execute(sql`
        INSERT INTO time_clock_breaks (tenant_id, time_clock_entry_id, break_start, break_type)
        VALUES (${tenantId}::uuid, ${entryId}::uuid, NOW(), 'break')
        RETURNING id, break_start
      `);
      const row = result.rows[0] as any;
      res.json({ success: true, breakId: row.id, breakStart: row.break_start });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to start break' });
    }
  });

  // POST /api/kiosk/break-end
  app.post('/api/kiosk/break-end', async (req, res) => {
    try {
      const { tenantId, breakId } = req.body;
      if (!tenantId || !breakId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const result = await db.execute(sql`
        UPDATE time_clock_breaks
        SET break_end = NOW()
        WHERE id = ${breakId}::uuid AND tenant_id = ${tenantId}::uuid AND break_end IS NULL
        RETURNING break_end
      `);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Break not found' });
      }
      const row = result.rows[0] as any;
      res.json({ success: true, breakEnd: row.break_end });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to end break' });
    }
  });

  // GET /api/kiosk/my-hours — employee's time entries for a date range
  app.get('/api/kiosk/my-hours', async (req, res) => {
    try {
      const { tenantId, employeeId, source, start, end } = req.query as Record<string, string>;
      if (!tenantId || !employeeId || !start || !end) {
        return res.status(400).json({ error: 'Missing required query params' });
      }
      const isTip = source === 'tip_employee';
      const result = await db.execute(
        isTip
          ? sql`
              SELECT tce.id, tce.clock_in, tce.clock_out, tce.notes,
                     COALESCE(
                       json_agg(
                         json_build_object('id', tcb.id, 'break_start', tcb.break_start, 'break_end', tcb.break_end)
                       ) FILTER (WHERE tcb.id IS NOT NULL),
                       '[]'
                     ) AS breaks,
                     CASE WHEN EXISTS (
                       SELECT 1 FROM time_clock_edit_requests tcer
                       WHERE tcer.entry_id = tce.id AND tcer.status = 'pending'
                     ) THEN true ELSE false END AS has_pending_edit
              FROM time_clock_entries tce
              LEFT JOIN time_clock_breaks tcb ON tcb.time_clock_entry_id = tce.id
              WHERE tce.tip_employee_id = ${employeeId}::uuid
                AND tce.tenant_id = ${tenantId}::uuid
                AND tce.clock_in >= ${start}::date
                AND tce.clock_in < (${end}::date + INTERVAL '1 day')
              GROUP BY tce.id
              ORDER BY tce.clock_in ASC
            `
          : sql`
              SELECT tce.id, tce.clock_in, tce.clock_out, tce.notes,
                     COALESCE(
                       json_agg(
                         json_build_object('id', tcb.id, 'break_start', tcb.break_start, 'break_end', tcb.break_end)
                       ) FILTER (WHERE tcb.id IS NOT NULL),
                       '[]'
                     ) AS breaks,
                     CASE WHEN EXISTS (
                       SELECT 1 FROM time_clock_edit_requests tcer
                       WHERE tcer.entry_id = tce.id AND tcer.status = 'pending'
                     ) THEN true ELSE false END AS has_pending_edit
              FROM time_clock_entries tce
              LEFT JOIN time_clock_breaks tcb ON tcb.time_clock_entry_id = tce.id
              WHERE tce.employee_id = ${employeeId}::uuid
                AND tce.tenant_id = ${tenantId}::uuid
                AND tce.clock_in >= ${start}::date
                AND tce.clock_in < (${end}::date + INTERVAL '1 day')
              GROUP BY tce.id
              ORDER BY tce.clock_in ASC
            `
      );
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch hours' });
    }
  });

  // POST /api/kiosk/edit-request — submit a time clock edit request
  app.post('/api/kiosk/edit-request', async (req, res) => {
    try {
      const { tenantId, employeeId, entryId, correctedClockIn, correctedClockOut, reason } = req.body;
      if (!tenantId || !employeeId || !entryId || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      // Verify entry belongs to employee
      const entryCheck = await db.execute(sql`
        SELECT 1 FROM time_clock_entries
        WHERE id = ${entryId}::uuid AND employee_id = ${employeeId}::uuid AND tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);
      if (entryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      const result = await db.execute(sql`
        INSERT INTO time_clock_edit_requests (tenant_id, entry_id, requested_by, corrected_clock_in, corrected_clock_out, reason, status)
        VALUES (${tenantId}::uuid, ${entryId}::uuid, ${employeeId}::uuid,
                ${correctedClockIn || null}::timestamptz, ${correctedClockOut || null}::timestamptz,
                ${reason}, 'pending')
        RETURNING id
      `);
      const row = result.rows[0] as any;
      res.json({ success: true, requestId: row.id });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to submit edit request' });
    }
  });

  // POST /api/kiosk/update-pin — manager updates employee PIN
  app.post('/api/kiosk/update-pin', async (req, res) => {
    try {
      const { userId, tenantId, newPin } = req.body;
      if (!userId || !tenantId || !newPin) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!/^\d{4}$/.test(newPin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }
      // Check uniqueness within tenant
      const dupCheck = await db.execute(sql`
        SELECT 1 FROM user_profiles
        WHERE tenant_id = ${tenantId}::uuid AND kiosk_pin = ${newPin} AND is_active = true AND id != ${userId}::uuid
        LIMIT 1
      `);
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'PIN already in use by another employee' });
      }
      await db.execute(sql`
        UPDATE user_profiles SET kiosk_pin = ${newPin}, updated_at = NOW()
        WHERE id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid
      `);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update PIN' });
    }
  });

  // POST /api/kiosk/set-code — owner sets kiosk store code
  app.post('/api/kiosk/set-code', async (req, res) => {
    try {
      const { tenantId, kioskCode } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'Missing tenantId' });
      }
      const code = (kioskCode || '').trim().toUpperCase();
      if (code && (code.length < 2 || code.length > 10 || !/^[A-Z0-9]+$/.test(code))) {
        return res.status(400).json({ error: 'Code must be 2-10 alphanumeric characters' });
      }
      // Check uniqueness
      if (code) {
        const dupCheck = await db.execute(sql`
          SELECT 1 FROM tenants WHERE UPPER(kiosk_code) = ${code} AND id != ${tenantId}::uuid
          LIMIT 1
        `);
        if (dupCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Code already in use by another store' });
        }
      }
      await db.execute(sql`
        UPDATE tenants SET kiosk_code = ${code || null} WHERE id = ${tenantId}::uuid
      `);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to set kiosk code' });
    }
  });

  // Location Clone Endpoint
  // POST /api/locations/clone
  // Copies recipes/ingredients, overhead settings, and/or equipment+tasks from one child location to another
  app.post('/api/locations/clone', async (req, res) => {
    try {
      // 1. Auth
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // 2. Parse body
      const { sourceTenantId, targetTenantId, options } = req.body;
      if (!sourceTenantId || !targetTenantId) {
        return res.status(400).json({ error: 'sourceTenantId and targetTenantId are required' });
      }

      const cloneOptions = {
        recipes: options?.recipes !== false,
        overhead: options?.overhead !== false,
        equipment: options?.equipment !== false,
      };

      // 3. Verify user is an owner
      const profileResult = await db.execute(sql`
        SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}::uuid LIMIT 1
      `);
      const profile = profileResult.rows[0] as any;
      if (!profile) {
        return res.status(403).json({ error: 'User profile not found' });
      }
      if (profile.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can clone location data' });
      }

      // 4. Verify source and target are children of the user's tenant
      const sourceResult = await db.execute(sql`
        SELECT id, parent_tenant_id FROM tenants WHERE id = ${sourceTenantId}::uuid LIMIT 1
      `);
      const targetResult = await db.execute(sql`
        SELECT id, parent_tenant_id FROM tenants WHERE id = ${targetTenantId}::uuid LIMIT 1
      `);
      const source = sourceResult.rows[0] as any;
      const target = targetResult.rows[0] as any;

      if (!source || !target) {
        return res.status(404).json({ error: 'Source or target location not found' });
      }
      const userTenantId = profile.tenant_id;
      if (source.parent_tenant_id !== userTenantId || target.parent_tenant_id !== userTenantId) {
        return res.status(403).json({ error: 'Not authorized to clone between these locations' });
      }

      // 5. Execute clone using service role admin client (bypasses RLS)
      const admin = getSupabaseAdmin();
      const counts = { recipes: 0, ingredients: 0, overhead: 0, equipment: 0, maintenanceTasks: 0 };

      // --- Clone Overhead Settings ---
      if (cloneOptions.overhead) {
        const { data: overheadItems, error: overheadReadErr } = await admin
          .from('overhead_settings')
          .select('*')
          .eq('tenant_id', sourceTenantId);
        if (overheadReadErr) throw new Error(`Reading overhead failed: ${overheadReadErr.message}`);

        if (overheadItems && overheadItems.length > 0) {
          const inserts = overheadItems.map(({ id: _id, tenant_id: _tid, ...rest }) => ({
            ...rest,
            id: crypto.randomUUID(),
            tenant_id: targetTenantId,
          }));
          const { error } = await admin.from('overhead_settings').insert(inserts);
          if (error) throw new Error(`Overhead clone failed: ${error.message}`);
          counts.overhead = inserts.length;
        }
      }

      // --- Clone Recipes & Ingredients ---
      if (cloneOptions.recipes) {
        // 1. ingredient_categories
        const { data: ingCats } = await admin
          .from('ingredient_categories').select('*').eq('tenant_id', sourceTenantId);
        const ingCatMap = new Map<string, string>();
        if (ingCats && ingCats.length > 0) {
          const inserts = ingCats.map(({ id, tenant_id: _tid, ...rest }) => {
            const newId = crypto.randomUUID();
            ingCatMap.set(id, newId);
            return { ...rest, id: newId, tenant_id: targetTenantId };
          });
          const { error } = await admin.from('ingredient_categories').insert(inserts);
          if (error) throw new Error(`Ingredient categories clone failed: ${error.message}`);
        }

        // 2. ingredients
        const { data: ingredients } = await admin
          .from('ingredients').select('*').eq('tenant_id', sourceTenantId);
        const ingredientMap = new Map<string, string>();
        if (ingredients && ingredients.length > 0) {
          const inserts = ingredients.map(({ id, tenant_id: _tid, category_id, ...rest }) => {
            const newId = crypto.randomUUID();
            ingredientMap.set(id, newId);
            return {
              ...rest,
              id: newId,
              tenant_id: targetTenantId,
              category_id: category_id ? (ingCatMap.get(category_id) ?? null) : null,
            };
          });
          const { error } = await admin.from('ingredients').insert(inserts);
          if (error) throw new Error(`Ingredients clone failed: ${error.message}`);
          counts.ingredients = inserts.length;
        }

        // 3. product_categories
        const { data: prodCats } = await admin
          .from('product_categories').select('*').eq('tenant_id', sourceTenantId);
        const prodCatMap = new Map<string, string>();
        if (prodCats && prodCats.length > 0) {
          const inserts = prodCats.map(({ id, tenant_id: _tid, ...rest }) => {
            const newId = crypto.randomUUID();
            prodCatMap.set(id, newId);
            return { ...rest, id: newId, tenant_id: targetTenantId };
          });
          const { error } = await admin.from('product_categories').insert(inserts);
          if (error) throw new Error(`Product categories clone failed: ${error.message}`);
        }

        // 4. product_sizes
        const { data: sizes } = await admin
          .from('product_sizes').select('*').eq('tenant_id', sourceTenantId);
        const sizeMap = new Map<string, string>();
        if (sizes && sizes.length > 0) {
          const inserts = sizes.map(({ id, tenant_id: _tid, ...rest }) => {
            const newId = crypto.randomUUID();
            sizeMap.set(id, newId);
            return { ...rest, id: newId, tenant_id: targetTenantId };
          });
          const { error } = await admin.from('product_sizes').insert(inserts);
          if (error) throw new Error(`Product sizes clone failed: ${error.message}`);
        }

        // 5. base_templates
        const { data: templates } = await admin
          .from('base_templates').select('*').eq('tenant_id', sourceTenantId);
        const templateMap = new Map<string, string>();
        if (templates && templates.length > 0) {
          const inserts = templates.map(({ id, tenant_id: _tid, ...rest }) => {
            const newId = crypto.randomUUID();
            templateMap.set(id, newId);
            return { ...rest, id: newId, tenant_id: targetTenantId };
          });
          const { error } = await admin.from('base_templates').insert(inserts);
          if (error) throw new Error(`Base templates clone failed: ${error.message}`);
        }

        // 6. base_template_ingredients
        if (templates && templates.length > 0) {
          const { data: bti } = await admin
            .from('base_template_ingredients')
            .select('*')
            .in('base_template_id', templates.map((t: any) => t.id));
          if (bti && bti.length > 0) {
            const inserts = bti.map(({ id: _id, base_template_id, ingredient_id, ...rest }: any) => ({
              ...rest,
              id: crypto.randomUUID(),
              base_template_id: templateMap.get(base_template_id) ?? base_template_id,
              ingredient_id: ingredientMap.get(ingredient_id) ?? ingredient_id,
            }));
            const { error } = await admin.from('base_template_ingredients').insert(inserts);
            if (error) throw new Error(`Base template ingredients clone failed: ${error.message}`);
          }
        }

        // 7. recipes
        const { data: recipes } = await admin
          .from('recipes').select('*').eq('tenant_id', sourceTenantId);
        const recipeMap = new Map<string, string>();
        if (recipes && recipes.length > 0) {
          const inserts = recipes.map(({ id, tenant_id: _tid, base_template_id, category_id, ...rest }: any) => {
            const newId = crypto.randomUUID();
            recipeMap.set(id, newId);
            return {
              ...rest,
              id: newId,
              tenant_id: targetTenantId,
              base_template_id: base_template_id ? (templateMap.get(base_template_id) ?? null) : null,
              category_id: category_id ? (prodCatMap.get(category_id) ?? null) : null,
            };
          });
          const { error } = await admin.from('recipes').insert(inserts);
          if (error) throw new Error(`Recipes clone failed: ${error.message}`);
          counts.recipes = inserts.length;

          const sourceRecipeIds = recipes.map((r: any) => r.id);

          // 8. recipe_ingredients
          const { data: recipeIngredients } = await admin
            .from('recipe_ingredients').select('*').in('recipe_id', sourceRecipeIds);
          if (recipeIngredients && recipeIngredients.length > 0) {
            const inserts = recipeIngredients.map(({ id: _id, recipe_id, ingredient_id, syrup_recipe_id, size_id, ...rest }: any) => ({
              ...rest,
              id: crypto.randomUUID(),
              recipe_id: recipeMap.get(recipe_id) ?? recipe_id,
              ingredient_id: ingredient_id ? (ingredientMap.get(ingredient_id) ?? ingredient_id) : null,
              syrup_recipe_id: syrup_recipe_id ? (recipeMap.get(syrup_recipe_id) ?? syrup_recipe_id) : null,
              size_id: size_id ? (sizeMap.get(size_id) ?? size_id) : null,
            }));
            const { error } = await admin.from('recipe_ingredients').insert(inserts);
            if (error) throw new Error(`Recipe ingredients clone failed: ${error.message}`);
          }

          // 9. recipe_size_bases
          const { data: rsb } = await admin
            .from('recipe_size_bases').select('*').in('recipe_id', sourceRecipeIds);
          if (rsb && rsb.length > 0) {
            const inserts = rsb.map(({ id, recipe_id, size_id, base_template_id, ...rest }: any) => ({
              ...rest,
              ...(id ? { id: crypto.randomUUID() } : {}),
              recipe_id: recipeMap.get(recipe_id) ?? recipe_id,
              size_id: size_id ? (sizeMap.get(size_id) ?? size_id) : null,
              base_template_id: base_template_id ? (templateMap.get(base_template_id) ?? base_template_id) : null,
            }));
            const { error } = await admin.from('recipe_size_bases').insert(inserts);
            if (error) throw new Error(`Recipe size bases clone failed: ${error.message}`);
          }

          // 10. recipe_size_pricing
          const { data: rsp } = await admin
            .from('recipe_size_pricing').select('*').in('recipe_id', sourceRecipeIds);
          if (rsp && rsp.length > 0) {
            const inserts = rsp.map(({ id: _id, recipe_id, size_id, ...rest }: any) => ({
              ...rest,
              id: crypto.randomUUID(),
              recipe_id: recipeMap.get(recipe_id) ?? recipe_id,
              size_id: size_id ? (sizeMap.get(size_id) ?? size_id) : null,
            }));
            const { error } = await admin.from('recipe_size_pricing').insert(inserts);
            if (error) throw new Error(`Recipe size pricing clone failed: ${error.message}`);
          }
        }
      }

      // --- Clone Equipment & Maintenance Tasks ---
      if (cloneOptions.equipment) {
        const { data: equipmentItems } = await admin
          .from('equipment').select('*').eq('tenant_id', sourceTenantId);
        const equipmentMap = new Map<string, string>();
        if (equipmentItems && equipmentItems.length > 0) {
          const inserts = equipmentItems.map(({ id, tenant_id: _tid, ...rest }: any) => {
            const newId = crypto.randomUUID();
            equipmentMap.set(id, newId);
            return { ...rest, id: newId, tenant_id: targetTenantId };
          });
          const { error } = await admin.from('equipment').insert(inserts);
          if (error) throw new Error(`Equipment clone failed: ${error.message}`);
          counts.equipment = inserts.length;

          const { data: tasks } = await admin
            .from('maintenance_tasks')
            .select('*')
            .in('equipment_id', equipmentItems.map((e: any) => e.id));
          if (tasks && tasks.length > 0) {
            const taskInserts = tasks.map(({ id: _id, tenant_id: _tid, equipment_id, ...rest }: any) => ({
              ...rest,
              id: crypto.randomUUID(),
              tenant_id: targetTenantId,
              equipment_id: equipmentMap.get(equipment_id) ?? equipment_id,
            }));
            const { error: taskError } = await admin.from('maintenance_tasks').insert(taskInserts);
            if (taskError) throw new Error(`Maintenance tasks clone failed: ${taskError.message}`);
            counts.maintenanceTasks = taskInserts.length;
          }
        }
      }

      res.json({ success: true, counts });
    } catch (err: any) {
      console.error('[location-clone] Error:', err);
      res.status(500).json({ error: err.message || 'Clone failed' });
    }
  });

  return httpServer;
}

// Seed function
async function seedDatabase() {
  const existingIngredients = await storage.getIngredients();
  if (existingIngredients.length === 0) {
    const flour = await storage.createIngredient({
      name: "All-Purpose Flour",
      unit: "kg",
      cost: "2.50",
      quantity: "1",
    });

    const sugar = await storage.createIngredient({
      name: "Granulated Sugar",
      unit: "kg",
      cost: "1.80",
      quantity: "1",
    });

    const butter = await storage.createIngredient({
      name: "Unsalted Butter",
      unit: "g",
      cost: "4.50",
      quantity: "500",
    });

    const eggs = await storage.createIngredient({
      name: "Large Eggs",
      unit: "each",
      cost: "3.00",
      quantity: "12",
    });

    const cookieRecipe = await storage.createRecipe({
      name: "Sugar Cookies",
      description: "Mix ingredients. Bake at 350F for 10-12 minutes."
    });

    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: flour.id,
      quantity: "0.4" // 400g
    });

    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: sugar.id,
      quantity: "0.2" // 200g
    });

    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: butter.id,
      quantity: "225" // 225g
    });
     
    await storage.addRecipeIngredient({
      recipeId: cookieRecipe.id,
      ingredientId: eggs.id,
      quantity: "1" // 1 egg
    });
  }
}

// Call seed
// seedDatabase().catch(console.error);

// Coffee Order Email Route
const sendOrderEmailSchema = z.object({
  vendorEmail: z.string().email(),
  ccEmail: z.string().email().optional().or(z.literal('')),
  vendorName: z.string(),
  orderItems: z.array(z.object({
    name: z.string(),
    size: z.string(),
    quantity: z.number(),
    price: z.number(),
    retailLabels: z.number().optional(),
    category: z.string().optional(),
  })),
  totalUnits: z.number(),
  totalCost: z.number(),
  notes: z.string().optional(),
  tenantName: z.string().optional()
});

// Feedback Email Schema
const sendFeedbackEmailSchema = z.object({
  feedbackType: z.enum(['bug', 'suggestion', 'general']),
  subject: z.string(),
  description: z.string().min(1, 'Description is required'),
  pageUrl: z.string().optional(),
  browserInfo: z.string().optional(),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
  tenantId: z.string().optional(),
  tenantName: z.string().optional()
});
