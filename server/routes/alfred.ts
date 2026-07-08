/**
 * Alfred Service Routes
 *
 * Read-only endpoints for the Alfred AI assistant.
 * All endpoints require either:
 * - Valid user session (Bearer JWT) — scoped to the user's own tenant
 * - Valid service token (X-Alfred-Token header matching ALFRED_SERVICE_TOKEN env)
 *   — scoped to the tenant allowlist in ALFRED_ALLOWED_TENANT_IDS
 *
 * These endpoints are INERT when ALFRED_SERVICE_TOKEN is unset, and a valid
 * token grants nothing unless ALFRED_ALLOWED_TENANT_IDS is also configured.
 */
import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getApiAuth } from '../service-auth';
import { parseAllowedTenantIds } from '../service-auth-core';
import logger from '../logger';

/**
 * Shared guard for tenant-scoped read endpoints.
 * Sends the error response and returns null when the request is not allowed;
 * returns the resolved tenant ID otherwise.
 */
async function authorizeTenantRead(req: Request, res: Response): Promise<string | null> {
  const auth = await getApiAuth(req);
  if (!auth.authenticated) {
    res.status(401).json({ error: 'Authentication required', debug: auth.debug });
    return null;
  }
  if (auth.tenantForbidden) {
    res.status(403).json({ error: 'Not authorized for this tenant' });
    return null;
  }
  if (!auth.tenantId) {
    res.status(400).json({ error: 'tenant_id query parameter required' });
    return null;
  }
  return auth.tenantId;
}

export function registerAlfredRoutes(app: Express): void {
  // Skip registration entirely if service token is not configured
  if (!process.env.ALFRED_SERVICE_TOKEN) {
    logger.info('Alfred service routes disabled (ALFRED_SERVICE_TOKEN not set)');
    return;
  }

  const allowedCount = parseAllowedTenantIds(process.env.ALFRED_ALLOWED_TENANT_IDS).length;
  if (allowedCount === 0) {
    logger.warn(
      'ALFRED_SERVICE_TOKEN is set but ALFRED_ALLOWED_TENANT_IDS is empty — service token requests will be rejected (fail closed)'
    );
  } else {
    logger.info(`Alfred service routes enabled (scoped to ${allowedCount} tenant(s))`);
  }

  /**
   * GET /api/alfred/ingredients
   * List all ingredients for a tenant
   * Query params: tenant_id (must be in the token's allowlist; optional when the allowlist has one tenant)
   */
  app.get('/api/alfred/ingredients', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      // Real columns per shared/schema.ts (Drizzle) + migration 074 (vendor_id)
      const result = await db.execute(sql`
        SELECT id, name, unit, cost, quantity, vendor_id
        FROM ingredients
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY name
      `);

      res.json({
        tenant_id: tenantId,
        count: result.rows.length,
        ingredients: result.rows,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/ingredients');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/recipes
   * List all recipes with their ingredients for a tenant
   * Query params: tenant_id
   */
  app.get('/api/alfred/recipes', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      // Real columns per shared/schema.ts (Drizzle) + migration 060 (minutes_per_drink)
      const recipesResult = await db.execute(sql`
        SELECT id, name, description, minutes_per_drink
        FROM recipes
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY name
      `);

      // recipe_ingredients has no unit column — the unit lives on the ingredient
      const ingredientsResult = await db.execute(sql`
        SELECT ri.recipe_id, ri.ingredient_id, ri.quantity,
               i.name as ingredient_name, i.cost as ingredient_cost,
               i.unit as ingredient_unit, i.quantity as ingredient_package_quantity
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        JOIN recipes r ON r.id = ri.recipe_id
        WHERE r.tenant_id = ${tenantId}::uuid
        ORDER BY ri.recipe_id, i.name
      `);

      // Group ingredients by recipe
      const ingredientsByRecipe = new Map<string, any[]>();
      for (const row of ingredientsResult.rows as any[]) {
        const recipeId = row.recipe_id;
        if (!ingredientsByRecipe.has(recipeId)) {
          ingredientsByRecipe.set(recipeId, []);
        }
        ingredientsByRecipe.get(recipeId)!.push({
          ingredient_id: row.ingredient_id,
          ingredient_name: row.ingredient_name,
          quantity: row.quantity,
          ingredient_cost: row.ingredient_cost,
          ingredient_unit: row.ingredient_unit,
          ingredient_package_quantity: row.ingredient_package_quantity,
        });
      }

      // Attach ingredients to recipes
      const recipes = (recipesResult.rows as any[]).map((recipe) => ({
        ...recipe,
        ingredients: ingredientsByRecipe.get(recipe.id) || [],
      }));

      res.json({
        tenant_id: tenantId,
        count: recipes.length,
        recipes,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/recipes');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/cash-activity
   * Get cash deposit/activity data for a tenant
   * Query params: tenant_id, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
   */
  app.get('/api/alfred/cash-activity', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      const startDate = (req.query.start_date as string) || null;
      const endDate = (req.query.end_date as string) || null;

      let query = sql`
        SELECT id, drawer_date, gross_revenue, starting_drawer, actual_deposit,
               cash_sales, tip_pool, owner_tips, pay_in, pay_out, cash_refund,
               transaction_count, notes, flagged, archived, excluded_from_average,
               created_at, updated_at
        FROM cash_activity
        WHERE tenant_id = ${tenantId}::uuid
      `;

      if (startDate) {
        query = sql`${query} AND drawer_date >= ${startDate}::date`;
      }
      if (endDate) {
        query = sql`${query} AND drawer_date <= ${endDate}::date`;
      }

      query = sql`${query} ORDER BY drawer_date DESC LIMIT 365`;

      const result = await db.execute(query);

      res.json({
        tenant_id: tenantId,
        count: result.rows.length,
        entries: result.rows,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/cash-activity');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/tip-employees
   * List tip-eligible employees for a tenant
   * Query params: tenant_id
   */
  app.get('/api/alfred/tip-employees', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      // Real columns per migrations 007 + 097; no updated_at, and kiosk_pin is never exposed
      const result = await db.execute(sql`
        SELECT id, name, is_active, tip_eligible, created_at
        FROM tip_employees
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY name
      `);

      res.json({
        tenant_id: tenantId,
        count: result.rows.length,
        employees: result.rows,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/tip-employees');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/tip-payouts
   * Get tip payout history for a tenant
   * Query params: tenant_id, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
   */
  app.get('/api/alfred/tip-payouts', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      const startDate = (req.query.start_date as string) || null;
      const endDate = (req.query.end_date as string) || null;

      // Source of truth in production is tip_weekly_data + tip_employee_hours
      // (migration 007) — the same tables the native tip-payout page and its
      // historical export read. Payouts are computed the same way as
      // POST /api/tip-payouts/calculate in server/routes/tips.ts.
      const CC_FEE_RATE = 0.035;

      let weeksQuery = sql`
        SELECT to_char(week_key, 'YYYY-MM-DD') AS week_key,
               cash_tips, cc_tips, created_at, updated_at
        FROM tip_weekly_data
        WHERE tenant_id = ${tenantId}::uuid
      `;
      if (startDate) {
        weeksQuery = sql`${weeksQuery} AND week_key >= ${startDate}::date`;
      }
      if (endDate) {
        weeksQuery = sql`${weeksQuery} AND week_key <= ${endDate}::date`;
      }
      weeksQuery = sql`${weeksQuery} ORDER BY week_key DESC LIMIT 52`;

      let hoursQuery = sql`
        SELECT to_char(teh.week_key, 'YYYY-MM-DD') AS week_key,
               teh.employee_id, teh.hours, te.name AS employee_name
        FROM tip_employee_hours teh
        JOIN tip_employees te ON te.id = teh.employee_id
        WHERE teh.tenant_id = ${tenantId}::uuid
      `;
      if (startDate) {
        hoursQuery = sql`${hoursQuery} AND teh.week_key >= ${startDate}::date`;
      }
      if (endDate) {
        hoursQuery = sql`${hoursQuery} AND teh.week_key <= ${endDate}::date`;
      }
      hoursQuery = sql`${hoursQuery} ORDER BY teh.week_key, te.name`;

      const [weeksResult, hoursResult] = await Promise.all([db.execute(weeksQuery), db.execute(hoursQuery)]);

      // Group employee hours by week
      const hoursByWeek = new Map<string, Array<{ employee_id: string; employee_name: string; hours: number }>>();
      for (const row of hoursResult.rows as any[]) {
        const entries = hoursByWeek.get(row.week_key) || [];
        entries.push({
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          hours: parseFloat(row.hours) || 0,
        });
        hoursByWeek.set(row.week_key, entries);
      }

      // Compute payouts per week — same math as the native calculate endpoint
      const payouts = (weeksResult.rows as any[]).map((week) => {
        const cashTips = parseFloat(week.cash_tips) || 0;
        const ccTips = parseFloat(week.cc_tips) || 0;
        const ccAfterFee = ccTips * (1 - CC_FEE_RATE);
        const totalPool = cashTips + ccAfterFee;

        const employees = hoursByWeek.get(week.week_key) || [];
        const totalHours = employees.reduce((sum, e) => sum + e.hours, 0);
        const hourlyRate = totalHours > 0 ? totalPool / totalHours : 0;

        return {
          week_key: week.week_key,
          cash_tips: cashTips,
          cc_tips: ccTips,
          cc_fee_rate: CC_FEE_RATE,
          total_pool: Math.round(totalPool * 100) / 100,
          total_hours: totalHours,
          hourly_rate: Math.round(hourlyRate * 10000) / 10000,
          employees: employees.map((e) => ({
            ...e,
            payout: Math.round(e.hours * hourlyRate * 100) / 100,
          })),
        };
      });

      res.json({
        tenant_id: tenantId,
        count: payouts.length,
        payouts,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/tip-payouts');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/overhead
   * Get overhead items and settings for a tenant
   * Query params: tenant_id
   */
  app.get('/api/alfred/overhead', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      // Fetch overhead settings
      const settingsResult = await db.execute(sql`
        SELECT operating_days_per_week, hours_open_per_day, owner_tips_enabled
        FROM overhead_settings
        WHERE tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);

      // Fetch overhead items
      const itemsResult = await db.execute(sql`
        SELECT id, name, amount, frequency, created_at, updated_at
        FROM overhead_items
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY name
      `);

      const settings = settingsResult.rows[0] || {
        operating_days_per_week: 7,
        hours_open_per_day: 8,
        owner_tips_enabled: true,
      };

      res.json({
        tenant_id: tenantId,
        settings,
        items: itemsResult.rows,
        item_count: itemsResult.rows.length,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/overhead');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/equipment
   * List equipment and maintenance tasks for a tenant
   * Query params: tenant_id
   */
  app.get('/api/alfred/equipment', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      // Real columns per migrations 013 + 028/061/100/134 (no brand/warranty_end/location/status)
      const equipmentResult = await db.execute(sql`
        SELECT id, name, category, model, serial_number, purchase_date,
               has_warranty, warranty_duration_months, warranty_notes,
               in_service_date, current_mileage, is_active, notes, created_at, updated_at
        FROM equipment
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY name
      `);

      // maintenance_tasks uses interval_type/interval_days/interval_units, not frequency
      const tasksResult = await db.execute(sql`
        SELECT mt.id, mt.equipment_id, mt.name, mt.description, mt.interval_type,
               mt.interval_days, mt.interval_units, mt.usage_unit_label, mt.current_usage,
               mt.last_completed_at, mt.next_due_at, mt.is_active,
               e.name as equipment_name
        FROM maintenance_tasks mt
        JOIN equipment e ON e.id = mt.equipment_id
        WHERE e.tenant_id = ${tenantId}::uuid
        ORDER BY mt.next_due_at
      `);

      res.json({
        tenant_id: tenantId,
        equipment_count: equipmentResult.rows.length,
        equipment: equipmentResult.rows,
        maintenance_tasks: tasksResult.rows,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/equipment');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/tenants
   * Lists ONLY the tenants this credential may read:
   * - Service token: the tenants in ALFRED_ALLOWED_TENANT_IDS
   * - User session: the user's own tenant
   * Never returns the full customer list.
   */
  app.get('/api/alfred/tenants', async (req: Request, res: Response) => {
    try {
      const auth = await getApiAuth(req);
      if (!auth.authenticated) {
        return res.status(401).json({ error: 'Authentication required', debug: auth.debug });
      }

      let tenantIds: string[];
      if (auth.isServiceToken) {
        tenantIds = auth.allowedTenantIds || [];
      } else {
        if (!auth.tenantId) {
          return res.status(403).json({ error: 'No tenant association found' });
        }
        tenantIds = [auth.tenantId];
      }

      if (tenantIds.length === 0) {
        return res.json({ count: 0, tenants: [] });
      }

      const idList = sql.join(
        tenantIds.map((id) => sql`${id}::uuid`),
        sql`, `
      );
      const result = await db.execute(sql`
        SELECT id, name, slug, subscription_status, is_active, created_at
        FROM tenants
        WHERE is_active = true AND id IN (${idList})
        ORDER BY name
      `);

      res.json({
        count: result.rows.length,
        tenants: result.rows,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/tenants');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
