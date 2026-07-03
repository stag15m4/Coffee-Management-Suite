import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import logger from '../logger';
import { getUserIdFromRequest, logAuditEvent } from './core';

const CC_FEE_RATE = 0.035;

const tipPayoutCalculateSchema = z.object({
  tenantId: z.string().uuid(),
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekKey must be YYYY-MM-DD'),
  distributionMethod: z.enum(['hours', 'equal', 'points']).default('hours'),
});

const tipPayoutApproveSchema = z.object({
  tenantId: z.string().uuid(),
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekKey must be YYYY-MM-DD'),
  distributionMethod: z.enum(['hours', 'equal', 'points']).default('hours'),
  cashTips: z.number().min(0),
  ccTips: z.number().min(0),
  totalPool: z.number().min(0),
  totalHours: z.number().min(0),
  hourlyRate: z.number().min(0),
  employees: z
    .array(
      z.object({
        employee_id: z.string().uuid(),
        employee_name: z.string(),
        hours: z.number().min(0),
        payout: z.number().min(0),
      })
    )
    .min(1, 'At least one employee payout is required'),
});

export function registerTipRoutes(app: Express): void {
  // POST /api/tip-payouts/calculate
  // Server-side tip calculation — fetches hours and tips from DB, computes payouts
  app.post('/api/tip-payouts/calculate', async (req: Request, res: Response) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const profileResult = await db.execute(
        sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
      );
      const profile = profileResult.rows[0] as any;
      if (!profile) return res.status(403).json({ error: 'No active profile found' });

      const body = tipPayoutCalculateSchema.parse(req.body);

      // Verify user belongs to the requested tenant
      if (profile.tenant_id !== body.tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

      // Require at least lead role
      const allowedRoles = ['lead', 'manager', 'owner'];
      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: 'Insufficient role. Requires lead, manager, or owner.' });
      }

      const tenantId = body.tenantId;
      const weekKey = body.weekKey;

      // 1. Fetch tip data for the week from DB (server-side, not client-submitted)
      const weekDataResult = await db.execute(sql`
        SELECT cash_tips, cc_tips, cash_entries, cc_entries
        FROM tip_weekly_data
        WHERE tenant_id = ${tenantId}::uuid AND week_key = ${weekKey}::date
        LIMIT 1
      `);
      const weekData = weekDataResult.rows[0] as any;
      if (!weekData) {
        return res.status(404).json({ error: 'No tip data found for this week. Save tips first.' });
      }

      const cashTips = parseFloat(weekData.cash_tips) || 0;
      const ccTips = parseFloat(weekData.cc_tips) || 0;
      const ccAfterFee = ccTips * (1 - CC_FEE_RATE);
      const totalPool = cashTips + ccAfterFee;

      if (totalPool <= 0) {
        return res.status(400).json({ error: 'Tip pool must be positive. Enter tip amounts first.' });
      }

      // 2. Fetch employee hours for the week from DB
      const hoursResult = await db.execute(sql`
        SELECT teh.employee_id, teh.hours, te.name AS employee_name, te.is_active, te.tip_eligible
        FROM tip_employee_hours teh
        JOIN tip_employees te ON te.id = teh.employee_id
        WHERE teh.tenant_id = ${tenantId}::uuid
          AND teh.week_key = ${weekKey}::date
          AND te.is_active = true
          AND te.tip_eligible = true
        ORDER BY te.name
      `);

      const employeeRows = hoursResult.rows as any[];
      if (employeeRows.length === 0) {
        return res.status(400).json({ error: 'No employee hours found for this week. Add hours first.' });
      }

      // 3. Calculate payouts based on distribution method
      let employeePayouts: Array<{
        employee_id: string;
        employee_name: string;
        hours: number;
        payout: number;
      }>;

      const totalHours = employeeRows.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);

      if (body.distributionMethod === 'equal') {
        const equalShare = totalPool / employeeRows.length;
        employeePayouts = employeeRows.map((r) => ({
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          hours: parseFloat(r.hours) || 0,
          payout: Math.round(equalShare * 100) / 100,
        }));
      } else {
        // 'hours' distribution (default) — also used for 'points' as a fallback
        const hourlyRate = totalHours > 0 ? totalPool / totalHours : 0;
        employeePayouts = employeeRows.map((r) => {
          const hours = parseFloat(r.hours) || 0;
          return {
            employee_id: r.employee_id,
            employee_name: r.employee_name,
            hours,
            payout: Math.round(hours * hourlyRate * 100) / 100,
          };
        });
      }

      // Adjust rounding: ensure payouts sum to totalPool exactly
      const payoutSum = employeePayouts.reduce((sum, p) => sum + p.payout, 0);
      const roundingDiff = Math.round((totalPool - payoutSum) * 100) / 100;
      if (roundingDiff !== 0 && employeePayouts.length > 0) {
        employeePayouts[0].payout = Math.round((employeePayouts[0].payout + roundingDiff) * 100) / 100;
      }

      const hourlyRate = totalHours > 0 ? totalPool / totalHours : 0;

      logger.info(
        { userId, tenantId, weekKey, totalPool: totalPool.toFixed(2), employeeCount: employeePayouts.length },
        'Tip payout calculation requested'
      );

      res.json({
        weekKey,
        cashTips,
        ccTips,
        ccAfterFee: Math.round(ccAfterFee * 100) / 100,
        totalPool: Math.round(totalPool * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        hourlyRate: Math.round(hourlyRate * 10000) / 10000,
        distributionMethod: body.distributionMethod,
        employees: employeePayouts,
        calculatedAt: new Date().toISOString(),
        calculatedBy: userId,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      logger.error({ err: error }, 'Tip payout calculate error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tip-payouts/approve
  // Stores an approved tip payout record for audit trail
  app.post('/api/tip-payouts/approve', async (req: Request, res: Response) => {
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const profileResult = await db.execute(
        sql`SELECT tenant_id, role FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1`
      );
      const profile = profileResult.rows[0] as any;
      if (!profile) return res.status(403).json({ error: 'No active profile found' });

      const body = tipPayoutApproveSchema.parse(req.body);

      if (profile.tenant_id !== body.tenantId) {
        return res.status(403).json({ error: 'Not authorized for this tenant' });
      }

      // Only manager or owner can approve payouts
      if (!['manager', 'owner'].includes(profile.role)) {
        return res.status(403).json({ error: 'Only managers or owners can approve payouts.' });
      }

      // Server-side re-validation: fetch actual DB data to verify the submitted numbers
      const weekDataResult = await db.execute(sql`
        SELECT cash_tips, cc_tips
        FROM tip_weekly_data
        WHERE tenant_id = ${body.tenantId}::uuid AND week_key = ${body.weekKey}::date
        LIMIT 1
      `);
      const weekData = weekDataResult.rows[0] as any;
      if (!weekData) {
        return res.status(400).json({ error: 'No tip data found for this week.' });
      }

      const dbCash = parseFloat(weekData.cash_tips) || 0;
      const dbCc = parseFloat(weekData.cc_tips) || 0;
      const dbPool = dbCash + dbCc * (1 - CC_FEE_RATE);

      // Verify the submitted pool matches DB within a small tolerance
      if (Math.abs(dbPool - body.totalPool) > 0.02) {
        return res.status(409).json({
          error: 'Tip pool mismatch. The tip data may have changed. Please recalculate.',
          serverPool: Math.round(dbPool * 100) / 100,
          submittedPool: body.totalPool,
        });
      }

      // Verify each employee exists and belongs to this tenant
      const employeeIds = body.employees.map((e) => e.employee_id);
      const empCheckResult = await db.execute(sql`
        SELECT id FROM tip_employees
        WHERE tenant_id = ${body.tenantId}::uuid
          AND id = ANY(${employeeIds}::uuid[])
          AND is_active = true
      `);
      const validIds = new Set((empCheckResult.rows as any[]).map((r) => r.id));
      const invalidEmployees = employeeIds.filter((id) => !validIds.has(id));
      if (invalidEmployees.length > 0) {
        return res.status(400).json({
          error: `Invalid employee IDs: ${invalidEmployees.join(', ')}`,
        });
      }

      const _ccAfterFee = body.ccTips * (1 - CC_FEE_RATE);

      // Insert the approved payout record
      const insertResult = await db.execute(sql`
        INSERT INTO tip_payout_approvals (
          tenant_id, week_key, cash_tips, cc_tips, cc_fee_rate,
          total_pool, total_hours, hourly_rate, distribution_method,
          employee_payouts, calculated_by, calculated_at,
          approved_by, approved_at, status, updated_at
        ) VALUES (
          ${body.tenantId}::uuid,
          ${body.weekKey}::date,
          ${body.cashTips},
          ${body.ccTips},
          ${CC_FEE_RATE},
          ${body.totalPool},
          ${body.totalHours},
          ${body.hourlyRate},
          ${body.distributionMethod},
          ${JSON.stringify(body.employees)}::jsonb,
          ${userId}::uuid,
          NOW(),
          ${userId}::uuid,
          NOW(),
          'approved',
          NOW()
        )
        RETURNING id, approved_at
      `);

      const approval = insertResult.rows[0] as any;

      await logAuditEvent(
        body.tenantId,
        userId,
        'tip_payout.approved',
        'tip_payout',
        approval.id,
        null,
        {
          weekKey: body.weekKey,
          totalPool: body.totalPool,
          employeeCount: body.employees.length,
          distributionMethod: body.distributionMethod,
        },
        req.ip
      );

      logger.info(
        {
          userId,
          tenantId: body.tenantId,
          weekKey: body.weekKey,
          totalPool: body.totalPool.toFixed(2),
          employeeCount: body.employees.length,
          approvalId: approval.id,
        },
        'Tip payout approved'
      );

      res.status(201).json({
        id: approval.id,
        status: 'approved',
        approvedAt: approval.approved_at,
        approvedBy: userId,
        weekKey: body.weekKey,
        totalPool: body.totalPool,
        employeeCount: body.employees.length,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      // Handle unique constraint violation if they try to approve same week twice
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A payout for this week has already been approved.' });
      }
      logger.error({ err: error }, 'Tip payout approve error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
