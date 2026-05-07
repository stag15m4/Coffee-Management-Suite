import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import logger from '../logger';

// ── JSON-RPC 2.0 Types ─────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── Auth ───────────────────────────────────────────────────

function validateApiKey(req: Request): boolean {
  const expected = process.env.CMS_MCP_API_KEY;
  if (!expected) return false;
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return false;
  const provided = header.slice(7);
  if (provided.length !== expected.length) return false;
  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── Daily Equivalent Calculation ───────────────────────────
// Mirrors the logic in client/src/pages/recipe-costing/OverheadTab.tsx

function toDailyEquivalent(amount: number, frequency: string, operatingDaysPerWeek: number): number {
  const weeksPerMonth = 4.33;
  const daysPerMonth = operatingDaysPerWeek * weeksPerMonth;
  let monthly = 0;
  switch (frequency) {
    case 'daily':      monthly = amount * daysPerMonth; break;
    case 'weekly':     monthly = amount * weeksPerMonth; break;
    case 'bi-weekly':  monthly = amount * (weeksPerMonth / 2); break;
    case 'monthly':    monthly = amount; break;
    case 'quarterly':  monthly = amount / 3; break;
    case 'annual':     monthly = amount / 12; break;
    default:           return 0;
  }
  return monthly / daysPerMonth;
}

// ── Tool: get_daily_revenue ────────────────────────────────

async function getDailyRevenue(tenantId: string) {
  const result = await db.execute(sql`
    SELECT
      AVG(gross_revenue::float)  AS avg_daily_gross,
      MIN(drawer_date)           AS date_from,
      MAX(drawer_date)           AS date_to,
      COUNT(*)::int              AS day_count
    FROM cash_activity
    WHERE tenant_id          = ${tenantId}::uuid
      AND excluded_from_average = false
      AND archived             = false
      AND gross_revenue        IS NOT NULL
      AND gross_revenue        > 0
  `);

  const row = result.rows[0] as any;
  return {
    avg_daily_gross: row?.avg_daily_gross != null ? parseFloat(parseFloat(row.avg_daily_gross).toFixed(2)) : null,
    date_from:       row?.date_from  ? String(row.date_from).split('T')[0]  : null,
    date_to:         row?.date_to    ? String(row.date_to).split('T')[0]    : null,
    day_count:       row?.day_count  != null ? parseInt(row.day_count)      : 0,
  };
}

// ── Tool: get_overhead_items ───────────────────────────────

async function getOverheadItems(tenantId: string) {
  const [settingsRows, itemRows] = await Promise.all([
    db.execute(sql`
      SELECT operating_days_per_week, hours_open_per_day
      FROM   overhead_settings
      WHERE  tenant_id = ${tenantId}::uuid
      LIMIT  1
    `),
    db.execute(sql`
      SELECT id, name, amount::float AS amount, frequency, sort_order
      FROM   overhead_items
      WHERE  tenant_id = ${tenantId}::uuid
      ORDER  BY sort_order ASC NULLS LAST, name ASC
    `),
  ]);

  const settings = (settingsRows.rows[0] as any) ?? {};
  const opDays   = parseFloat(settings.operating_days_per_week ?? 7);

  const items = (itemRows.rows as any[]).map((row) => ({
    id:               row.id,
    name:             row.name as string,
    amount:           parseFloat(row.amount),
    frequency:        row.frequency as string,
    daily_equivalent: parseFloat(toDailyEquivalent(parseFloat(row.amount), row.frequency, opDays).toFixed(4)),
  }));

  const total_daily = parseFloat(items.reduce((s, i) => s + i.daily_equivalent, 0).toFixed(2));

  return {
    operating_days_per_week: opDays,
    total_daily,
    items,
  };
}

// ── Tool: get_payroll_summary ──────────────────────────────
// Gusto integration is CSV-export only (no live sync).
// We derive payroll from time_clock_entries × user_profiles.hourly_rate.

async function getPayrollSummary(tenantId: string) {
  const result = await db.execute(sql`
    WITH periods AS (
      SELECT
        (CURRENT_DATE - (14 * n)::int - 13) AS period_start,
        (CURRENT_DATE - (14 * n)::int)      AS period_end
      FROM generate_series(0, 3) AS t(n)
    ),
    employee_hours AS (
      SELECT
        p.period_start,
        p.period_end,
        tce.employee_id,
        SUM(
          GREATEST(0,
            EXTRACT(EPOCH FROM (tce.clock_out - tce.clock_in)) / 3600.0
          )
        ) AS hours_worked
      FROM periods p
      JOIN time_clock_entries tce
        ON  tce.tenant_id = ${tenantId}::uuid
        AND tce.clock_in::date BETWEEN p.period_start AND p.period_end
        AND tce.clock_out IS NOT NULL
      GROUP BY p.period_start, p.period_end, tce.employee_id
    )
    SELECT
      eh.period_start,
      eh.period_end,
      ROUND(SUM(eh.hours_worked * COALESCE(up.hourly_rate, 0))::numeric, 2)         AS gross_pay,
      ROUND(SUM(eh.hours_worked * COALESCE(up.hourly_rate, 0)) * 0.15::numeric, 2)  AS employer_tax_est,
      ROUND(SUM(eh.hours_worked * COALESCE(up.hourly_rate, 0)) * 1.15::numeric, 2)  AS total_labor_cost
    FROM employee_hours eh
    JOIN user_profiles up
      ON  up.id        = eh.employee_id
      AND up.tenant_id = ${tenantId}::uuid
      AND up.is_active = true
    GROUP BY eh.period_start, eh.period_end
    ORDER BY eh.period_start DESC
  `);

  return {
    source_note: 'Derived from time clock entries × hourly_rate. Employer tax estimated at 15%.',
    cycles: (result.rows as any[]).map((row) => ({
      period_start:       String(row.period_start).split('T')[0],
      period_end:         String(row.period_end).split('T')[0],
      gross_pay:          parseFloat(row.gross_pay   ?? 0),
      employer_tax_est:   parseFloat(row.employer_tax_est ?? 0),
      total_labor_cost:   parseFloat(row.total_labor_cost ?? 0),
    })),
  };
}

// ── Tool: get_pricing_matrix ───────────────────────────────

async function getPricingMatrix(tenantId: string) {
  const result = await db.execute(sql`
    SELECT
      r.id                                                          AS recipe_id,
      r.name                                                        AS drink_name,
      r.category,
      ps.name                                                       AS size_name,
      ps.size_value,
      ps.size_unit,
      rsp.price::float                                              AS sale_price,
      rsp.cost::float                                               AS cost,
      CASE
        WHEN rsp.price > 0
        THEN ROUND(((rsp.price - rsp.cost) / rsp.price * 100)::numeric, 2)::float
        ELSE 0
      END                                                           AS margin_pct
    FROM recipes r
    JOIN recipe_size_pricing rsp ON rsp.recipe_id = r.id
    JOIN product_sizes       ps  ON ps.id         = rsp.size_id
    WHERE r.tenant_id = ${tenantId}::uuid
      AND rsp.price IS NOT NULL
      AND rsp.price > 0
    ORDER BY r.name, ps.size_value
  `);

  return {
    drinks: (result.rows as any[]).map((row) => ({
      recipe_id:  row.recipe_id,
      drink_name: row.drink_name as string,
      category:   (row.category as string) ?? null,
      size_name:  row.size_name as string,
      size_value: row.size_value,
      size_unit:  row.size_unit as string,
      sale_price: parseFloat(row.sale_price),
      cost:       parseFloat(row.cost),
      margin_pct: parseFloat(row.margin_pct),
    })),
  };
}

// ── Tool: get_daily_cashflow_snapshot ─────────────────────

const COGS_VENDOR_KEYWORDS = ['five star', 'fortuna', 'mama b', 'maola'];

async function getDailyCashflowSnapshot(tenantId: string) {
  const today = new Date().toISOString().split('T')[0];

  const [revenue, overhead] = await Promise.all([
    getDailyRevenue(tenantId),
    getOverheadItems(tenantId),
  ]);

  const avgRevenue = revenue.avg_daily_gross ?? 0;

  const cogsItems   = overhead.items.filter((i) =>
    COGS_VENDOR_KEYWORDS.some((kw) => i.name.toLowerCase().includes(kw))
  );
  const opexItems   = overhead.items.filter((i) =>
    !COGS_VENDOR_KEYWORDS.some((kw) => i.name.toLowerCase().includes(kw))
  );

  const dailyCogs   = parseFloat(cogsItems.reduce((s, i) => s + i.daily_equivalent, 0).toFixed(2));
  const dailyOpex   = parseFloat(opexItems.reduce((s, i) => s + i.daily_equivalent, 0).toFixed(2));
  const taxSweep    = parseFloat((avgRevenue * 0.10).toFixed(2));
  const payrollReserve = 200.00;
  const trueNet     = parseFloat(
    (avgRevenue - dailyOpex - dailyCogs - taxSweep - payrollReserve).toFixed(2)
  );

  return {
    as_of_date:            today,
    avg_daily_revenue:     parseFloat(avgRevenue.toFixed(2)),
    daily_overhead:        dailyOpex,
    daily_cogs: {
      total:     dailyCogs,
      breakdown: cogsItems.map((i) => ({ vendor: i.name, daily: i.daily_equivalent })),
    },
    tax_sweep_10pct:        taxSweep,
    payroll_reserve_sweep:  payrollReserve,
    true_daily_net:         trueNet,
    revenue_basis_days:     revenue.day_count,
    revenue_date_range: {
      from: revenue.date_from,
      to:   revenue.date_to,
    },
  };
}

// ── MCP Tool Definitions ───────────────────────────────────

const MCP_TOOLS = [
  {
    name: 'get_daily_revenue',
    description:
      'Returns average daily gross revenue, date range, and number of days used in the average. Excludes days marked as excluded or archived. Source: cash_activity table.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_overhead_items',
    description:
      'Returns all overhead line items with name, amount, frequency, daily equivalent cost, and total daily overhead. Frequencies: daily, weekly, bi-weekly, monthly, quarterly, annual.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_payroll_summary',
    description:
      'Returns last 4 bi-weekly payroll cycles with gross pay, estimated employer tax (15%), and total labor cost. Derived from time clock entries multiplied by employee hourly rates — not a live Gusto sync.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_pricing_matrix',
    description:
      'Returns all drink recipes with cost, sale price, and gross margin % by size. Source: recipes + recipe_size_pricing + product_sizes tables.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_daily_cashflow_snapshot',
    description:
      'Primary financial health tool. Returns a single object with: today\'s date, avg daily revenue, daily overhead (opex), daily COGS (Five Star / Fortuna / Mama B\'s / Maola matched from overhead_items), 10% tax sweep, $200 payroll reserve sweep, and true daily net after all deductions.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ── JSON-RPC Dispatcher ────────────────────────────────────

async function handleMethod(
  method: string,
  params: Record<string, unknown> | undefined,
  tenantId: string
): Promise<unknown> {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'cms-mcp-server', version: '1.0.0' },
      };

    case 'notifications/initialized':
      return {};

    case 'tools/list':
      return { tools: MCP_TOOLS };

    case 'tools/call': {
      const name = params?.name as string | undefined;
      if (!name) throw { code: -32602, message: 'Missing required param: name' };

      switch (name) {
        case 'get_daily_revenue':         return getDailyRevenue(tenantId);
        case 'get_overhead_items':        return getOverheadItems(tenantId);
        case 'get_payroll_summary':       return getPayrollSummary(tenantId);
        case 'get_pricing_matrix':        return getPricingMatrix(tenantId);
        case 'get_daily_cashflow_snapshot': return getDailyCashflowSnapshot(tenantId);
        default:
          throw { code: -32601, message: `Unknown tool: ${name}` };
      }
    }

    default:
      throw { code: -32601, message: `Method not found: ${method}` };
  }
}

// ── Rate Limiter ───────────────────────────────────────────

const mcpRateLimit = rateLimit({
  windowMs: 60 * 1_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded — max 60 requests/minute' },
});

// ── Route Registration ─────────────────────────────────────

export function registerMcpRoutes(app: Express): void {
  const apiKey   = process.env.CMS_MCP_API_KEY;
  const tenantId = process.env.CMS_MCP_TENANT_ID;

  if (!apiKey || !tenantId) {
    logger.warn(
      { apiKeySet: !!apiKey, tenantIdSet: !!tenantId },
      'MCP server disabled — set CMS_MCP_API_KEY and CMS_MCP_TENANT_ID to enable'
    );
    return;
  }

  // Health / discovery endpoint
  app.get('/mcp', (_req, res) => {
    res.json({ server: 'cms-mcp-server', version: '1.0.0', transport: 'http', status: 'ok' });
  });

  // Main JSON-RPC endpoint
  app.post('/mcp', mcpRateLimit, async (req: Request, res: Response) => {
    if (!validateApiKey(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body as JsonRpcRequest | JsonRpcRequest[];
    const requests: JsonRpcRequest[] = Array.isArray(body) ? body : [body];
    const responses: JsonRpcResponse[] = [];

    for (const rpc of requests) {
      // Reject malformed requests
      if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
        responses.push({
          jsonrpc: '2.0',
          id: rpc.id ?? null,
          error: { code: -32600, message: 'Invalid Request' },
        });
        continue;
      }

      // Notifications (no id) — no response needed
      if (rpc.id === undefined && rpc.method.startsWith('notifications/')) {
        try { await handleMethod(rpc.method, rpc.params, tenantId); } catch (_) {}
        continue;
      }

      try {
        const result = await handleMethod(rpc.method, rpc.params, tenantId);

        // tools/call wraps data in MCP content envelope
        if (rpc.method === 'tools/call') {
          responses.push({
            jsonrpc: '2.0',
            id: rpc.id ?? null,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            },
          });
        } else {
          responses.push({ jsonrpc: '2.0', id: rpc.id ?? null, result });
        }
      } catch (err: any) {
        logger.error({ err, method: rpc.method }, 'MCP tool error');
        responses.push({
          jsonrpc: '2.0',
          id: rpc.id ?? null,
          error: {
            code:    err.code    ?? -32603,
            message: err.message ?? 'Internal server error',
          },
        });
      }
    }

    // Return array only if request was an array
    res.json(Array.isArray(body) ? responses : (responses[0] ?? null));
  });

  logger.info({ tenantId }, 'MCP server registered at POST /mcp');
}
