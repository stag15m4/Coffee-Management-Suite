import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { sendOrderEmail, sendFeedbackEmail, type OrderEmailData, type FeedbackEmailData } from "./resend";
import { registerObjectStorageRoutes } from "./objectStorageRoutes";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Helper to verify platform admin status
async function verifyPlatformAdmin(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM platform_admins 
      WHERE id = ${userId}::uuid AND is_active = true
      LIMIT 1
    `);
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

// Middleware to require platform admin
const requirePlatformAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  const isAdmin = await verifyPlatformAdmin(userId);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
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
  // RESELLER & LICENSE CODE ROUTES (Platform Admin Only)
  // =====================================================
  
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
        SELECT lc.*, t.name as tenant_name
        FROM license_codes lc
        LEFT JOIN tenants t ON lc.tenant_id = t.id
        WHERE lc.reseller_id = ${req.params.id}
        ORDER BY lc.created_at DESC
      `);
      
      res.json({ 
        ...reseller.rows[0], 
        licenseCodes: licenseCodes.rows 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create reseller (platform admin only)
  app.post('/api/resellers', requirePlatformAdmin, async (req, res) => {
    try {
      const { name, contactEmail, contactName, phone, companyAddress, seatsTotal, notes } = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO resellers (name, contact_email, contact_name, phone, company_address, seats_total, notes)
        VALUES (${name}, ${contactEmail}, ${contactName}, ${phone}, ${companyAddress}, ${seatsTotal || 0}, ${notes})
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
      const { name, contactEmail, contactName, phone, companyAddress, seatsTotal, notes, isActive } = req.body;
      
      const result = await db.execute(sql`
        UPDATE resellers 
        SET name = ${name}, 
            contact_email = ${contactEmail}, 
            contact_name = ${contactName},
            phone = ${phone},
            company_address = ${companyAddress},
            seats_total = ${seatsTotal},
            notes = ${notes},
            is_active = ${isActive},
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
      const { count = 1, subscriptionPlan = 'premium', expiresAt } = req.body;
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
          INSERT INTO license_codes (code, reseller_id, subscription_plan, expires_at)
          VALUES (${code}, ${resellerId}, ${subscriptionPlan}, ${expiresAt || null})
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
        SELECT lc.*, r.name as reseller_name
        FROM license_codes lc
        JOIN resellers r ON lc.reseller_id = r.id
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
        resellerName: license.reseller_name
      });
    } catch (error: any) {
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // Redeem a license code (called during signup - requires authenticated user)
  app.post('/api/license-codes/redeem', async (req, res) => {
    try {
      const { code } = req.body;
      const userId = req.headers['x-user-id'] as string;
      
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
        VALUES (${tenant.id}::uuid, '#C4A052', '#3D2B1F', '#8B7355', '#F5F0E1', ${name})
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
      const requesterId = req.headers['x-user-id'] as string;

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
    price: z.number()
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
