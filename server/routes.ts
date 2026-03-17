import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'http';
import { storage } from './storage';
import { api } from '@shared/routes';
import { z } from 'zod';
import { sendOrderEmail, sendFeedbackEmail, type OrderEmailData, type FeedbackEmailData } from './resend';
import { registerObjectStorageRoutes } from './objectStorageRoutes';
import { db, pool } from './db';
import { sql } from 'drizzle-orm';
import ical from 'node-ical';
import { getSupabaseAdmin } from './supabaseAdmin';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import * as qboService from './qboService';
import logger from './logger';

// Import shared helpers from route modules
import {
  getUserIdFromRequest,
  getTrustedBaseUrl,
  getTenantIdForUser,
  logAuditEvent,
  requirePlatformAdmin,
  enforceMapLimit,
  authRateLimit,
} from './routes/core';

// Import the route module registrar
import { registerAllRouteModules } from './routes/index';

// Coffee Order Email Schema
const sendOrderEmailSchema = z.object({
  vendorEmail: z.string().email(),
  ccEmail: z.string().email().optional().or(z.literal('')),
  vendorName: z.string(),
  orderItems: z.array(
    z.object({
      name: z.string(),
      size: z.string(),
      quantity: z.number(),
      price: z.number(),
      retailLabels: z.number().optional(),
      category: z.string().optional(),
    })
  ),
  totalUnits: z.number(),
  totalCost: z.number(),
  notes: z.string().optional(),
  tenantName: z.string().optional(),
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
  tenantName: z.string().optional(),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // =====================================================
  // Register route sub-modules (admin, kiosk, billing, reseller, tips)
  // =====================================================
  await registerAllRouteModules(app);

  // =====================================================
  // INGREDIENT ROUTES
  // =====================================================

  app.get(api.ingredients.list.path, async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const tenantId = await getTenantIdForUser(userId);
    if (!tenantId) return res.status(403).json({ error: 'No tenant association found' });
    const ingredients = await storage.getIngredients(tenantId);
    res.json(ingredients);
  });

  app.post(api.ingredients.create.path, async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = await getTenantIdForUser(userId);
      if (!tenantId) return res.status(403).json({ error: 'No tenant association found' });
      const input = api.ingredients.create.input.parse(req.body);
      const ingredient = await storage.createIngredient({ ...input, tenantId });
      res.status(201).json(ingredient);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      logger.error({ err }, 'Error creating ingredient');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(api.ingredients.get.path, async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const ingredient = await storage.getIngredient(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    res.json(ingredient);
  });

  app.put(api.ingredients.update.path, async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
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
      logger.error({ err }, 'Error updating ingredient');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete(api.ingredients.delete.path, async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    await storage.deleteIngredient(req.params.id);
    res.status(204).end();
  });

  // =====================================================
  // COFFEE ORDER EMAIL ROUTE
  // =====================================================

  app.post('/api/coffee-order/send-email', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const data = sendOrderEmailSchema.parse(req.body);
      const result = await sendOrderEmail({
        vendorEmail: data.vendorEmail,
        ccEmail: data.ccEmail || undefined,
        vendorName: data.vendorName,
        orderItems: data.orderItems,
        totalUnits: data.totalUnits,
        totalCost: data.totalCost,
        notes: data.notes,
        tenantName: data.tenantName,
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
          error: err.errors[0].message,
        });
      }
      logger.error({ err }, 'Email send error');
      res.status(500).json({ success: false, error: 'Failed to send email' });
    }
  });

  // =====================================================
  // FEEDBACK SUBMIT ROUTE
  // =====================================================

  const feedbackRateLimit: Map<string, { count: number; resetTime: number }> = new Map();
  const FEEDBACK_LIMIT = 5; // max 5 submissions per hour
  const FEEDBACK_WINDOW = 60 * 60 * 1000; // 1 hour in ms

  app.post('/api/feedback/submit', async (req, res) => {
    try {
      // M12: Require JWT authentication for feedback
      const { userId, userEmail: authenticatedEmail } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const data = sendFeedbackEmailSchema.parse(req.body);

      // Prevent email injection: verify client-supplied email matches authenticated user
      let verifiedEmail = authenticatedEmail;
      if (data.userEmail) {
        if (authenticatedEmail && data.userEmail !== authenticatedEmail) {
          return res.status(400).json({ success: false, error: 'Email must match your account' });
        }
        verifiedEmail = data.userEmail;
      }

      // Rate limiting by IP + email
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `${clientIP}:${verifiedEmail}`;
      const now = Date.now();

      const rateData = feedbackRateLimit.get(rateLimitKey);
      if (rateData) {
        if (now < rateData.resetTime) {
          if (rateData.count >= FEEDBACK_LIMIT) {
            return res.status(429).json({
              success: false,
              error: 'Too many feedback submissions. Please try again later.',
            });
          }
          rateData.count++;
        } else {
          feedbackRateLimit.set(rateLimitKey, { count: 1, resetTime: now + FEEDBACK_WINDOW });
          enforceMapLimit(feedbackRateLimit, 10_000);
        }
      } else {
        feedbackRateLimit.set(rateLimitKey, { count: 1, resetTime: now + FEEDBACK_WINDOW });
        enforceMapLimit(feedbackRateLimit, 10_000);
      }

      const result = await sendFeedbackEmail({
        feedbackType: data.feedbackType,
        subject: data.subject,
        description: data.description,
        pageUrl: data.pageUrl,
        browserInfo: data.browserInfo,
        userEmail: verifiedEmail ?? undefined,
        userName: data.userName,
        tenantId: data.tenantId,
        tenantName: data.tenantName,
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
          error: err.errors[0].message,
        });
      }
      logger.error({ err }, 'Feedback send error');
      res.status(500).json({ success: false, error: 'Failed to submit feedback' });
    }
  });

  // =====================================================
  // RECIPE ROUTES
  // =====================================================

  app.get(api.recipes.list.path, async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const tenantId = await getTenantIdForUser(userId);
    if (!tenantId) return res.status(403).json({ error: 'No tenant association found' });
    const recipes = await storage.getRecipes(tenantId);
    res.json(recipes);
  });

  app.post(api.recipes.create.path, async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = await getTenantIdForUser(userId);
      if (!tenantId) return res.status(403).json({ error: 'No tenant association found' });
      const input = api.recipes.create.input.parse(req.body);
      const recipe = await storage.createRecipe({ ...input, tenantId });
      res.status(201).json(recipe);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      logger.error({ err }, 'Error creating recipe');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get(api.recipes.get.path, async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const recipe = await storage.getRecipe(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    res.json(recipe);
  });

  app.put(api.recipes.update.path, async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
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
      logger.error({ err }, 'Error updating recipe');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete(api.recipes.delete.path, async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    await storage.deleteRecipe(req.params.id);
    res.status(204).end();
  });

  // =====================================================
  // RECIPE INGREDIENT ROUTES
  // =====================================================

  app.post(api.recipeIngredients.create.path, async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = await getTenantIdForUser(userId);
      if (!tenantId) return res.status(403).json({ error: 'No tenant association found' });
      const recipeId = req.params.recipeId;
      const bodySchema = api.recipeIngredients.create.input.extend({
        recipeId: z.string().default(recipeId), // inject recipeId
      });

      const input = bodySchema.parse({ ...req.body, recipeId });

      const item = await storage.addRecipeIngredient({ ...input, tenantId });
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      logger.error({ err }, 'Error adding recipe ingredient');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete(api.recipeIngredients.delete.path, async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    await storage.deleteRecipeIngredient(req.params.id);
    res.status(204).end();
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

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

  // CSRF state map for Square OAuth: maps state token -> { tenantId, expiresAt }
  const squareOAuthStates = new Map<string, { tenantId: string; expiresAt: number }>();

  app.get('/api/square/auth-url', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      // Generate a CSRF state token (random, tied to the tenant)
      const stateToken = crypto.randomUUID();
      squareOAuthStates.set(stateToken, {
        tenantId: auth.tenantId,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      const baseUrl = getTrustedBaseUrl(req);
      const redirectUri = `${baseUrl}/api/square/oauth/callback`;
      const url = getSquareOAuthUrl(stateToken, redirectUri);
      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  });

  // Server-side OAuth callback — Square redirects here with ?code=...&state=stateToken
  app.get('/api/square/oauth/callback', async (req, res) => {
    const { code, state: stateToken } = req.query;
    const frontendUrl = '/admin/integrations';

    if (!code || !stateToken) {
      return res.redirect(`${frontendUrl}?square_error=${encodeURIComponent('Missing authorization code or state')}`);
    }

    // Validate the CSRF state token
    const stateData = squareOAuthStates.get(stateToken as string);
    squareOAuthStates.delete(stateToken as string); // one-time use
    if (!stateData || Date.now() > stateData.expiresAt) {
      return res.redirect(
        `${frontendUrl}?square_error=${encodeURIComponent('Invalid or expired OAuth state. Please try again.')}`
      );
    }
    const tenantId = stateData.tenantId;

    try {
      // Reconstruct the redirect URI that was used in the authorize request (must match exactly)
      const baseUrl = getTrustedBaseUrl(req);
      const redirectUri = `${baseUrl}/api/square/oauth/callback`;
      const tokens = await squareService.exchangeCodeForTokens(code as string, redirectUri);
      await squareService.saveTenantSquareTokens(
        tenantId,
        tokens.merchantId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt
      );

      res.redirect(`${frontendUrl}?square_connected=true`);
    } catch (error: any) {
      logger.error({ err: error }, 'Square OAuth callback error');
      res.redirect(`${frontendUrl}?square_error=${encodeURIComponent('Failed to connect Square. Please try again.')}`);
    }
  });

  app.post('/api/square/disconnect', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      await squareService.disconnectSquare(auth.tenantId);
      res.json({ success: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/square/status/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const status = await squareService.getSquareStatus(auth.tenantId);
      res.json(status || { connected: false });
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/square/sync/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/, 'Invalid date format');
      const syncSchema = z
        .object({
          startDate: isoDate,
          endDate: isoDate,
        })
        .refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
          message: 'startDate must not be after endDate',
        });
      const parsed = syncSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid date parameters', details: parsed.error.flatten() });
      }

      const result = await squareService.syncShiftsForTenant(auth.tenantId, {
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      });
      res.json(result);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/square/locations/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const locations = await squareService.listLocations(auth.tenantId);
      res.json(locations);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/square/suggest-mappings/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const suggestions = await squareService.suggestEmployeeMappings(auth.tenantId);
      res.json(suggestions);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/square/mappings/:tenantId', async (req, res) => {
    try {
      const auth = await verifySquareAdmin(req, res);
      if (!auth) return;

      const mappings = await squareService.getMappings(auth.tenantId);
      res.json(mappings);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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

      // Verify owner AND that they belong to the requested tenant
      const userProfileResult = await db.execute(
        sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true`
      );
      const userProfile = userProfileResult.rows[0] as any;
      if (!userProfile || userProfile.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can generate referral codes' });
      }
      if (userProfile.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

      // Check if tenant already has a code
      const existing = await db.execute(sql`
        SELECT id, code FROM referral_codes WHERE tenant_id = ${tenantId}
      `);
      if (existing.rows.length > 0) {
        return res.json(existing.rows[0]);
      }

      // Generate unique code: XXXX-XXXX format (crypto random)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const randomBytes = crypto.randomBytes(8);
      let code = '';
      for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars[randomBytes[i] % chars.length];
      }

      const result = await db.execute(sql`
        INSERT INTO referral_codes (tenant_id, code)
        VALUES (${tenantId}, ${code})
        RETURNING id, code, tenant_id, is_active, created_at
      `);

      res.json(result.rows[0]);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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

      // Verify user belongs to this tenant
      const profileResult = await db.execute(
        sql`SELECT tenant_id FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
      );
      const profile = profileResult.rows[0] as any;
      if (!profile || profile.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Redeem a referral code
  app.post('/api/referral-codes/redeem', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'code is required' });
      }

      // H5: Derive tenantId from the authenticated user's profile (don't trust client)
      const profileResult = await db.execute(
        sql`SELECT tenant_id FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
      );
      const tenantId = (profileResult.rows[0] as any)?.tenant_id;
      if (!tenantId) {
        return res.status(403).json({ error: 'User has no associated tenant' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/analytics/platform-overview — aggregated platform analytics
  app.get('/api/analytics/platform-overview', requirePlatformAdmin, async (req, res) => {
    try {
      // Run queries individually so one failure doesn't kill the whole response
      const safeQuery = async (label: string, fn: () => Promise<any>, fallback: any = []) => {
        try {
          return await fn();
        } catch (e: any) {
          logger.error({ err: e, label }, 'Platform analytics query failed');
          return { rows: fallback };
        }
      };

      const [tenantsByPlan, totalUsers, monthlyGrowth, moduleAdoption, resellers, plans, totalTenants] =
        await Promise.all([
          safeQuery('tenantsByPlan', () =>
            db.execute(sql`
          SELECT subscription_plan, subscription_status, billing_interval,
                 COUNT(*)::int as count,
                 COALESCE(SUM(billable_locations), COUNT(*))::int as total_locations
          FROM tenants
          WHERE is_active = true OR subscription_status IN ('active', 'trial')
          GROUP BY subscription_plan, subscription_status, billing_interval
        `)
          ),
          safeQuery(
            'totalUsers',
            () =>
              db.execute(sql`
          SELECT COUNT(*)::int as total_users FROM user_profiles WHERE is_active = true
        `),
            [{ total_users: 0 }]
          ),
          safeQuery('monthlyGrowth', () =>
            db.execute(sql`
          SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                 COUNT(*)::int as new_tenants,
                 SUM(CASE WHEN reseller_id IS NULL THEN 1 ELSE 0 END)::int as direct,
                 SUM(CASE WHEN reseller_id IS NOT NULL THEN 1 ELSE 0 END)::int as wholesale
          FROM tenants
          WHERE created_at >= NOW() - INTERVAL '12 months'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY DATE_TRUNC('month', created_at)
        `)
          ),
          safeQuery('moduleAdoption', () =>
            db.execute(sql`
          SELECT m.id as module_id, m.name as module_name,
                 COUNT(DISTINCT tms.tenant_id)::int as subscriber_count
          FROM modules m
          LEFT JOIN tenant_module_subscriptions tms ON tms.module_id = m.id
          WHERE m.rollout_status IN ('ga', 'beta')
          GROUP BY m.id, m.name
          ORDER BY subscriber_count DESC
        `)
          ),
          safeQuery('resellers', () =>
            db.execute(sql`
          SELECT r.id, r.name, r.tier, r.seats_used::int, r.seats_total::int,
                 r.wholesale_rate_per_seat,
                 COALESCE(SUM(CASE WHEN ri.status != 'void' THEN ri.total ELSE 0 END), 0) as total_invoiced,
                 COALESCE(SUM(CASE WHEN ri.status = 'paid' THEN ri.total ELSE 0 END), 0) as total_paid
          FROM resellers r
          LEFT JOIN reseller_invoices ri ON ri.reseller_id = r.id
          WHERE r.is_active = true
          GROUP BY r.id, r.name, r.tier, r.seats_used, r.seats_total, r.wholesale_rate_per_seat
          ORDER BY r.name
        `)
          ),
          safeQuery('plans', () =>
            db.execute(sql`
          SELECT id, name, monthly_price, annual_price
          FROM subscription_plans
          WHERE is_active = true
          ORDER BY display_order
        `)
          ),
          safeQuery(
            'totalTenants',
            () =>
              db.execute(sql`
          SELECT COUNT(*)::int as total FROM tenants WHERE is_active = true
        `),
            [{ total: 0 }]
          ),
        ]);

      res.json({
        tenantsByPlan: tenantsByPlan.rows,
        totalActiveUsers: (totalUsers.rows[0] as any)?.total_users || 0,
        monthlyGrowth: monthlyGrowth.rows,
        moduleAdoption: moduleAdoption.rows,
        resellers: resellers.rows,
        plans: plans.rows,
        totalActiveTenants: (totalTenants.rows[0] as any)?.total || 0,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Platform analytics overview error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/analytics/platform-costs — read cost settings
  app.get('/api/analytics/platform-costs', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT hosting, supabase, stripe_fee_percent, support_labor, other, notes, updated_at
        FROM platform_cost_settings
        LIMIT 1
      `);
      res.json(result.rows[0] || { hosting: 0, supabase: 0, stripe_fee_percent: 2.9, support_labor: 0, other: 0 });
    } catch (error: any) {
      // Table may not exist yet — return defaults
      res.json({ hosting: 0, supabase: 0, stripe_fee_percent: 2.9, support_labor: 0, other: 0 });
    }
  });

  // PUT /api/analytics/platform-costs — save cost settings
  app.put('/api/analytics/platform-costs', requirePlatformAdmin, async (req, res) => {
    try {
      const schema = z.object({
        hosting: z.number().min(0),
        supabase: z.number().min(0),
        stripe_fee_percent: z.number().min(0).max(100),
        support_labor: z.number().min(0),
        other: z.number().min(0),
        notes: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const { userId } = await getUserIdFromRequest(req);

      const result = await db.execute(sql`
        UPDATE platform_cost_settings
        SET hosting = ${data.hosting},
            supabase = ${data.supabase},
            stripe_fee_percent = ${data.stripe_fee_percent},
            support_labor = ${data.support_labor},
            other = ${data.other},
            notes = ${data.notes || null},
            updated_at = NOW(),
            updated_by = ${userId}::uuid
        WHERE id = (SELECT id FROM platform_cost_settings LIMIT 1)
        RETURNING *
      `);

      if (result.rows.length === 0) {
        // No row exists yet — insert one
        const insertResult = await db.execute(sql`
          INSERT INTO platform_cost_settings (hosting, supabase, stripe_fee_percent, support_labor, other, notes, updated_by)
          VALUES (${data.hosting}, ${data.supabase}, ${data.stripe_fee_percent}, ${data.support_labor}, ${data.other}, ${data.notes || null}, ${userId}::uuid)
          RETURNING *
        `);
        return res.json(insertResult.rows[0]);
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid cost settings', details: error.errors });
      }
      logger.error({ err: error }, 'Platform analytics save costs error');
      res.status(500).json({ error: 'Internal server error' });
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

      // Fetch + parse iCal feed (webcal:// -> https://) with SSRF protection
      const feedUrl = (sub.url as string).replace(/^webcal:\/\//i, 'https://');
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(feedUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid feed URL' });
      }

      // Resolve hostname and block private/internal IPs (prevents DNS rebinding)
      const { promises: dnsPromises } = await import('dns');
      try {
        const { address } = await dnsPromises.lookup(parsedUrl.hostname);
        const parts = address.split('.').map(Number);
        const isPrivate =
          address === '127.0.0.1' ||
          address === '0.0.0.0' ||
          address.startsWith('::') ||
          address.startsWith('fe80') ||
          address.startsWith('fc00') ||
          parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          (parts[0] === 169 && parts[1] === 254);
        if (isPrivate) {
          return res.status(400).json({ error: 'Internal URLs are not allowed' });
        }
      } catch {
        return res.status(400).json({ error: 'Could not resolve feed URL hostname' });
      }

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
      } catch {
        /* ignore */
      }
      logger.error({ err }, 'iCal sync error');
      res.status(500).json({ error: 'Failed to sync iCal feed' });
    }
  });

  // =====================================================
  // LOCATION CLONE ENDPOINT
  // =====================================================

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
        const { data: ingCats } = await admin.from('ingredient_categories').select('*').eq('tenant_id', sourceTenantId);
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
        const { data: ingredients } = await admin.from('ingredients').select('*').eq('tenant_id', sourceTenantId);
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
        const { data: prodCats } = await admin.from('product_categories').select('*').eq('tenant_id', sourceTenantId);
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
        const { data: sizes } = await admin.from('product_sizes').select('*').eq('tenant_id', sourceTenantId);
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
        const { data: templates } = await admin.from('base_templates').select('*').eq('tenant_id', sourceTenantId);
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
            .in(
              'base_template_id',
              templates.map((t: any) => t.id)
            );
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
        const { data: recipes } = await admin.from('recipes').select('*').eq('tenant_id', sourceTenantId);
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
            .from('recipe_ingredients')
            .select('*')
            .in('recipe_id', sourceRecipeIds);
          if (recipeIngredients && recipeIngredients.length > 0) {
            const inserts = recipeIngredients.map(
              ({ id: _id, recipe_id, ingredient_id, syrup_recipe_id, size_id, ...rest }: any) => ({
                ...rest,
                id: crypto.randomUUID(),
                recipe_id: recipeMap.get(recipe_id) ?? recipe_id,
                ingredient_id: ingredient_id ? (ingredientMap.get(ingredient_id) ?? ingredient_id) : null,
                syrup_recipe_id: syrup_recipe_id ? (recipeMap.get(syrup_recipe_id) ?? syrup_recipe_id) : null,
                size_id: size_id ? (sizeMap.get(size_id) ?? size_id) : null,
              })
            );
            const { error } = await admin.from('recipe_ingredients').insert(inserts);
            if (error) throw new Error(`Recipe ingredients clone failed: ${error.message}`);
          }

          // 9. recipe_size_bases
          const { data: rsb } = await admin.from('recipe_size_bases').select('*').in('recipe_id', sourceRecipeIds);
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
          const { data: rsp } = await admin.from('recipe_size_pricing').select('*').in('recipe_id', sourceRecipeIds);
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
        const { data: equipmentItems } = await admin.from('equipment').select('*').eq('tenant_id', sourceTenantId);
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
            .in(
              'equipment_id',
              equipmentItems.map((e: any) => e.id)
            );
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
      logger.error({ err }, 'Location clone error');
      res.status(500).json({ error: err.message || 'Clone failed' });
    }
  });

  // Auto-close bug reports that have been "resolved" for 14+ days
  setInterval(
    async () => {
      try {
        const result = await db.execute(sql`
        UPDATE bug_reports
        SET status = 'closed'
        WHERE status = 'resolved'
          AND updated_at < now() - interval '14 days'
      `);
        const count = (result as any).rowCount ?? 0;
        if (count > 0) {
          logger.info({ count }, 'Auto-closed resolved bug reports older than 14 days');
        }
      } catch (err: any) {
        logger.error({ err }, 'Auto-close bug reports error');
      }
    },
    60 * 60 * 1000
  ); // check every hour

  // Periodic cleanup of feedbackRateLimit map
  setInterval(
    () => {
      const now = Date.now();
      feedbackRateLimit.forEach((entry, key) => {
        if (now >= entry.resetTime) feedbackRateLimit.delete(key);
      });
    },
    5 * 60 * 1000
  ); // every 5 minutes

  // =====================================================
  // QuickBooks Online Integration
  // =====================================================

  // In-memory CSRF state tokens for QBO OAuth (same pattern as Square)
  const qboOAuthStates = new Map<string, { tenantId: string; expiresAt: number }>();

  const qboRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  });

  // Helper: verify user is owner/manager and extract tenantId
  async function verifyBudgetAdmin(req: Request, res: Response): Promise<{ userId: string; tenantId: string } | null> {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    const tenantId = (req.query.tenantId as string) || req.params.tenantId || req.body?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'tenantId required' });
      return null;
    }
    const supabaseAdmin = getSupabaseAdmin();

    // Primary check: verify user's tenant_id from user_profiles
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .maybeSingle();

    let hasAccess = false;

    if (profile && profile.tenant_id === tenantId) {
      // User's primary tenant matches — check role
      if (['owner', 'manager'].includes(profile.role)) {
        hasAccess = true;
      }
    }

    // Fall through to user_tenant_assignments for multi-location scenarios
    if (!hasAccess) {
      const { data: assignment } = await supabaseAdmin
        .from('user_tenant_assignments')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();
      if (assignment && ['owner', 'manager'].includes(assignment.role)) {
        hasAccess = true;
      }
    }

    // Also allow platform admins
    if (!hasAccess) {
      const { data: adminCheck } = await supabaseAdmin
        .from('platform_admins')
        .select('id')
        .eq('id', userId)
        .eq('is_active', true)
        .maybeSingle();
      if (adminCheck) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      res.status(403).json({ error: 'Manager or owner role required' });
      return null;
    }
    return { userId, tenantId };
  }

  // GET /api/qbo/auth-url — generate OAuth authorization URL
  app.get('/api/qbo/auth-url', qboRateLimit, async (req, res) => {
    try {
      const auth = await verifyBudgetAdmin(req, res);
      if (!auth) return;

      const stateToken = crypto.randomUUID();
      qboOAuthStates.set(stateToken, {
        tenantId: auth.tenantId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const url = qboService.getQboAuthUrl(stateToken);
      res.json({ url });
    } catch (error: any) {
      logger.error({ err: error }, 'QBO auth URL error');
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  });

  // GET /api/qbo/oauth/callback — Intuit redirects here after user authorizes
  app.get('/api/qbo/oauth/callback', async (req, res) => {
    const frontendUrl = '/financial-budget?tab=chart-of-accounts';
    const { state: stateToken, realmId } = req.query;

    if (!stateToken) {
      return res.redirect(`${frontendUrl}&qbo_error=${encodeURIComponent('Missing OAuth state')}`);
    }

    // Validate CSRF state
    const stateData = qboOAuthStates.get(stateToken as string);
    qboOAuthStates.delete(stateToken as string);
    if (!stateData || Date.now() > stateData.expiresAt) {
      return res.redirect(
        `${frontendUrl}&qbo_error=${encodeURIComponent('Invalid or expired OAuth state. Please try again.')}`
      );
    }

    try {
      // intuit-oauth needs the full callback URL to exchange the code
      const fullUrl = `${getTrustedBaseUrl(req)}${req.originalUrl}`;
      const tokens = await qboService.exchangeQboCode(fullUrl);

      await qboService.saveQboTokens(
        stateData.tenantId,
        tokens.realmId || (realmId as string) || '',
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt
      );

      res.redirect(`${frontendUrl}&qbo_connected=true`);
    } catch (error: any) {
      logger.error({ err: error }, 'QBO OAuth callback error');
      res.redirect(`${frontendUrl}&qbo_error=${encodeURIComponent('Failed to connect QuickBooks. Please try again.')}`);
    }
  });

  // GET /api/qbo/status/:tenantId — connection status
  app.get('/api/qbo/status/:tenantId', qboRateLimit, async (req, res) => {
    try {
      const auth = await verifyBudgetAdmin(req, res);
      if (!auth) return;

      const status = await qboService.getQboStatus(auth.tenantId);
      res.json(status);
    } catch (error: any) {
      logger.error({ err: error }, 'QBO status error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/qbo/disconnect — revoke and clear tokens
  app.post('/api/qbo/disconnect', qboRateLimit, async (req, res) => {
    try {
      const auth = await verifyBudgetAdmin(req, res);
      if (!auth) return;

      await qboService.disconnectQbo(auth.tenantId);
      res.json({ success: true });
    } catch (error: any) {
      logger.error({ err: error }, 'QBO disconnect error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/qbo/sync-coa — sync Chart of Accounts from QBO
  app.post('/api/qbo/sync-coa', qboRateLimit, async (req, res) => {
    try {
      const auth = await verifyBudgetAdmin(req, res);
      if (!auth) return;

      const result = await qboService.syncChartOfAccounts(auth.tenantId);
      res.json(result);
    } catch (error: any) {
      logger.error({ err: error }, 'QBO sync CoA error');
      res.status(500).json({ error: error.message || 'Sync failed' });
    }
  });

  // POST /api/qbo/sync-actuals — sync P&L actuals for a fiscal year
  app.post('/api/qbo/sync-actuals', qboRateLimit, async (req, res) => {
    try {
      const auth = await verifyBudgetAdmin(req, res);
      if (!auth) return;

      const schema = z.object({
        fiscalYearId: z.string().uuid(),
        year: z.number().int().min(2000).max(2100),
      });
      const { fiscalYearId, year } = schema.parse(req.body);

      const result = await qboService.syncActuals(auth.tenantId, fiscalYearId, year);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data' });
      }
      logger.error({ err: error }, 'QBO sync actuals error');
      res.status(500).json({ error: error.message || 'Sync failed' });
    }
  });

  // =====================================================
  // Financial Budget — Forecast: Apply Drivers
  // =====================================================

  app.post('/api/budget/forecast/apply-drivers', qboRateLimit, async (req, res) => {
    try {
      const auth = await verifyBudgetAdmin(req, res);
      if (!auth) return;

      const schema = z.object({
        scenarioId: z.string().uuid(),
        tenantId: z.string().uuid(),
      });
      const { scenarioId, tenantId } = schema.parse(req.body);

      // Verify tenant access
      if (tenantId !== auth.tenantId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Fetch drivers for this scenario
      const { data: drivers, error: dErr } = await supabaseAdmin
        .from('budget_forecast_drivers')
        .select('*')
        .eq('scenario_id', scenarioId)
        .eq('is_active', true)
        .order('priority');
      if (dErr) throw dErr;
      if (!drivers || drivers.length === 0) {
        return res.json({ updated: 0 });
      }

      // Fetch existing forecast line items for this scenario
      const { data: existingLines } = await supabaseAdmin
        .from('budget_forecast_line_items')
        .select('account_id, month, forecast_amount')
        .eq('scenario_id', scenarioId)
        .eq('tenant_id', tenantId);

      const forecastMap = new Map<string, number>();
      for (const line of existingLines || []) {
        forecastMap.set(`${line.account_id}-${line.month}`, Number(line.forecast_amount) || 0);
      }

      // Apply drivers in priority order
      const upserts: Array<{
        tenant_id: string;
        scenario_id: string;
        account_id: string;
        month: number;
        forecast_amount: number;
      }> = [];

      for (const driver of drivers) {
        const months = driver.apply_months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        for (const month of months) {
          let amount = 0;
          switch (driver.driver_type) {
            case 'fixed_amount':
              amount = Number(driver.driver_value);
              break;
            case 'percentage_of_account':
              if (driver.source_account_id) {
                const sourceVal = forecastMap.get(`${driver.source_account_id}-${month}`) || 0;
                amount = sourceVal * Number(driver.driver_value);
              }
              break;
            case 'growth_rate':
              if (month === 1) {
                amount = forecastMap.get(`${driver.target_account_id}-${month}`) || 0;
              } else {
                const prevVal = forecastMap.get(`${driver.target_account_id}-${month - 1}`) || 0;
                amount = prevVal * (1 + Number(driver.driver_value));
              }
              break;
            case 'per_unit':
              amount = Number(driver.driver_value);
              break;
          }

          const key = `${driver.target_account_id}-${month}`;
          forecastMap.set(key, amount);
          upserts.push({
            tenant_id: tenantId,
            scenario_id: scenarioId,
            account_id: driver.target_account_id,
            month,
            forecast_amount: Math.round(amount * 100) / 100,
          });
        }
      }

      // Bulk upsert
      if (upserts.length > 0) {
        const withTimestamp = upserts.map((u) => ({ ...u, updated_at: new Date().toISOString() }));
        const { error: uErr } = await supabaseAdmin
          .from('budget_forecast_line_items')
          .upsert(withTimestamp, { onConflict: 'tenant_id,scenario_id,account_id,month' });
        if (uErr) throw uErr;
      }

      res.json({ updated: upserts.length });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data' });
      }
      logger.error({ err: error }, 'Forecast apply drivers error');
      res.status(500).json({ error: error.message || 'Failed to apply drivers' });
    }
  });

  // =====================================================
  // Financial Budget — CSV import endpoint
  // =====================================================

  const budgetImportRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many import attempts. Please try again later.' },
  });

  app.post('/api/budget/import-coa', budgetImportRateLimit, async (req: Request, res: Response) => {
    try {
      const { userId, debug } = await getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const schema = z.object({
        csv: z.string().min(1),
        tenantId: z.string().uuid(),
        fileName: z.string().min(1),
        columnMapping: z
          .object({
            name: z.number().int().min(0),
            type: z.number().int().min(0).optional(),
            detailType: z.number().int().min(0).optional(),
            number: z.number().int().min(0).optional(),
          })
          .optional(),
        replaceExisting: z.boolean().optional(),
      });
      const { csv, tenantId, fileName, columnMapping, replaceExisting } = schema.parse(req.body);

      // Parse CSV
      const allLines = csv.split(/\r?\n/).filter((l) => l.trim());
      if (allLines.length < 2) {
        return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
      }

      // Parse header — handle quoted fields
      const parseCSVLine = (line: string): string[] => {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        fields.push(current.trim());
        return fields;
      };

      // QBO exports have title rows before the real headers
      let headerIdx = 0;
      for (let i = 0; i < Math.min(allLines.length, 10); i++) {
        const fields = parseCSVLine(allLines[i]);
        const nonEmpty = fields.filter((f: string) => f.length > 0).length;
        if (nonEmpty >= 3) {
          headerIdx = i;
          break;
        }
      }
      const lines = allLines.slice(headerIdx);

      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Use explicit column mapping if provided, otherwise auto-detect
      let nameIdx: number, typeIdx: number, detailIdx: number, numberIdx: number;

      if (columnMapping) {
        nameIdx = columnMapping.name;
        typeIdx = columnMapping.type ?? -1;
        detailIdx = columnMapping.detailType ?? -1;
        numberIdx = columnMapping.number ?? -1;
      } else {
        numberIdx = headers.findIndex(
          (h) => h === 'account' || h === 'number' || h === 'accountnumber' || h === 'acctnum'
        );
        nameIdx = headers.findIndex(
          (h, idx) => idx !== numberIdx && (h === 'fullname' || h === 'accountname' || h === 'name' || h === 'account')
        );
        typeIdx = headers.findIndex((h) => h === 'type' || h === 'accounttype');
        detailIdx = headers.findIndex((h) => h === 'detailtype' || h === 'detail');
      }

      if (nameIdx === -1) {
        return res
          .status(400)
          .json({ error: 'CSV must have an "Account" or "Name" column. Use column mapping if your headers differ.' });
      }

      // Map QBO types to internal types
      const mapType = (qboType: string): string => {
        const t = qboType.toLowerCase().trim();
        if (t.includes('income') || t.includes('revenue')) return 'Revenue';
        if (t.includes('cost of goods') || t === 'cogs') return 'COGS';
        if (t.includes('expense')) return 'Expense';
        return 'Other';
      };

      const supabaseAdmin = getSupabaseAdmin();

      // Replace existing: delete all current accounts for this tenant first
      if (replaceExisting) {
        await supabaseAdmin.from('budget_chart_of_accounts').delete().eq('tenant_id', tenantId);
      }

      const imported: any[] = [];
      const errors: Array<{ row: number; message: string }> = [];
      let skipped = 0;

      // Track parent accounts by name for hierarchy
      const parentMap = new Map<string, string>(); // fullName -> id

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        const rawName = fields[nameIdx];
        if (!rawName) {
          skipped++;
          continue;
        }

        // Skip summary/footer rows
        if (rawName.toUpperCase() === 'TOTAL' || rawName.startsWith('"') || rawName.startsWith(' ')) {
          skipped++;
          continue;
        }

        // Handle QBO sub-account notation (colon-separated)
        const nameParts = rawName.split(':').map((p) => p.trim());
        const accountName = nameParts[nameParts.length - 1];
        const parentPath = nameParts.length > 1 ? nameParts.slice(0, -1).join(':') : null;

        const accountType = typeIdx >= 0 && fields[typeIdx] ? mapType(fields[typeIdx]) : 'Expense';
        const detailType = detailIdx >= 0 ? fields[detailIdx] || null : null;
        const accountNumber = numberIdx >= 0 ? fields[numberIdx] || null : null;
        const depth = nameParts.length - 1;

        try {
          const parentId = parentPath ? parentMap.get(parentPath) || null : null;

          const { data, error } = await supabaseAdmin
            .from('budget_chart_of_accounts')
            .insert({
              tenant_id: tenantId,
              name: accountName,
              account_number: accountNumber,
              account_type: accountType,
              detail_type: detailType,
              parent_id: parentId,
              depth,
              display_order: i,
            })
            .select('id')
            .single();

          if (error) {
            errors.push({ row: i + 1, message: error.message });
          } else {
            imported.push(data);
            parentMap.set(rawName, data.id);
          }
        } catch (err: any) {
          errors.push({ row: i + 1, message: err.message });
        }
      }

      // Log the import
      await supabaseAdmin.from('budget_import_logs').insert({
        tenant_id: tenantId,
        import_type: 'chart_of_accounts',
        file_name: fileName,
        rows_imported: imported.length,
        rows_skipped: skipped,
        errors: errors.length > 0 ? errors : null,
        imported_by: userId,
      });

      res.json({
        imported: imported.length,
        skipped,
        errors,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Budget import error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return httpServer;
}

// Seed function
async function seedDatabase() {
  // Look up the first tenant to use for seed data; skip seeding if no tenants exist.
  const tenantResult = await db.execute(sql`SELECT id FROM tenants LIMIT 1`);
  const seedTenantId = (tenantResult.rows[0] as any)?.id as string | undefined;
  if (!seedTenantId) return;

  const existingIngredients = await storage.getIngredients(seedTenantId);
  if (existingIngredients.length === 0) {
    const flour = await storage.createIngredient({
      tenantId: seedTenantId,
      name: 'All-Purpose Flour',
      unit: 'kg',
      cost: '2.50',
      quantity: '1',
    });

    const sugar = await storage.createIngredient({
      tenantId: seedTenantId,
      name: 'Granulated Sugar',
      unit: 'kg',
      cost: '1.80',
      quantity: '1',
    });

    const butter = await storage.createIngredient({
      tenantId: seedTenantId,
      name: 'Unsalted Butter',
      unit: 'g',
      cost: '4.50',
      quantity: '500',
    });

    const eggs = await storage.createIngredient({
      tenantId: seedTenantId,
      name: 'Large Eggs',
      unit: 'each',
      cost: '3.00',
      quantity: '12',
    });

    const cookieRecipe = await storage.createRecipe({
      tenantId: seedTenantId,
      name: 'Sugar Cookies',
      description: 'Mix ingredients. Bake at 350F for 10-12 minutes.',
    });

    await storage.addRecipeIngredient({
      tenantId: seedTenantId,
      recipeId: cookieRecipe.id,
      ingredientId: flour.id,
      quantity: '0.4', // 400g
    });

    await storage.addRecipeIngredient({
      tenantId: seedTenantId,
      recipeId: cookieRecipe.id,
      ingredientId: sugar.id,
      quantity: '0.2', // 200g
    });

    await storage.addRecipeIngredient({
      tenantId: seedTenantId,
      recipeId: cookieRecipe.id,
      ingredientId: butter.id,
      quantity: '225', // 225g
    });

    await storage.addRecipeIngredient({
      tenantId: seedTenantId,
      recipeId: cookieRecipe.id,
      ingredientId: eggs.id,
      quantity: '1', // 1 egg
    });
  }
}

// Call seed
// seedDatabase().catch(console.error);
