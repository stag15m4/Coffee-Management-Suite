import type { Express } from 'express';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { sendBetaInviteEmail } from '../resend';
import logger from '../logger';
import {
  getUserIdFromRequest,
  getTrustedBaseUrl,
  requirePlatformAdmin,
  authRateLimit,
  licenseValidateRateLimit,
} from './core';

export async function registerResellerRoutes(app: Express): Promise<void> {
  const { stripeService } = await import('../stripeService');

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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get all resellers (platform admin only)
  app.get('/api/resellers', requirePlatformAdmin, async (req, res) => {
    try {
      const resellers = await db.execute(sql`
        SELECT * FROM resellers
        ORDER BY created_at DESC
        LIMIT 500
      `);
      res.json(resellers.rows);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get single reseller with license codes (platform admin only)
  app.get('/api/resellers/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const [reseller, licenseCodes, verticals, referredTenants] = await Promise.all([
        db.execute(sql`
          SELECT * FROM resellers WHERE id = ${req.params.id}
        `),
        db.execute(sql`
          SELECT lc.*, t.name as tenant_name, v.display_name as vertical_name
          FROM license_codes lc
          LEFT JOIN tenants t ON lc.tenant_id = t.id
          LEFT JOIN verticals v ON lc.vertical_id = v.id
          WHERE lc.reseller_id = ${req.params.id}
          ORDER BY lc.created_at DESC
        `),
        db.execute(sql`
          SELECT v.*, (SELECT COUNT(*) FROM tenants t WHERE t.vertical_id = v.id) as tenant_count
          FROM verticals v
          WHERE v.reseller_id = ${req.params.id}
          ORDER BY v.created_at DESC
        `),
        db.execute(sql`
          SELECT t.id, t.name, t.created_at, v.display_name as vertical_name
          FROM tenants t
          LEFT JOIN verticals v ON t.vertical_id = v.id
          WHERE t.reseller_id = ${req.params.id}
          ORDER BY t.created_at DESC
        `),
      ]);

      if (!reseller.rows.length) {
        return res.status(404).json({ error: 'Reseller not found' });
      }

      res.json({
        ...reseller.rows[0],
        licenseCodes: licenseCodes.rows,
        verticals: verticals.rows,
        referredTenants: referredTenants.rows,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Shared Zod schema for reseller numeric/enum fields
  const resellerBodySchema = z.object({
    name: z.string().min(1),
    contactEmail: z.string().email(),
    contactName: z.string().min(1),
    phone: z.string().optional().nullable(),
    companyAddress: z.string().optional().nullable(),
    seatsTotal: z.number().int().min(0).default(0),
    revenueSharePercent: z.number().min(0).max(100).default(0),
    notes: z.string().optional().nullable(),
    tier: z.enum(['authorized', 'silver', 'gold', 'platinum']).default('authorized'),
    discountPercent: z.number().min(0).max(100).default(20),
    minimumSeats: z.number().int().min(0).default(0),
    billingCycle: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
    annualCommitment: z.number().min(0).default(0),
    wholesaleRatePerSeat: z.number().min(0).default(0),
    cardSurchargePercent: z.number().min(0).max(100).default(4),
  });

  // Create reseller (platform admin only)
  app.post('/api/resellers', requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = resellerBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid reseller data', details: parsed.error.flatten() });
      }
      const {
        name,
        contactEmail,
        contactName,
        phone,
        companyAddress,
        seatsTotal,
        revenueSharePercent,
        notes,
        tier,
        discountPercent,
        minimumSeats,
        billingCycle,
        annualCommitment,
        wholesaleRatePerSeat,
        cardSurchargePercent,
      } = parsed.data;

      const result = await db.execute(sql`
        INSERT INTO resellers (name, contact_email, contact_name, phone, company_address, seats_total,
                               revenue_share_percent, notes, tier, discount_percent, minimum_seats,
                               billing_cycle, annual_commitment, wholesale_rate_per_seat,
                               card_surcharge_percent, tier_updated_at)
        VALUES (${name}, ${contactEmail}, ${contactName}, ${phone}, ${companyAddress}, ${seatsTotal},
                ${revenueSharePercent}, ${notes}, ${tier}, ${discountPercent},
                ${minimumSeats}, ${billingCycle}, ${annualCommitment},
                ${wholesaleRatePerSeat}, ${cardSurchargePercent}, NOW())
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update reseller (platform admin only)
  app.put('/api/resellers/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const updateSchema = resellerBodySchema.extend({
        isActive: z.boolean().default(true),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid reseller data', details: parsed.error.flatten() });
      }
      const {
        name,
        contactEmail,
        contactName,
        phone,
        companyAddress,
        seatsTotal,
        revenueSharePercent,
        notes,
        isActive,
        tier,
        discountPercent,
        minimumSeats,
        billingCycle,
        annualCommitment,
        wholesaleRatePerSeat,
        cardSurchargePercent,
      } = parsed.data;

      const result = await db.execute(sql`
        UPDATE resellers
        SET name = ${name},
            contact_email = ${contactEmail},
            contact_name = ${contactName},
            phone = ${phone},
            company_address = ${companyAddress},
            seats_total = ${seatsTotal},
            revenue_share_percent = ${revenueSharePercent},
            notes = ${notes},
            is_active = ${isActive},
            tier = ${tier},
            discount_percent = ${discountPercent},
            minimum_seats = ${minimumSeats},
            billing_cycle = ${billingCycle},
            annual_commitment = ${annualCommitment},
            wholesale_rate_per_seat = ${wholesaleRatePerSeat},
            card_surcharge_percent = ${cardSurchargePercent},
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete reseller (platform admin only)
  app.delete('/api/resellers/:id', requirePlatformAdmin, async (req, res) => {
    try {
      await db.execute(sql`DELETE FROM resellers WHERE id = ${req.params.id}`);
      res.status(204).end();
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
          error: `Cannot generate ${count} codes. Only ${availableSeats - pendingCodes} seats available.`,
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Reseller Invoicing ──────────────────────────────────────────────

  // List invoices for a reseller
  app.get('/api/resellers/:id/invoices', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT * FROM reseller_invoices
        WHERE reseller_id = ${req.params.id}
        ORDER BY created_at DESC
        LIMIT 500
      `);
      res.json(result.rows);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create invoice for a reseller
  app.post('/api/resellers/:id/invoices', requirePlatformAdmin, async (req, res) => {
    try {
      const resellerId = req.params.id;
      const { periodStart, periodEnd, dueDate, notes } = req.body;

      // Fetch reseller
      const resellerResult = await db.execute(sql`
        SELECT * FROM resellers WHERE id = ${resellerId}
      `);
      const reseller = resellerResult.rows[0] as any;
      if (!reseller) return res.status(404).json({ error: 'Reseller not found' });

      const wholesaleRate = parseFloat(reseller.wholesale_rate_per_seat || '0');
      if (wholesaleRate <= 0) {
        return res.status(400).json({ error: 'Wholesale rate per seat must be set before creating invoices' });
      }

      // Compute billable seats: max of allocated seats and minimum floor
      const billableSeats = Math.max(reseller.seats_total || 0, reseller.minimum_seats || 0);
      if (billableSeats <= 0) {
        return res.status(400).json({ error: 'No billable seats (allocate seats or set a minimum)' });
      }

      const subtotal = billableSeats * wholesaleRate;
      const total = subtotal; // Surcharge added later if card payment

      // Generate invoice number
      const invoiceNumResult = await db.execute(sql`SELECT generate_invoice_number() as num`);
      const invoiceNumber = (invoiceNumResult.rows[0] as any)?.num;
      if (!invoiceNumber) {
        return res.status(500).json({ error: 'Failed to generate invoice number' });
      }

      // Ensure reseller has a Stripe customer
      let stripeCustomerId = reseller.stripe_customer_id;
      if (!stripeCustomerId) {
        const customer = await stripeService.createResellerCustomer(reseller.contact_email, resellerId, reseller.name);
        stripeCustomerId = customer.id;
        await db.execute(sql`
          UPDATE resellers SET stripe_customer_id = ${stripeCustomerId} WHERE id = ${resellerId}
        `);
      }

      // Create Stripe invoice
      const stripeInvoice = await stripeService.createResellerInvoice(
        stripeCustomerId,
        [
          {
            description: `Wholesale seats (${billableSeats} × $${wholesaleRate.toFixed(2)}/seat) — ${periodStart} to ${periodEnd}`,
            amount: Math.round(subtotal * 100), // cents
            quantity: 1,
          },
        ],
        { resellerId, invoiceNumber },
        30
      );

      // Insert local record
      const result = await db.execute(sql`
        INSERT INTO reseller_invoices (
          reseller_id, stripe_invoice_id, invoice_number, status,
          billable_seats, rate_per_seat, subtotal, total,
          period_start, period_end, due_date, notes, created_by
        )
        VALUES (
          ${resellerId}, ${stripeInvoice.id}, ${invoiceNumber}, 'draft',
          ${billableSeats}, ${wholesaleRate}, ${subtotal}, ${total},
          ${periodStart}, ${periodEnd}, ${dueDate}, ${notes || null}, ${req.body.createdBy || null}
        )
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Send invoice (finalize + email to reseller)
  app.post('/api/reseller-invoices/:id/send', requirePlatformAdmin, async (req, res) => {
    try {
      const invoiceResult = await db.execute(sql`
        SELECT * FROM reseller_invoices WHERE id = ${req.params.id}
      `);
      const invoice = invoiceResult.rows[0] as any;
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      if (invoice.status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be sent' });

      if (invoice.stripe_invoice_id) {
        await stripeService.sendInvoice(invoice.stripe_invoice_id);
      }

      await db.execute(sql`
        UPDATE reseller_invoices SET status = 'sent' WHERE id = ${req.params.id}
      `);

      res.json({ success: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark invoice as paid out of band (check/ACH manual)
  app.post('/api/reseller-invoices/:id/mark-paid', requirePlatformAdmin, async (req, res) => {
    try {
      const { paymentMethod, notes } = req.body;
      const invoiceResult = await db.execute(sql`
        SELECT * FROM reseller_invoices WHERE id = ${req.params.id}
      `);
      const invoice = invoiceResult.rows[0] as any;
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });
      if (invoice.status === 'void') return res.status(400).json({ error: 'Cannot pay a voided invoice' });

      // Mark paid in Stripe
      if (invoice.stripe_invoice_id) {
        await stripeService.markInvoicePaidOutOfBand(invoice.stripe_invoice_id);
      }

      // Update local record
      await db.execute(sql`
        UPDATE reseller_invoices
        SET status = 'paid',
            payment_method = ${paymentMethod || 'other'},
            paid_at = NOW(),
            notes = COALESCE(${notes || null}, notes)
        WHERE id = ${req.params.id}
      `);

      res.json({ success: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Void an invoice
  app.post('/api/reseller-invoices/:id/void', requirePlatformAdmin, async (req, res) => {
    try {
      const invoiceResult = await db.execute(sql`
        SELECT * FROM reseller_invoices WHERE id = ${req.params.id}
      `);
      const invoice = invoiceResult.rows[0] as any;
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
      if (invoice.status === 'paid') return res.status(400).json({ error: 'Cannot void a paid invoice' });

      if (invoice.stripe_invoice_id) {
        await stripeService.voidInvoice(invoice.stripe_invoice_id);
      }

      await db.execute(sql`
        UPDATE reseller_invoices SET status = 'void' WHERE id = ${req.params.id}
      `);

      res.json({ success: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Validate a license code (public endpoint for signup flow)
  app.get('/api/license-codes/validate/:code', licenseValidateRateLimit, async (req, res) => {
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
        verticalName: license.vertical_name,
        verticalSlug: license.vertical_slug,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'License validate error');
      res.status(500).json({ valid: false, error: 'Internal server error' });
    }
  });

  // Redeem a license code (called during signup - requires authenticated user)
  app.post('/api/license-codes/redeem', authRateLimit, async (req, res) => {
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
        WHERE id = ${userId}::uuid
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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

      // Send invite email — use trusted base URL (validates host header)
      const baseUrl = getTrustedBaseUrl(req);
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =====================================================
  // BETA SIGNUP (Public — license code is the auth gate)
  // =====================================================

  app.post('/api/beta-signup', authRateLimit, async (req, res) => {
    try {
      const { code, email, password, fullName, businessName } = req.body;
      if (!code || !email || !password || !fullName || !businessName) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Password must include uppercase, lowercase, and a number' });
      }

      // 1. Validate license code (read-only, safe outside the transaction)
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

      // --- Begin transactional signup ---
      const pgClient = await pool.connect();
      let createdAuthUserId: string | null = null;

      try {
        await pgClient.query('BEGIN');

        // 2. Create tenant
        let slug = businessName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        let tenantResult;
        try {
          tenantResult = await pgClient.query(
            `INSERT INTO tenants (name, slug, subscription_plan, subscription_status)
             VALUES ($1, $2, $3, 'active')
             RETURNING id, name, slug`,
            [businessName, slug, license.subscription_plan]
          );
        } catch (slugError: any) {
          // Slug conflict — append random suffix and retry
          if (slugError.message?.includes('unique') || slugError.code === '23505') {
            slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;
            tenantResult = await pgClient.query(
              `INSERT INTO tenants (name, slug, subscription_plan, subscription_status)
               VALUES ($1, $2, $3, 'active')
               RETURNING id, name, slug`,
              [businessName, slug, license.subscription_plan]
            );
          } else {
            throw slugError;
          }
        }
        const tenant = tenantResult.rows[0] as { id: string; name: string; slug: string };

        // 3. Create tenant branding with default coffee theme
        await pgClient.query(
          `INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, background_color, company_name)
           VALUES ($1::uuid, '#334155', '#0F172A', '#F1F5F9', '#FFFFFF', $2)`,
          [tenant.id, businessName]
        );

        // 4. Create Supabase auth user via admin API
        const supabaseAdmin = getSupabaseAdmin();
        const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (createError || !newUserData?.user) {
          await pgClient.query('ROLLBACK');
          // Return a generic error to prevent user enumeration
          logger.error({ err: createError }, 'Beta signup user creation failed');
          return res.status(400).json({ error: 'Unable to create account. Please try again or contact support.' });
        }

        createdAuthUserId = newUserData.user.id;

        // 5. Create user_profiles row
        await pgClient.query(
          `INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
           VALUES ($1::uuid, $2::uuid, $3, $4, 'owner', true)`,
          [createdAuthUserId, tenant.id, email, fullName]
        );

        // 6. Enable modules that match the plan's rollout phase
        const planModules = await pgClient.query(
          `SELECT m.id FROM modules m
           INNER JOIN subscription_plan_modules spm ON spm.module_id = m.id AND spm.plan_id = $1
           WHERE m.rollout_status = 'ga'
              OR (m.rollout_status = 'beta' AND $1 IN ('beta', 'premium'))`,
          [license.subscription_plan]
        );
        for (const mod of planModules.rows) {
          await pgClient.query(
            `INSERT INTO tenant_module_subscriptions (tenant_id, module_id)
             VALUES ($1::uuid, $2)
             ON CONFLICT DO NOTHING`,
            [tenant.id, mod.id]
          );
        }

        // 7. Redeem license code
        await pgClient.query(
          `UPDATE license_codes
           SET redeemed_at = NOW(), tenant_id = $1::uuid
           WHERE id = $2::uuid AND redeemed_at IS NULL`,
          [tenant.id, license.id]
        );
        await pgClient.query(
          `UPDATE tenants
           SET reseller_id = $1::uuid, license_code_id = $2::uuid
           WHERE id = $3::uuid`,
          [license.reseller_id, license.id, tenant.id]
        );
        await pgClient.query(
          `UPDATE resellers SET seats_used = seats_used + 1
           WHERE id = $1::uuid`,
          [license.reseller_id]
        );

        await pgClient.query('COMMIT');

        res.status(201).json({
          success: true,
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
          user: { id: createdAuthUserId, email },
        });
      } catch (txError) {
        await pgClient.query('ROLLBACK');

        // Compensating action: if the Supabase auth user was already created
        // but a subsequent DB step failed, delete the orphaned auth user
        if (createdAuthUserId) {
          try {
            const supabaseAdmin = getSupabaseAdmin();
            await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
          } catch (cleanupError) {
            logger.error(
              { err: cleanupError, userId: createdAuthUserId },
              'Beta signup: failed to clean up orphaned auth user'
            );
          }
        }

        throw txError;
      } finally {
        pgClient.release();
      }
    } catch (error: any) {
      logger.error({ err: error }, 'Beta signup error');
      res.status(500).json({ error: 'Signup failed' });
    }
  });

  // =====================================================
  // VERTICAL MANAGEMENT ROUTES (Platform Admin Only)
  // =====================================================

  // Get all verticals (public for landing pages, full list for admins)
  app.get('/api/verticals', async (req, res) => {
    try {
      const { userId } = await getUserIdFromRequest(req);

      if (!userId) {
        // Unauthenticated: return only public-safe fields (no reseller/internal details)
        const result = await db.execute(sql`
          SELECT v.id, v.name, v.description, v.icon, v.is_system
          FROM verticals v
          ORDER BY v.is_system DESC, v.created_at ASC
          LIMIT 500
        `);
        return res.json(result.rows);
      }

      const result = await db.execute(sql`
        SELECT v.*, r.name as reseller_name
        FROM verticals v
        LEFT JOIN resellers r ON v.reseller_id = r.id
        ORDER BY v.is_system DESC, v.created_at ASC
        LIMIT 500
      `);
      res.json(result.rows);
    } catch (error: any) {
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create a vertical (platform admin, optionally for a reseller)
  app.post('/api/verticals', requirePlatformAdmin, async (req, res) => {
    try {
      const {
        slug,
        productName,
        displayName,
        resellerId,
        theme,
        terms,
        workflows,
        suggestedModules,
        landingContent,
        domains,
        isPublished,
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update a vertical
  app.put('/api/verticals/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const {
        slug,
        productName,
        displayName,
        theme,
        terms,
        workflows,
        suggestedModules,
        landingContent,
        domains,
        isPublished,
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
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
      logger.error({ err: error }, 'Internal server error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
