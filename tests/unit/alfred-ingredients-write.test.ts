import { describe, it, expect, beforeAll } from 'vitest';

// alfred.ts transitively imports server/db.ts, which requires DATABASE_URL
// at module load. None of the functions under test touch the DB.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
// registerAlfredRoutes() itself no-ops without this, but importing the
// module for its pure exports doesn't call that function.

let validateIngredientBatchItem: typeof import('../../server/routes/alfred').validateIngredientBatchItem;
let formatIngredientChangeLine: typeof import('../../server/routes/alfred').formatIngredientChangeLine;
let buildIngredientBatchSummary: typeof import('../../server/routes/alfred').buildIngredientBatchSummary;

beforeAll(async () => {
  ({ validateIngredientBatchItem, formatIngredientChangeLine, buildIngredientBatchSummary } =
    await import('../../server/routes/alfred'));
});

describe('validateIngredientBatchItem', () => {
  it('accepts a valid item identified by name', () => {
    const result = validateIngredientBatchItem({ name: 'Whole Milk', cost: 4.25, quantity: 1 }, 0);
    expect(result).toEqual({ ok: true, value: { id: null, name: 'Whole Milk', cost: 4.25, quantity: 1 } });
  });

  it('accepts a valid item identified by id, trimming the name if also present', () => {
    const result = validateIngredientBatchItem({ id: 'abc-123', name: '  Oat Milk  ', cost: 54, quantity: 6 }, 0);
    expect(result).toEqual({ ok: true, value: { id: 'abc-123', name: 'Oat Milk', cost: 54, quantity: 6 } });
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
});

describe('formatIngredientChangeLine', () => {
  it('shows the resulting $/unit on both sides when only cost changes', () => {
    const line = formatIngredientChangeLine({
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
    const line = formatIngredientChangeLine({
      name: 'Oat Milk',
      unit: 'unit',
      previous_cost: 48,
      previous_quantity: 6,
      cost: 54,
      quantity: 6,
    });
    expect(line).toContain('for 6 unit (');
    expect(line).not.toContain('→ 6 unit');

    const changedQty = formatIngredientChangeLine({
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
    const line = formatIngredientChangeLine({
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

describe('buildIngredientBatchSummary', () => {
  it('pluralizes the header correctly for one item', () => {
    const summary = buildIngredientBatchSummary([
      { name: 'Milk', unit: 'gal', previous_cost: 4, previous_quantity: 1, cost: 4.25, quantity: 1 },
    ]);
    expect(summary.split('\n')[0]).toBe('Update 1 ingredient:');
  });

  it('lists every item, one bullet per line', () => {
    const summary = buildIngredientBatchSummary([
      { name: 'Milk', unit: 'gal', previous_cost: 4, previous_quantity: 1, cost: 4.25, quantity: 1 },
      { name: 'Beans', unit: 'lb', previous_cost: 42, previous_quantity: 5, cost: 45, quantity: 5 },
    ]);
    const lines = summary.split('\n');
    expect(lines[0]).toBe('Update 2 ingredients:');
    expect(lines[1]).toContain('Milk:');
    expect(lines[2]).toContain('Beans:');
  });
});
