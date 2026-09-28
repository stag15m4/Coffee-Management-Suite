import { describe, it, expect } from 'vitest';
import { compareProductByNameThenSize, sortOrderItemEntries } from '../../shared/coffeeOrderSort';

describe('compareProductByNameThenSize', () => {
  it('sorts by product name first', () => {
    const items = [
      { name: 'House Blend', size: '12oz' },
      { name: 'Espresso Blend', size: '12oz' },
    ];
    expect([...items].sort(compareProductByNameThenSize).map((i) => i.name)).toEqual(['Espresso Blend', 'House Blend']);
  });

  it('is case-insensitive on product name', () => {
    const items = [
      { name: 'house blend', size: '12oz' },
      { name: 'Espresso Blend', size: '12oz' },
    ];
    expect([...items].sort(compareProductByNameThenSize).map((i) => i.name)).toEqual(['Espresso Blend', 'house blend']);
  });

  // The reason this can't be a plain string/numeric-string sort: "2lb"
  // sorts before "12oz" as a leading number (2 < 12), but a 12oz bag is
  // actually the smaller one (12oz vs 32oz). Weight-aware comparison is
  // what makes "sorted by size" mean anything for production.
  it('sorts oz/lb sizes by actual weight, not by leading digit', () => {
    const items = [
      { name: 'Espresso Blend', size: '5lb' },
      { name: 'Espresso Blend', size: '12oz' },
      { name: 'Espresso Blend', size: '2lb' },
    ];
    expect([...items].sort(compareProductByNameThenSize).map((i) => i.size)).toEqual(['12oz', '2lb', '5lb']);
  });

  it('sorts same-unit sizes numerically, not lexically', () => {
    const items = [
      { name: 'Cold Brew', size: '12oz' },
      { name: 'Cold Brew', size: '9oz' },
    ];
    expect([...items].sort(compareProductByNameThenSize).map((i) => i.size)).toEqual(['9oz', '12oz']);
  });

  it('accepts whitespace and plural/singular unit variants', () => {
    const items = [
      { name: 'Espresso Blend', size: '2 lbs' },
      { name: 'Espresso Blend', size: '12 oz' },
      { name: 'Espresso Blend', size: '1 pound' },
    ];
    expect([...items].sort(compareProductByNameThenSize).map((i) => i.size)).toEqual(['12 oz', '1 pound', '2 lbs']);
  });

  it('groups every size of one product together before moving to the next product', () => {
    const items = [
      { name: 'House Blend', size: '5lb' },
      { name: 'Espresso Blend', size: '2lb' },
      { name: 'House Blend', size: '12oz' },
      { name: 'Espresso Blend', size: '12oz' },
    ];
    const sorted = [...items].sort(compareProductByNameThenSize).map((i) => `${i.name} ${i.size}`);
    expect(sorted).toEqual(['Espresso Blend 12oz', 'Espresso Blend 2lb', 'House Blend 12oz', 'House Blend 5lb']);
  });

  it('falls back to string comparison for a size with no recognized weight unit', () => {
    const items = [
      { name: 'Merch', size: 'Large' },
      { name: 'Merch', size: 'Small' },
    ];
    expect([...items].sort(compareProductByNameThenSize).map((i) => i.size)).toEqual(['Large', 'Small']);
  });

  it('falls back to string comparison when only one side parses as a weight', () => {
    // Mixed catalog: one line item uses a real weight, the other a free-text
    // label ("unit", "each", etc). Must not throw or silently drop either.
    const items = [
      { name: 'Filters', size: 'unit' },
      { name: 'Filters', size: '5lb' },
    ];
    const result = [...items].sort(compareProductByNameThenSize);
    expect(result).toHaveLength(2);
    expect(new Set(result.map((i) => i.size))).toEqual(new Set(['unit', '5lb']));
  });
});

describe('sortOrderItemEntries', () => {
  const catalog = [
    { id: 'p1', name: 'House Blend', size: '5lb' },
    { id: 'p2', name: 'Espresso Blend', size: '12oz' },
    { id: 'p3', name: 'House Blend', size: '12oz' },
  ];

  it('resolves productId -> qty entries and sorts by product then size', () => {
    const result = sortOrderItemEntries({ p1: 3, p2: 5, p3: 2 }, catalog);
    // qty travels with its id
    expect(result).toEqual([
      ['p2', 5],
      ['p3', 2],
      ['p1', 3],
    ]);
  });

  it('sorts an unmatched (deleted) product id last, as "Unknown"', () => {
    const result = sortOrderItemEntries({ p1: 3, deleted: 9, p2: 5 }, catalog);
    expect(result.map(([id]) => id)).toEqual(['p2', 'p1', 'deleted']);
  });

  it('groups multiple unmatched ids together at the end without erroring', () => {
    const result = sortOrderItemEntries({ gone1: 1, p2: 5, gone2: 2 }, catalog);
    expect(result[0][0]).toBe('p2');
    expect(new Set(result.slice(1).map(([id]) => id))).toEqual(new Set(['gone1', 'gone2']));
  });

  it('returns an empty array for an empty items record', () => {
    expect(sortOrderItemEntries({}, catalog)).toEqual([]);
  });
});
