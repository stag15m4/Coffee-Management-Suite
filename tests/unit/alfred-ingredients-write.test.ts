import { describe, it, expect, beforeAll } from 'vitest';

// alfred.ts transitively imports server/db.ts, which requires DATABASE_URL
// at module load. None of the functions under test touch the DB.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
// registerAlfredRoutes() itself no-ops without this, but importing the
// module for its pure exports doesn't call that function.

let validateIngredientBatchItem: typeof import('../../server/routes/alfred').validateIngredientBatchItem;
let formatIngredientChangeLine: typeof import('../../server/routes/alfred').formatIngredientChangeLine;
let formatIngredientUpdateLine: typeof import('../../server/routes/alfred').formatIngredientUpdateLine;
let formatIngredientCreateLine: typeof import('../../server/routes/alfred').formatIngredientCreateLine;
let buildIngredientBatchSummary: typeof import('../../server/routes/alfred').buildIngredientBatchSummary;
let isLikelyDuplicateIngredientName: typeof import('../../server/routes/alfred').isLikelyDuplicateIngredientName;

beforeAll(async () => {
  ({
    validateIngredientBatchItem,
    formatIngredientChangeLine,
    formatIngredientUpdateLine,
    formatIngredientCreateLine,
    buildIngredientBatchSummary,
    isLikelyDuplicateIngredientName,
  } = await import('../../server/routes/alfred'));
});

describe('validateIngredientBatchItem — update items', () => {
  it('accepts a valid item identified by name', () => {
    const result = validateIngredientBatchItem({ name: 'Whole Milk', cost: 4.25, quantity: 1 }, 0);
    expect(result).toEqual({
      ok: true,
      value: { id: null, name: 'Whole Milk', unit: null, cost: 4.25, quantity: 1, isNew: false },
    });
  });

  it('accepts a valid item identified by id, trimming the name if also present', () => {
    const result = validateIngredientBatchItem({ id: 'abc-123', name: '  Oat Milk  ', cost: 54, quantity: 6 }, 0);
    expect(result).toEqual({
      ok: true,
      value: { id: 'abc-123', name: 'Oat Milk', unit: null, cost: 54, quantity: 6, isNew: false },
    });
  });

  it('rounds cost to cents', () => {
    const result = validateIngredientBatchItem({ name: 'Beans', cost: 8.4019999, quantity: 5 }, 0);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.cost).toBeCloseTo(8.4, 5);
  });

  it('rejects a non-object item', () => {
    expect(validateIngredientBatchItem(null, 2).ok).toBe(false);
    expect(validateIngredientBatchItem('Milk', 2).ok).toBe(false);
    expect(validateIngredientBatchItem(['Milk'], 2)).toEqual({ ok: false, error: 'items[2] must be an object' });
  });

  it('rejects an item with neither id nor name', () => {
    const result = validateIngredientBatchItem({ cost: 5, quantity: 1 }, 3);
    expect(result).toEqual({
      ok: false,
      error: 'items[3] needs an "id" or a "name" to identify the ingredient',
    });
  });

  it('rejects a name over 200 characters', () => {
    const result = validateIngredientBatchItem({ name: 'x'.repeat(201), cost: 1, quantity: 1 }, 0);
    expect(result.ok).toBe(false);
  });

  it('rejects a negative or non-numeric cost', () => {
    expect(validateIngredientBatchItem({ name: 'Milk', cost: -1, quantity: 1 }, 0).ok).toBe(false);
    expect(validateIngredientBatchItem({ name: 'Milk', cost: 'a lot', quantity: 1 }, 0).ok).toBe(false);
  });

  it('accepts zero cost (e.g. a free sample line)', () => {
    expect(validateIngredientBatchItem({ name: 'Milk', cost: 0, quantity: 1 }, 0).ok).toBe(true);
  });

  it('rejects quantity <= 0 — it is the divisor for unit cost', () => {
    expect(validateIngredientBatchItem({ name: 'Milk', cost: 5, quantity: 0 }, 0).ok).toBe(false);
    expect(validateIngredientBatchItem({ name: 'Milk', cost: 5, quantity: -2 }, 0).ok).toBe(false);
  });

  it('rejects a non-numeric quantity', () => {
    expect(validateIngredientBatchItem({ name: 'Milk', cost: 5, quantity: 'a case' }, 0).ok).toBe(false);
  });

  it('rejects "unit" on a non-new item — unit is immutable through this endpoint', () => {
    const result = validateIngredientBatchItem({ name: 'Milk', unit: 'gal', cost: 5, quantity: 1 }, 0);
    expect(result).toEqual({
      ok: false,
      error:
        'items[0]: "unit" is only accepted when "new" is true — unit can\'t be changed on an existing ingredient here',
    });
  });
});

describe('validateIngredientBatchItem — new (create) items', () => {
  it('accepts a valid new item with name, unit, cost, quantity', () => {
    const result = validateIngredientBatchItem(
      { new: true, name: 'Vanilla Syrup', unit: 'bottle', cost: 12, quantity: 1 },
      0
    );
    expect(result).toEqual({
      ok: true,
      value: { id: null, name: 'Vanilla Syrup', unit: 'bottle', cost: 12, quantity: 1, isNew: true },
    });
  });

  it('rejects a new item that also specifies "id"', () => {
    const result = validateIngredientBatchItem(
      { new: true, id: 'abc-123', name: 'Vanilla Syrup', unit: 'bottle', cost: 12, quantity: 1 },
      0
    );
    expect(result).toEqual({ ok: false, error: `items[0]: a new ingredient can't also specify "id"` });
  });

  it('rejects a new item with no name', () => {
    const result = validateIngredientBatchItem({ new: true, unit: 'bottle', cost: 12, quantity: 1 }, 0);
    expect(result).toEqual({ ok: false, error: 'items[0]: a new ingredient needs a "name"' });
  });

  it('rejects a new item with no unit', () => {
    const result = validateIngredientBatchItem({ new: true, name: 'Vanilla Syrup', cost: 12, quantity: 1 }, 0);
    expect(result).toEqual({
      ok: false,
      error: 'items[0]: a new ingredient needs a "unit" (e.g. "lb", "oz", "each")',
    });
  });

  it('rejects a blank unit', () => {
    const result = validateIngredientBatchItem(
      { new: true, name: 'Vanilla Syrup', unit: '   ', cost: 12, quantity: 1 },
      0
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a unit over 20 characters', () => {
    const result = validateIngredientBatchItem(
      { new: true, name: 'Vanilla Syrup', unit: 'x'.repeat(21), cost: 12, quantity: 1 },
      0
    );
    expect(result.ok).toBe(false);
  });
});

describe('formatIngredientUpdateLine', () => {
  it('shows the resulting $/unit on both sides when only cost changes', () => {
    const line = formatIngredientUpdateLine({
      kind: 'update',
      item_id: 'i1',
      name: 'Espresso Beans',
      unit: 'lb',
      previous_cost: 42,
      previous_quantity: 5,
      cost: 45,
      quantity: 5,
    });
    expect(line).toBe('Espresso Beans: $42.00 → $45.00 for 5 lb ($8.40/lb → $9.00/lb)');
  });

  it('shows both old and new quantity when the package size also changed', () => {
    const unchanged = formatIngredientUpdateLine({
      kind: 'update',
      item_id: 'i1',
      name: 'Oat Milk',
      unit: 'unit',
      previous_cost: 48,
      previous_quantity: 6,
      cost: 54,
      quantity: 6,
    });
    expect(unchanged).toContain('for 6 unit (');
    expect(unchanged).not.toContain('→ 6 unit');

    const changedQty = formatIngredientUpdateLine({
      kind: 'update',
      item_id: 'i1',
      name: 'Oat Milk',
      unit: 'unit',
      previous_cost: 48,
      previous_quantity: 6,
      cost: 40,
      quantity: 4,
    });
    expect(changedQty).toContain('for 6 → 4 unit (');
  });

  // The exact failure mode this endpoint exists to prevent: a distributor
  // invoice's case price gets entered as the new `cost` without updating
  // `quantity` to match — the raw price looks like a sane increase, but the
  // unit cost (what recipe margins actually use) silently jumps 6x.
  it('surfaces a large unit-cost jump even when the raw price change looks modest', () => {
    const line = formatIngredientUpdateLine({
      kind: 'update',
      item_id: 'i1',
      name: 'Oat Milk',
      unit: 'carton',
      previous_cost: 8,
      previous_quantity: 1,
      cost: 48, // a 6-carton case price entered without updating quantity
      quantity: 1,
    });
    expect(line).toBe('Oat Milk: $8.00 → $48.00 for 1 carton ($8.00/carton → $48.00/carton)');
  });
});

describe('formatIngredientCreateLine', () => {
  it('shows name, price, and unit cost with no duplicate warning', () => {
    const line = formatIngredientCreateLine({
      kind: 'create',
      name: 'Vanilla Syrup',
      unit: 'bottle',
      cost: 12,
      quantity: 1,
      possible_duplicate: null,
    });
    expect(line).toBe('Vanilla Syrup (NEW): $12.00 for 1 bottle ($12.00/bottle)');
  });

  it('appends a possible-duplicate warning right in the line', () => {
    const line = formatIngredientCreateLine({
      kind: 'create',
      name: 'Oat Milk (Case)',
      unit: 'case',
      cost: 48,
      quantity: 1,
      possible_duplicate: { id: 'i1', name: 'Oat Milk' },
    });
    expect(line).toContain('possible duplicate of existing "Oat Milk"');
  });
});

describe('formatIngredientChangeLine (dispatcher)', () => {
  it('dispatches update and create kinds to the right formatter', () => {
    const updateLine = formatIngredientChangeLine({
      kind: 'update',
      item_id: 'i1',
      name: 'Milk',
      unit: 'gal',
      previous_cost: 4,
      previous_quantity: 1,
      cost: 4.25,
      quantity: 1,
    });
    expect(updateLine).toContain('Milk: $4.00 → $4.25');

    const createLine = formatIngredientChangeLine({
      kind: 'create',
      name: 'Vanilla Syrup',
      unit: 'bottle',
      cost: 12,
      quantity: 1,
      possible_duplicate: null,
    });
    expect(createLine).toContain('Vanilla Syrup (NEW)');
  });
});

describe('buildIngredientBatchSummary', () => {
  it('pluralizes the header correctly for one update', () => {
    const summary = buildIngredientBatchSummary([
      {
        kind: 'update',
        item_id: 'i1',
        name: 'Milk',
        unit: 'gal',
        previous_cost: 4,
        previous_quantity: 1,
        cost: 4.25,
        quantity: 1,
      },
    ]);
    expect(summary.split('\n')[0]).toBe('Update 1 ingredient:');
  });

  it('lists every item, one bullet per line', () => {
    const summary = buildIngredientBatchSummary([
      {
        kind: 'update',
        item_id: 'i1',
        name: 'Milk',
        unit: 'gal',
        previous_cost: 4,
        previous_quantity: 1,
        cost: 4.25,
        quantity: 1,
      },
      {
        kind: 'update',
        item_id: 'i2',
        name: 'Beans',
        unit: 'lb',
        previous_cost: 42,
        previous_quantity: 5,
        cost: 45,
        quantity: 5,
      },
    ]);
    const lines = summary.split('\n');
    expect(lines[0]).toBe('Update 2 ingredients:');
    expect(lines[1]).toContain('Milk:');
    expect(lines[2]).toContain('Beans:');
  });

  it('mixes updates and creates in one header, in submitted order', () => {
    const summary = buildIngredientBatchSummary([
      {
        kind: 'update',
        item_id: 'i1',
        name: 'Milk',
        unit: 'gal',
        previous_cost: 4,
        previous_quantity: 1,
        cost: 4.25,
        quantity: 1,
      },
      { kind: 'create', name: 'Vanilla Syrup', unit: 'bottle', cost: 12, quantity: 1, possible_duplicate: null },
    ]);
    const lines = summary.split('\n');
    expect(lines[0]).toBe('Update 1 ingredient and add 1 new ingredient:');
    expect(lines[1]).toContain('Milk:');
    expect(lines[2]).toContain('Vanilla Syrup (NEW)');
  });

  it('headers a create-only batch without mentioning updates', () => {
    const summary = buildIngredientBatchSummary([
      { kind: 'create', name: 'A', unit: 'each', cost: 1, quantity: 1, possible_duplicate: null },
      { kind: 'create', name: 'B', unit: 'each', cost: 2, quantity: 1, possible_duplicate: null },
    ]);
    expect(summary.split('\n')[0]).toBe('Add 2 new ingredients:');
  });
});

describe('isLikelyDuplicateIngredientName', () => {
  it('flags an exact match after case/whitespace normalization', () => {
    expect(isLikelyDuplicateIngredientName('Oat Milk', '  oat   milk ')).toBe(true);
  });

  it('flags a suffixed variant of an existing name', () => {
    expect(isLikelyDuplicateIngredientName('Oat Milk (Case)', 'Oat Milk')).toBe(true);
  });

  it('flags a small typo', () => {
    expect(isLikelyDuplicateIngredientName('Esspresso Beans', 'Espresso Beans')).toBe(true);
  });

  it('does not flag genuinely different short products', () => {
    // Same length, edit distance 2 — the whole reason the threshold scales
    // with length rather than using a flat distance-2 cutoff.
    expect(isLikelyDuplicateIngredientName('Milk', 'Malt')).toBe(false);
  });

  it('does not flag genuinely different longer products', () => {
    expect(isLikelyDuplicateIngredientName('Espresso Beans', 'Chai Concentrate')).toBe(false);
  });
});
