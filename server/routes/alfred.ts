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
import crypto from 'crypto';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getApiAuth } from '../service-auth';
import { parseAllowedTenantIds } from '../service-auth-core';
import { logAuditEvent } from './core';
import logger from '../logger';

// Overhead line-item frequencies allowed by the DB CHECK (migrations 054/055).
const OVERHEAD_FREQUENCIES = ['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'annual'] as const;
const CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const INGREDIENT_BATCH_MAX_ITEMS = 50;

// audit_logs.actor_id is UUID NOT NULL with no FK constraint (migration 143),
// so a service-token write — which has no real user — needs a stand-in value
// rather than null. Fixed and documented here rather than left as some
// arbitrary UUID a future reader has to puzzle out from a database dump.
const ALFRED_SERVICE_ACTOR_ID = 'a1fed000-0000-0000-0000-000000000000';

/** Thrown inside a batch-write transaction to abort and roll back everything
 * already applied when one target row vanished between propose and confirm
 * (e.g. the ingredient was deleted). Caught by the route handler and turned
 * into a 409 — a batch either fully applies or not at all. */
class MissingTargetError extends Error {
  constructor(public name: string) {
    super(`missing:${name}`);
  }
}

/** Thrown inside a batch-write transaction when a "create" item's name
 * collides with an ingredient inserted by someone else between propose and
 * confirm — ingredients.name has no DB-level unique constraint, so this is
 * the only thing standing between two concurrent callers and an actual
 * duplicate row. Same all-or-nothing rollback treatment as a missing target. */
class DuplicateCreatedSinceProposeError extends Error {
  constructor(public name: string) {
    super(`duplicate:${name}`);
  }
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export interface IngredientBatchItemInput {
  id: string | null;
  name: string | null;
  unit: string | null; // only present/used when isNew
  cost: number;
  quantity: number;
  isNew: boolean;
}

export type IngredientBatchItemValidation =
  | { ok: true; value: IngredientBatchItemInput }
  | { ok: false; error: string };

/**
 * Validates one raw item from POST /api/alfred/ingredients's `items` array.
 * Pure — no DB access, never throws. `cost` is the price of the whole
 * package and `quantity` is the package size it's divided by (per
 * shared/schema.ts: "Cost per package" / "Amount in package") — unit cost,
 * which is what every recipe's margin is actually computed from, is
 * cost / quantity. Both are required on every item so a write can never
 * change one half of that ratio without the other.
 *
 * `new: true` marks an item as creating a brand-new ingredient rather than
 * updating an existing one — it requires `name` + `unit` and forbids `id`
 * (a new ingredient has no id yet). `unit` is rejected on a non-new item:
 * it's immutable through this endpoint, so accepting it silently there
 * would suggest a capability that doesn't exist.
 */
export function validateIngredientBatchItem(raw: unknown, index: number): IngredientBatchItemValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: `items[${index}] must be an object` };
  }
  const r = raw as Record<string, unknown>;
  const isNew = r.new === true;

  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : null;
  const name = typeof r.name === 'string' && r.name.trim().length > 0 ? r.name.trim() : null;

  if (isNew && id) {
    return { ok: false, error: `items[${index}]: a new ingredient can't also specify "id"` };
  }
  if (isNew && !name) {
    return { ok: false, error: `items[${index}]: a new ingredient needs a "name"` };
  }
  if (!isNew && !id && !name) {
    return { ok: false, error: `items[${index}] needs an "id" or a "name" to identify the ingredient` };
  }
  if (name && name.length > 200) {
    return { ok: false, error: `items[${index}].name must be 200 characters or fewer` };
  }

  let unit: string | null = null;
  if (isNew) {
    const unitRaw = typeof r.unit === 'string' ? r.unit.trim() : '';
    if (!unitRaw) {
      return { ok: false, error: `items[${index}]: a new ingredient needs a "unit" (e.g. "lb", "oz", "each")` };
    }
    if (unitRaw.length > 20) {
      return { ok: false, error: `items[${index}].unit must be 20 characters or fewer` };
    }
    unit = unitRaw;
  } else if (typeof r.unit === 'string' && r.unit.trim().length > 0) {
    return {
      ok: false,
      error: `items[${index}]: "unit" is only accepted when "new" is true — unit can't be changed on an existing ingredient here`,
    };
  }

  const costRaw = typeof r.cost === 'number' ? r.cost : Number(r.cost);
  if (!Number.isFinite(costRaw) || costRaw < 0) {
    return { ok: false, error: `items[${index}].cost must be a number >= 0` };
  }

  const quantityRaw = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity);
  if (!Number.isFinite(quantityRaw) || quantityRaw <= 0) {
    return {
      ok: false,
      error: `items[${index}].quantity must be a number > 0 — it's the package size "cost" is divided by to get unit cost`,
    };
  }

  return {
    ok: true,
    value: { id, name, unit, cost: Math.round(costRaw * 100) / 100, quantity: quantityRaw, isNew },
  };
}

export interface IngredientUpdateChange {
  kind: 'update';
  item_id: string;
  name: string;
  unit: string;
  previous_cost: number;
  previous_quantity: number;
  cost: number;
  quantity: number;
}

export interface IngredientCreateChange {
  kind: 'create';
  name: string;
  unit: string;
  cost: number;
  quantity: number;
  /** Non-blocking — the nearest existing ingredient this name resembles, if any. */
  possible_duplicate: { id: string; name: string } | null;
}

export type IngredientBatchChange = IngredientUpdateChange | IngredientCreateChange;

function ingredientUnitCost(cost: number, quantity: number): number {
  return quantity > 0 ? cost / quantity : 0;
}

/**
 * One human-readable line for an existing ingredient's cost/quantity change,
 * always showing the resulting $/unit on both sides — not just the raw
 * package price — since a package-price change with an unchanged quantity,
 * or vice versa, is exactly how unit cost (what recipe margins use) moves
 * without anyone noticing.
 */
export function formatIngredientUpdateLine(c: IngredientUpdateChange): string {
  const prevUnitCost = ingredientUnitCost(c.previous_cost, c.previous_quantity);
  const newUnitCost = ingredientUnitCost(c.cost, c.quantity);
  const qtyPart =
    c.previous_quantity === c.quantity ? `${c.quantity} ${c.unit}` : `${c.previous_quantity} → ${c.quantity} ${c.unit}`;
  return `${c.name}: ${usd(c.previous_cost)} → ${usd(c.cost)} for ${qtyPart} (${usd(prevUnitCost)}/${c.unit} → ${usd(newUnitCost)}/${c.unit})`;
}

/**
 * One human-readable line for a brand-new ingredient, flagging a possible
 * duplicate right in the line the human is asked to read before confirming
 * — not buried in a separate field they'd have to know to check.
 */
export function formatIngredientCreateLine(c: IngredientCreateChange): string {
  const unitCost = ingredientUnitCost(c.cost, c.quantity);
  const dupSuffix = c.possible_duplicate
    ? ` — possible duplicate of existing "${c.possible_duplicate.name}"; review before confirming`
    : '';
  return `${c.name} (NEW): ${usd(c.cost)} for ${c.quantity} ${c.unit} (${usd(unitCost)}/${c.unit})${dupSuffix}`;
}

export function formatIngredientChangeLine(c: IngredientBatchChange): string {
  return c.kind === 'update' ? formatIngredientUpdateLine(c) : formatIngredientCreateLine(c);
}

/** The full multi-line summary read back to a human before they confirm a batch. */
export function buildIngredientBatchSummary(changes: IngredientBatchChange[]): string {
  const updateCount = changes.filter((c) => c.kind === 'update').length;
  const createCount = changes.filter((c) => c.kind === 'create').length;

  const clauses: string[] = [];
  if (updateCount > 0) clauses.push(`update ${updateCount} ingredient${updateCount === 1 ? '' : 's'}`);
  if (createCount > 0) clauses.push(`add ${createCount} new ingredient${createCount === 1 ? '' : 's'}`);
  const header = `${clauses.join(' and ').replace(/^./, (ch) => ch.toUpperCase())}:`;

  return [header, ...changes.map((c) => `- ${formatIngredientChangeLine(c)}`)].join('\n');
}

function normalizeIngredientName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Classic Levenshtein edit distance — dependency-free on purpose, this is
 * the only place it's needed. */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost));
    }
    prev = curr;
  }
  return prev[n];
}

/**
 * Non-blocking near-duplicate heuristic for a NEW ingredient's name against
 * an EXISTING one. An exact match (after trim/case/whitespace normalizing)
 * is a hard conflict handled separately — this is for the case that would
 * otherwise sail through with no error at all: a typo or a suffixed variant
 * ("Oat Milk" vs "Oat Milk (Case)") that creates a second, disconnected
 * ingredient row no recipe will ever reference. Two rules, either trips it:
 * one normalized name contains the other (both need to be a real word, not
 * a short prefix), or they're a small edit distance apart scaled to length
 * (an absolute threshold would over-flag short names and under-flag long
 * ones).
 */
export function isLikelyDuplicateIngredientName(a: string, b: string): boolean {
  const na = normalizeIngredientName(a);
  const nb = normalizeIngredientName(b);
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  const threshold = Math.max(1, Math.floor(Math.min(na.length, nb.length) / 4));
  return levenshteinDistance(na, nb) <= threshold;
}

/**
 * A confirmation token's stored payload can be up to CONFIRMATION_TTL_MS
 * old, so a confirm can still be redeemed against a payload proposed by a
 * previous deploy of this endpoint. Before "new" (create) items existed,
 * every item was an update and none carried a `kind` field. Without this
 * normalization, such an item falls through the confirm handler's
 * kind === 'update' check into the create branch: it usually just 409s as
 * an exact-name "duplicate" of the very ingredient it meant to update, but
 * if that ingredient was renamed or deleted between propose and confirm,
 * the create branch would find no match and insert a phantom duplicate
 * instead of ever applying the intended update.
 */
export function normalizeLegacyIngredientPayloadItems<T extends { kind?: 'update' | 'create' }>(
  items: T[]
): Array<T & { kind: 'update' | 'create' }> {
  return items.map((item) =>
    item.kind ? (item as T & { kind: 'update' | 'create' }) : { ...item, kind: 'update' as const }
  );
}

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
    // 403 is reserved for tenant authorization ONLY — date ranges, archived
    // data, and pagination can never produce it.
    res.status(403).json({
      error: `Token is not authorized for tenant ${req.query.tenant_id ?? '(none)'} — check tenant_id against the token's allowlist`,
    });
    return null;
  }
  if (!auth.tenantId) {
    res.status(400).json({ error: 'tenant_id query parameter required' });
    return null;
  }
  return auth.tenantId;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface RangeAndPagination {
  startDate: string | null;
  endDate: string | null;
  limit: number;
  offset: number;
}

/**
 * Parses start_date / end_date / limit / offset for date-ranged endpoints.
 * Malformed input gets a 400 with a clear message (never a 403, and never an
 * unvalidated cast that would 500). Returns null after responding on invalid
 * input. Date filters are applied inside the SQL query; limit/offset paginate
 * WITHIN the requested range, newest first, and the caller reports has_more.
 */
function parseRangeAndPagination(
  req: Request,
  res: Response,
  opts: { defaultLimit: number; maxLimit: number }
): RangeAndPagination | null {
  const startDate = (req.query.start_date as string) || null;
  const endDate = (req.query.end_date as string) || null;

  for (const [name, value] of [
    ['start_date', startDate],
    ['end_date', endDate],
  ] as const) {
    if (value && !DATE_RE.test(value)) {
      res.status(400).json({ error: `${name} must be YYYY-MM-DD (got "${value}")` });
      return null;
    }
  }
  if (startDate && endDate && startDate > endDate) {
    res.status(400).json({ error: `start_date ${startDate} is after end_date ${endDate}` });
    return null;
  }

  const rawLimit = req.query.limit === undefined ? opts.defaultLimit : Number(req.query.limit);
  const rawOffset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    res.status(400).json({ error: `limit must be a positive integer (max ${opts.maxLimit})` });
    return null;
  }
  if (!Number.isInteger(rawOffset) || rawOffset < 0) {
    res.status(400).json({ error: 'offset must be a non-negative integer' });
    return null;
  }

  return { startDate, endDate, limit: Math.min(rawLimit, opts.maxLimit), offset: rawOffset };
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
   * POST /api/alfred/ingredients — batch write path for ingredient cost /
   * quantity updates AND new-ingredient creation (e.g. transcribing a
   * distributor invoice that has both price changes and new products).
   *
   * Two-step, one endpoint, dispatched on body shape (same X-Alfred-Token
   * auth as every other Alfred route):
   *  - PROPOSE: body has { items: [...] } and NO confirmationToken. Writes
   *    nothing. Each item is either an UPDATE (id or name identifies an
   *    existing ingredient) or a CREATE (`new: true`, needs name + unit).
   *    If ANY item fails to resolve or validate, the whole batch is
   *    rejected and no token is issued — no partial-batch propose. Returns
   *    a human-readable `summary` (one line per item, always showing $/unit
   *    for updates, flagging any create that resembles an existing
   *    ingredient) and a single-use `confirmationToken` covering the whole
   *    batch (5-min expiry).
   *  - CONFIRM: body has { confirmationToken }. Redeems the token and
   *    applies every item in ONE transaction. If an update target vanished,
   *    or a create's name collides with something inserted since propose
   *    (ingredients.name has no DB unique constraint — see the in-transaction
   *    re-check below), the entire batch rolls back. An invoice never
   *    half-applies.
   *
   * A create's exact name match against an existing ingredient is a hard
   * 400 at propose time ("already exists, update it instead"). A NEAR
   * match is not blocked — silently creating a real duplicate is worse than
   * a false-positive warning — but is surfaced in both the summary line and
   * the `changes` response so a human reviews it before confirming.
   */
  app.post('/api/alfred/ingredients', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;

      // ── CONFIRM ────────────────────────────────────────────────────────
      if (typeof body.confirmationToken === 'string' && body.confirmationToken.length > 0) {
        const token = body.confirmationToken;
        const found = await db.execute(
          sql`SELECT tenant_id, payload, summary, used_at, expires_at
              FROM alfred_confirmation_tokens WHERE token = ${token} LIMIT 1`
        );
        const rec = found.rows[0] as any;
        if (!rec) return res.status(404).json({ error: 'Unknown confirmation token' });

        (req.query as any).tenant_id = rec.tenant_id;
        const tenantId = await authorizeTenantRead(req, res);
        if (!tenantId) return;

        if (rec.used_at) return res.status(409).json({ error: 'This confirmation token has already been used' });
        if (new Date(rec.expires_at).getTime() <= Date.now()) {
          return res.status(410).json({ error: 'Confirmation token expired — re-propose to get a fresh one' });
        }

        const rawPayload = rec.payload as {
          items: Array<(Omit<IngredientUpdateChange, 'kind'> & { kind?: 'update' }) | IngredientCreateChange>;
        };
        const p = { items: normalizeLegacyIngredientPayloadItems(rawPayload.items) };

        type ApplyResult =
          | { status: 'ok'; items: Array<Record<string, any>> }
          | { status: 'race' }
          | { status: 'missing'; name: string }
          | { status: 'duplicate'; name: string };

        let applied: ApplyResult;
        try {
          applied = await db.transaction(async (tx) => {
            // Atomically claim the token so a double-confirm can't double-write.
            const claim = await tx.execute(
              sql`UPDATE alfred_confirmation_tokens SET used_at = NOW()
                  WHERE token = ${token} AND used_at IS NULL AND expires_at > NOW()
                  RETURNING token`
            );
            if (claim.rows.length === 0) return { status: 'race' as const };

            // A missing update target or a name collision on a create must
            // undo everything already applied earlier in this same batch —
            // so both throw to abort the transaction rather than returning a
            // status, which db.transaction rolls back on.
            const results: Array<Record<string, any>> = [];
            for (const item of p.items) {
              if (item.kind === 'update') {
                const upd = await tx.execute(
                  sql`UPDATE ingredients
                      SET cost = ${item.cost}, quantity = ${item.quantity}
                      WHERE id = ${item.item_id}::uuid AND tenant_id = ${tenantId}::uuid
                      RETURNING id, name, unit, cost, quantity`
                );
                if (upd.rows.length === 0) throw new MissingTargetError(item.name);
                results.push({ ...(upd.rows[0] as Record<string, any>), kind: 'update' });
              } else {
                // No DB unique constraint backs the exact-match check from
                // propose time — two safeguards here, both necessary:
                //
                // 1. A transaction-scoped advisory lock keyed on (tenant,
                //    normalized name), released automatically at commit or
                //    rollback. A bare re-check SELECT is still a race under
                //    READ COMMITTED — two concurrent confirms for the same
                //    new name can each pass the SELECT before either COMMITs
                //    and both INSERT, since nothing here serializes them
                //    against each other (the token claim above only
                //    serializes reuse of that ONE token). The lock forces
                //    the second confirm to wait for the first to finish
                //    before it even runs its own check.
                // 2. The re-check itself must use the SAME normalization as
                //    propose's exact-match check (normalizeIngredientName —
                //    collapses internal whitespace, not just btrim's
                //    leading/trailing) — otherwise "Oat Milk" vs "Oat  Milk"
                //    (double space) inserted concurrently would slip past
                //    both. Done in JS against a fresh fetch, reusing the
                //    exact function propose used, rather than hand-keeping a
                //    second SQL implementation of the same normalization in
                //    sync with it.
                await tx.execute(
                  sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}::text), hashtext(${normalizeIngredientName(item.name)}::text))`
                );
                const existingResult = await tx.execute(
                  sql`SELECT name FROM ingredients WHERE tenant_id = ${tenantId}::uuid`
                );
                const nameKey = normalizeIngredientName(item.name);
                const collides = (existingResult.rows as Array<{ name: string }>).some(
                  (r) => normalizeIngredientName(r.name) === nameKey
                );
                if (collides) throw new DuplicateCreatedSinceProposeError(item.name);
                const ins = await tx.execute(
                  sql`INSERT INTO ingredients (tenant_id, name, unit, cost, quantity)
                      VALUES (${tenantId}::uuid, ${item.name}, ${item.unit}, ${item.cost}, ${item.quantity})
                      RETURNING id, name, unit, cost, quantity`
                );
                results.push({ ...(ins.rows[0] as Record<string, any>), kind: 'create' });
              }
            }
            return { status: 'ok' as const, items: results };
          });
        } catch (err) {
          if (err instanceof MissingTargetError) {
            applied = { status: 'missing', name: err.name };
          } else if (err instanceof DuplicateCreatedSinceProposeError) {
            applied = { status: 'duplicate', name: err.name };
          } else {
            throw err;
          }
        }

        if (applied.status === 'race') {
          return res.status(409).json({ error: 'This confirmation token has already been used' });
        }
        if (applied.status === 'missing') {
          return res.status(409).json({
            error: `"${applied.name}" no longer exists — the whole batch was NOT applied. Re-propose to apply the remaining changes.`,
          });
        }
        if (applied.status === 'duplicate') {
          return res.status(409).json({
            error: `An ingredient named "${applied.name}" was created since this batch was proposed — the whole batch was NOT applied. Re-propose to review the conflict.`,
          });
        }

        // Best-effort audit trail, one row per item — index-aligned with
        // p.items since results are pushed in the same order they're
        // processed above. Not part of the transaction (logAuditEvent
        // swallows its own errors, same as every other caller of it in this
        // codebase) — a logging failure must never look like the write itself failed.
        for (let i = 0; i < p.items.length; i++) {
          const item = p.items[i];
          const row = applied.items[i];
          if (item.kind === 'update') {
            await logAuditEvent(
              tenantId,
              ALFRED_SERVICE_ACTOR_ID,
              'alfred.ingredient.cost_updated',
              'ingredient',
              row.id,
              { cost: item.previous_cost, quantity: item.previous_quantity },
              { cost: item.cost, quantity: item.quantity },
              req.ip
            );
          } else {
            await logAuditEvent(
              tenantId,
              ALFRED_SERVICE_ACTOR_ID,
              'alfred.ingredient.created',
              'ingredient',
              row.id,
              null,
              { name: item.name, unit: item.unit, cost: item.cost, quantity: item.quantity },
              req.ip
            );
          }
        }

        return res.json({
          applied: true,
          summary: rec.summary,
          items: applied.items.map((i) => ({ ...i, cost: parseFloat(i.cost), quantity: parseFloat(i.quantity) })),
        });
      }

      // ── PROPOSE ────────────────────────────────────────────────────────
      // Opportunistic cleanup so the token table doesn't grow unbounded.
      await db.execute(sql`DELETE FROM alfred_confirmation_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`);

      (req.query as any).tenant_id = body.tenant_id ?? (req.query as any).tenant_id;
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      if (!Array.isArray(body.items) || body.items.length === 0) {
        return res.status(400).json({ error: '"items" must be a non-empty array' });
      }
      if (body.items.length > INGREDIENT_BATCH_MAX_ITEMS) {
        return res.status(400).json({
          error: `A batch can have at most ${INGREDIENT_BATCH_MAX_ITEMS} items — split into multiple calls`,
        });
      }

      const validatedItems: IngredientBatchItemInput[] = [];
      for (let i = 0; i < body.items.length; i++) {
        const v = validateIngredientBatchItem(body.items[i], i);
        if (!v.ok) return res.status(400).json({ error: v.error });
        validatedItems.push(v.value);
      }

      // One fetch of every ingredient this tenant has, used to resolve
      // every item in the batch — exact id/name match for updates, exact-
      // conflict and near-duplicate checks for creates — without an N+1
      // query per item. Tenant ingredient lists are small (a coffee shop's
      // full inventory, not a warehouse catalog), so this is cheap.
      const allResult = await db.execute(
        sql`SELECT id, name, unit, cost, quantity FROM ingredients WHERE tenant_id = ${tenantId}::uuid`
      );
      const all = allResult.rows as Array<{ id: string; name: string; unit: string; cost: string; quantity: string }>;
      const byNormalizedName = new Map<string, typeof all>();
      for (const row of all) {
        const key = normalizeIngredientName(row.name);
        const list = byNormalizedName.get(key) ?? [];
        list.push(row);
        byNormalizedName.set(key, list);
      }
      const byId = new Map(all.map((row) => [row.id, row]));

      // Resolve every item. Any failure aborts the whole batch here, before
      // any token is created — the only way propose succeeds is if every
      // line item is resolvable (and every create is a genuinely new name).
      const resolved: IngredientBatchChange[] = [];
      const claimedTargets = new Set<string>(); // "id:<uuid>" for updates, "new:<normalized name>" for creates

      for (let i = 0; i < validatedItems.length; i++) {
        const item = validatedItems[i];

        if (item.isNew) {
          const nameKey = normalizeIngredientName(item.name as string);
          const exact = byNormalizedName.get(nameKey);
          if (exact && exact.length > 0) {
            return res.status(400).json({
              error: `items[${i}]: an ingredient named "${item.name}" already exists — pass its "id" to update it instead of creating a duplicate`,
              existing: exact.map((r) => ({
                id: r.id,
                unit: r.unit,
                cost: parseFloat(r.cost),
                quantity: parseFloat(r.quantity),
              })),
            });
          }
          const claimKey = `new:${nameKey}`;
          if (claimedTargets.has(claimKey)) {
            return res
              .status(400)
              .json({ error: `items[${i}]: "${item.name}" is created by more than one item in this batch` });
          }
          claimedTargets.add(claimKey);

          // Non-blocking — checked against what already exists, not against
          // other creates in this batch (two genuinely new similar products
          // on one invoice is plausible and shouldn't warn against each other).
          let possibleDuplicate: { id: string; name: string } | null = null;
          for (const existing of all) {
            if (isLikelyDuplicateIngredientName(item.name as string, existing.name)) {
              possibleDuplicate = { id: existing.id, name: existing.name };
              break;
            }
          }

          resolved.push({
            kind: 'create',
            name: item.name as string,
            unit: item.unit as string,
            cost: item.cost,
            quantity: item.quantity,
            possible_duplicate: possibleDuplicate,
          });
          continue;
        }

        let row: { id: string; name: string; unit: string; cost: string; quantity: string } | undefined;
        if (item.id) {
          row = byId.get(item.id);
          if (!row) {
            return res.status(400).json({ error: `items[${i}]: no ingredient with id ${item.id} for this tenant` });
          }
        } else {
          const matches = byNormalizedName.get(normalizeIngredientName(item.name as string)) ?? [];
          if (matches.length > 1) {
            return res.status(400).json({
              error: `items[${i}]: "${item.name}" matches ${matches.length} ingredients — pass an explicit "id" to disambiguate`,
              candidates: matches.map((r) => ({
                id: r.id,
                unit: r.unit,
                cost: parseFloat(r.cost),
                quantity: parseFloat(r.quantity),
              })),
            });
          }
          if (matches.length === 0) {
            return res.status(400).json({
              error: `items[${i}]: no ingredient named "${item.name}" for this tenant — pass "new": true (with a "unit") to create it`,
            });
          }
          row = matches[0];
        }

        const claimKey = `id:${row.id}`;
        if (claimedTargets.has(claimKey)) {
          return res
            .status(400)
            .json({ error: `items[${i}]: "${row.name}" is targeted by more than one item in this batch` });
        }
        claimedTargets.add(claimKey);

        resolved.push({
          kind: 'update',
          item_id: row.id,
          name: row.name,
          unit: row.unit,
          cost: item.cost,
          quantity: item.quantity,
          previous_cost: parseFloat(row.cost),
          previous_quantity: parseFloat(row.quantity),
        });
      }

      const summary = buildIngredientBatchSummary(resolved);
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();
      const payload = { items: resolved };

      await db.execute(
        sql`INSERT INTO alfred_confirmation_tokens (token, tenant_id, action, payload, summary, expires_at)
            VALUES (${token}, ${tenantId}::uuid, 'ingredients.batch_set', ${JSON.stringify(payload)}::jsonb, ${summary}, ${expiresAt}::timestamptz)`
      );

      return res.json({
        proposed: true,
        summary,
        confirmationToken: token,
        expires_at: expiresAt,
        changes: resolved.map((r) =>
          r.kind === 'update'
            ? {
                kind: 'update',
                item_id: r.item_id,
                name: r.name,
                unit: r.unit,
                cost: r.cost,
                previous_cost: r.previous_cost,
                quantity: r.quantity,
                previous_quantity: r.previous_quantity,
                unit_cost: Math.round(ingredientUnitCost(r.cost, r.quantity) * 10000) / 10000,
                previous_unit_cost:
                  r.previous_quantity > 0
                    ? Math.round(ingredientUnitCost(r.previous_cost, r.previous_quantity) * 10000) / 10000
                    : null,
              }
            : {
                kind: 'create',
                name: r.name,
                unit: r.unit,
                cost: r.cost,
                quantity: r.quantity,
                unit_cost: Math.round(ingredientUnitCost(r.cost, r.quantity) * 10000) / 10000,
                possible_duplicate: r.possible_duplicate,
              }
        ),
      });
    } catch (err) {
      logger.error({ err }, 'Error in POST /api/alfred/ingredients');
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

      const page = parseRangeAndPagination(req, res, { defaultLimit: 365, maxLimit: 5000 });
      if (!page) return;
      const { startDate, endDate, limit, offset } = page;

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

      query = sql`${query} ORDER BY drawer_date DESC LIMIT ${limit + 1} OFFSET ${offset}`;

      const result = await db.execute(query);
      const hasMore = result.rows.length > limit;
      const entries = hasMore ? result.rows.slice(0, limit) : result.rows;

      res.json({
        tenant_id: tenantId,
        count: entries.length,
        limit,
        offset,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        entries,
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

      const page = parseRangeAndPagination(req, res, { defaultLimit: 52, maxLimit: 1000 });
      if (!page) return;
      const { startDate, endDate, limit, offset } = page;

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
      weeksQuery = sql`${weeksQuery} ORDER BY week_key DESC LIMIT ${limit + 1} OFFSET ${offset}`;

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
      const weeksHasMore = weeksResult.rows.length > limit;
      if (weeksHasMore) weeksResult.rows.length = limit;

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
        limit,
        offset,
        has_more: weeksHasMore,
        next_offset: weeksHasMore ? offset + limit : null,
        payouts,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/tip-payouts');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/employee-hours
   * Per-employee logged hours for ALL hourly staff (tipped or not), with the
   * pay period each entry belongs to. Hours are stored per week; week_start is
   * the Monday of that week and week_end is the following Sunday.
   * Query params: tenant_id, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD) —
   * date filters apply to week_start.
   */
  app.get('/api/alfred/employee-hours', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      const page = parseRangeAndPagination(req, res, { defaultLimit: 1000, maxLimit: 10000 });
      if (!page) return;
      const { startDate, endDate, limit, offset } = page;

      let query = sql`
        SELECT to_char(teh.week_key, 'YYYY-MM-DD') AS week_start,
               to_char(teh.week_key + 6, 'YYYY-MM-DD') AS week_end,
               teh.employee_id,
               te.name AS employee_name,
               te.tip_eligible,
               te.is_active,
               teh.hours
        FROM tip_employee_hours teh
        JOIN tip_employees te ON te.id = teh.employee_id
        WHERE teh.tenant_id = ${tenantId}::uuid
      `;

      if (startDate) {
        query = sql`${query} AND teh.week_key >= ${startDate}::date`;
      }
      if (endDate) {
        query = sql`${query} AND teh.week_key <= ${endDate}::date`;
      }

      query = sql`${query} ORDER BY teh.week_key DESC, te.name LIMIT ${limit + 1} OFFSET ${offset}`;

      const result = await db.execute(query);
      const hasMore = result.rows.length > limit;
      const pageRows = hasMore ? result.rows.slice(0, limit) : result.rows;

      const entries = (pageRows as any[]).map((row) => ({
        ...row,
        hours: parseFloat(row.hours) || 0,
      }));

      res.json({
        tenant_id: tenantId,
        count: entries.length,
        limit,
        offset,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        entries,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/employee-hours');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/alfred/bulk-orders
   * Bulk Ordering module history (coffee_order_history), newest first.
   * Query params: tenant_id; vendor (optional, case-insensitive vendor name
   * filter); start_date / end_date (optional, YYYY-MM-DD, filter on order_date);
   * status (optional: draft | outstanding | received, per migration 148).
   */
  app.get('/api/alfred/bulk-orders', async (req: Request, res: Response) => {
    try {
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      const vendor = (req.query.vendor as string) || null;
      const page = parseRangeAndPagination(req, res, { defaultLimit: 200, maxLimit: 2000 });
      if (!page) return;
      const { startDate, endDate, limit, offset } = page;
      const status = (req.query.status as string) || null;
      if (status && !['draft', 'outstanding', 'received'].includes(status)) {
        return res.status(400).json({ error: 'status must be draft, outstanding, or received' });
      }

      // Real columns per migrations 008 + 132 (vendor_id) + 148 (received_at).
      // items is a JSONB map of productId -> qty; names/prices resolve via
      // tenant_coffee_products.
      let query = sql`
        SELECT coh.id,
               to_char(coh.order_date, 'YYYY-MM-DD') AS date,
               v.display_name AS vendor,
               coh.items AS items_raw,
               coh.units,
               coh.total_cost,
               coh.sent_to_vendor,
               coh.received_at
        FROM coffee_order_history coh
        LEFT JOIN tenant_coffee_vendors v ON v.id = coh.vendor_id
        WHERE coh.tenant_id = ${tenantId}::uuid
      `;

      if (status === 'draft') {
        query = sql`${query} AND coh.sent_to_vendor = false`;
      } else if (status === 'outstanding') {
        query = sql`${query} AND coh.sent_to_vendor = true AND coh.received_at IS NULL`;
      } else if (status === 'received') {
        query = sql`${query} AND coh.received_at IS NOT NULL`;
      }

      if (vendor) {
        query = sql`${query} AND v.display_name ILIKE ${'%' + vendor + '%'}`;
      }
      if (startDate) {
        query = sql`${query} AND coh.order_date >= ${startDate}::date`;
      }
      if (endDate) {
        query = sql`${query} AND coh.order_date < (${endDate}::date + 1)`;
      }

      query = sql`${query} ORDER BY coh.order_date DESC LIMIT ${limit + 1} OFFSET ${offset}`;

      const result = await db.execute(query);
      const hasMore = result.rows.length > limit;
      const rows = (hasMore ? result.rows.slice(0, limit) : result.rows) as any[];

      // Resolve product names/prices for line detail in one query.
      // NOTE: default_price is the CURRENT catalog price — line totals are
      // best-effort; the stored total_usd is authoritative for the order.
      const productIds = [
        ...new Set(
          rows.flatMap((r) => (r.items_raw && typeof r.items_raw === 'object' ? Object.keys(r.items_raw) : []))
        ),
      ].filter((id) => /^[0-9a-f-]{36}$/i.test(id));

      const productMap = new Map<string, { name: string; price: number }>();
      if (productIds.length > 0) {
        const idList = sql.join(
          productIds.map((id) => sql`${id}::uuid`),
          sql`, `
        );
        const products = await db.execute(sql`
          SELECT id, name, size, default_price FROM tenant_coffee_products
          WHERE tenant_id = ${tenantId}::uuid AND id IN (${idList})
        `);
        for (const p of products.rows as any[]) {
          productMap.set(p.id, {
            name: p.size ? `${p.name} ${p.size}` : p.name,
            price: parseFloat(p.default_price) || 0,
          });
        }
      }

      const orders = rows.map((r) => {
        const items = Object.entries((r.items_raw || {}) as Record<string, unknown>).map(([productId, qty]) => {
          const product = productMap.get(productId);
          const quantity = Number(qty) || 0;
          const unitPrice = product?.price ?? null;
          return {
            name: product?.name ?? `Unknown product (${productId})`,
            qty: quantity,
            unit_price: unitPrice,
            line_total: unitPrice != null ? Math.round(quantity * unitPrice * 100) / 100 : null,
          };
        });
        return {
          id: r.id,
          vendor: r.vendor ?? null,
          date: r.date,
          units: r.units,
          total_usd: r.total_cost != null ? parseFloat(r.total_cost) : null,
          status: r.received_at ? 'received' : r.sent_to_vendor ? 'outstanding' : 'draft',
          received_at: r.received_at,
          items,
        };
      });

      res.json({
        tenant_id: tenantId,
        count: orders.length,
        limit,
        offset,
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
        orders,
      });
    } catch (err) {
      logger.error({ err }, 'Error in /api/alfred/bulk-orders');
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
   * POST /api/alfred/overhead  — write path for operating expenses / overhead.
   *
   * Two-step, one endpoint, dispatched on body shape (same X-Alfred-Token auth):
   *  - PROPOSE: body has { category, amount, ... } and NO confirmationToken.
   *    Writes nothing. Returns a human-readable `summary` and a single-use
   *    `confirmationToken` (5-min expiry).
   *  - CONFIRM: body has { confirmationToken }. Redeems the token and writes.
   *
   * SET semantics on overhead_items {name, amount, frequency} — NOT a monthly
   * ledger. CMS stores ONE current value per line item; there is no per-month
   * history, so `effective_month` (optional) is used only in the summary text.
   * The target item is resolved by `id` (from GET /overhead) if given, else by
   * case-insensitive `category` name; a name matching several items is a 400.
   */
  app.post('/api/alfred/overhead', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;

      // ── CONFIRM ────────────────────────────────────────────────────────────
      if (typeof body.confirmationToken === 'string' && body.confirmationToken.length > 0) {
        const token = body.confirmationToken;
        const found = await db.execute(
          sql`SELECT tenant_id, payload, summary, used_at, expires_at
              FROM alfred_confirmation_tokens WHERE token = ${token} LIMIT 1`
        );
        const rec = found.rows[0] as any;
        if (!rec) return res.status(404).json({ error: 'Unknown confirmation token' });

        // The presenting service token must still be authorized for this tenant.
        (req.query as any).tenant_id = rec.tenant_id;
        const tenantId = await authorizeTenantRead(req, res);
        if (!tenantId) return;

        if (rec.used_at) return res.status(409).json({ error: 'This confirmation token has already been used' });
        if (new Date(rec.expires_at).getTime() <= Date.now()) {
          return res.status(410).json({ error: 'Confirmation token expired — re-propose to get a fresh one' });
        }

        const p = rec.payload as {
          operation: 'insert' | 'update';
          item_id: string | null;
          name: string;
          amount: number;
          frequency: string;
          previous_amount: number | null;
        };

        type ApplyResult = { status: 'ok'; item: Record<string, any> } | { status: 'race' } | { status: 'missing' };

        const applied: ApplyResult = await db.transaction(async (tx) => {
          // Atomically claim the token so a double-confirm can't write twice.
          const claim = await tx.execute(
            sql`UPDATE alfred_confirmation_tokens SET used_at = NOW()
                WHERE token = ${token} AND used_at IS NULL AND expires_at > NOW()
                RETURNING token`
          );
          if (claim.rows.length === 0) return { status: 'race' };

          if (p.operation === 'update') {
            const upd = await tx.execute(
              sql`UPDATE overhead_items
                  SET amount = ${p.amount}, frequency = ${p.frequency}, updated_at = NOW()
                  WHERE id = ${p.item_id}::uuid AND tenant_id = ${tenantId}::uuid
                  RETURNING id, name, amount, frequency`
            );
            if (upd.rows.length === 0) return { status: 'missing' };
            return { status: 'ok', item: upd.rows[0] as Record<string, any> };
          }
          const ins = await tx.execute(
            sql`INSERT INTO overhead_items (tenant_id, name, amount, frequency)
                VALUES (${tenantId}::uuid, ${p.name}, ${p.amount}, ${p.frequency})
                RETURNING id, name, amount, frequency`
          );
          return { status: 'ok', item: ins.rows[0] as Record<string, any> };
        });

        if (applied.status === 'race') {
          return res.status(409).json({ error: 'This confirmation token has already been used' });
        }
        if (applied.status === 'missing') {
          return res
            .status(409)
            .json({ error: 'The target overhead item no longer exists — re-propose to apply this change' });
        }

        // Best-effort audit trail — logAuditEvent swallows its own errors, so
        // a logging failure never surfaces as a write failure.
        await logAuditEvent(
          tenantId,
          ALFRED_SERVICE_ACTOR_ID,
          p.operation === 'update' ? 'alfred.overhead.updated' : 'alfred.overhead.created',
          'overhead_item',
          applied.item.id,
          p.operation === 'update' ? { amount: p.previous_amount } : null,
          { amount: parseFloat(applied.item.amount), frequency: applied.item.frequency },
          req.ip
        );

        return res.json({
          applied: true,
          operation: p.operation,
          summary: rec.summary,
          item: { ...applied.item, amount: parseFloat(applied.item.amount) },
        });
      }

      // ── PROPOSE ────────────────────────────────────────────────────────────
      // Opportunistic cleanup so the token table doesn't grow unbounded.
      await db.execute(sql`DELETE FROM alfred_confirmation_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`);

      (req.query as any).tenant_id = body.tenant_id ?? (req.query as any).tenant_id;
      const tenantId = await authorizeTenantRead(req, res);
      if (!tenantId) return;

      const category = typeof body.category === 'string' ? body.category.trim() : '';
      if (!category) return res.status(400).json({ error: 'category is required (the overhead line-item name)' });
      if (category.length > 100) return res.status(400).json({ error: 'category must be 100 characters or fewer' });

      const amountRaw = typeof body.amount === 'number' ? body.amount : Number(body.amount);
      if (!Number.isFinite(amountRaw) || amountRaw < 0) {
        return res.status(400).json({ error: 'amount must be a number >= 0' });
      }
      const amount = Math.round(amountRaw * 100) / 100;

      if (body.frequency !== undefined && !OVERHEAD_FREQUENCIES.includes(body.frequency as any)) {
        return res.status(400).json({ error: `frequency must be one of: ${OVERHEAD_FREQUENCIES.join(', ')}` });
      }
      const effectiveMonth = typeof body.effective_month === 'string' ? body.effective_month : null;
      if (effectiveMonth && !/^\d{4}-\d{2}$/.test(effectiveMonth)) {
        return res.status(400).json({ error: 'effective_month must be YYYY-MM' });
      }

      // Resolve the target overhead item.
      let operation: 'insert' | 'update';
      let itemId: string | null = null;
      let previousAmount: number | null = null;
      let frequency: string;

      if (typeof body.id === 'string' && body.id.length > 0) {
        const byId = await db.execute(
          sql`SELECT id, name, amount, frequency FROM overhead_items
              WHERE id = ${body.id}::uuid AND tenant_id = ${tenantId}::uuid LIMIT 1`
        );
        const row = byId.rows[0] as any;
        if (!row) return res.status(400).json({ error: `No overhead item with id ${body.id} for this tenant` });
        operation = 'update';
        itemId = row.id;
        previousAmount = parseFloat(row.amount);
        frequency = (body.frequency as string) ?? row.frequency;
      } else {
        const byName = await db.execute(
          sql`SELECT id, amount, frequency FROM overhead_items
              WHERE tenant_id = ${tenantId}::uuid AND lower(btrim(name)) = lower(${category}) ORDER BY created_at`
        );
        if (byName.rows.length > 1) {
          return res.status(400).json({
            error: `"${category}" matches ${byName.rows.length} overhead items — pass an explicit "id" to disambiguate`,
            candidates: (byName.rows as any[]).map((r) => ({
              id: r.id,
              amount: parseFloat(r.amount),
              frequency: r.frequency,
            })),
          });
        }
        if (byName.rows.length === 1) {
          const row = byName.rows[0] as any;
          operation = 'update';
          itemId = row.id;
          previousAmount = parseFloat(row.amount);
          frequency = (body.frequency as string) ?? row.frequency;
        } else {
          operation = 'insert';
          frequency = (body.frequency as string) ?? 'monthly';
        }
      }

      const monthSuffix = effectiveMonth ? ` for ${monthLabel(effectiveMonth)}` : '';
      const summary =
        operation === 'update'
          ? `Set ${category} to ${usd(amount)} (${frequency})${monthSuffix} — was ${usd(previousAmount ?? 0)}.`
          : `Add ${category} at ${usd(amount)} (${frequency})${monthSuffix}.`;

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();
      const payload = {
        operation,
        item_id: itemId,
        name: category,
        amount,
        frequency,
        previous_amount: previousAmount,
      };

      await db.execute(
        sql`INSERT INTO alfred_confirmation_tokens (token, tenant_id, action, payload, summary, expires_at)
            VALUES (${token}, ${tenantId}::uuid, 'overhead.set', ${JSON.stringify(payload)}::jsonb, ${summary}, ${expiresAt}::timestamptz)`
      );

      return res.json({
        proposed: true,
        summary,
        confirmationToken: token,
        expires_at: expiresAt,
        change: {
          operation,
          category,
          item_id: itemId,
          amount,
          previous_amount: previousAmount,
          frequency,
          effective_month: effectiveMonth,
        },
      });
    } catch (err) {
      logger.error({ err }, 'Error in POST /api/alfred/overhead');
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
