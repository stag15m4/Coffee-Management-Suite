import { describe, it, expect } from 'vitest';
import { getNetSalePrice } from '../../client/src/pages/recipe-costing/utils';

// Regression coverage for tax-inclusive menu pricing: when a tenant's Sale
// Price already has sales tax baked in (a round menu-board price like
// $5.00), margin/profit must be computed on the tax-excluded portion, not
// the full price — the tax collected is owed to the state, not earned.

describe('getNetSalePrice', () => {
  it('returns the raw price unchanged when the setting is off', () => {
    expect(getNetSalePrice(5.0, { prices_include_tax: false, sales_tax_rate: 0.0825 })).toBe(5.0);
  });

  it('returns the raw price unchanged when overhead is null', () => {
    expect(getNetSalePrice(5.0, null)).toBe(5.0);
  });

  it('returns the raw price unchanged when the rate is 0, even if the toggle is on', () => {
    expect(getNetSalePrice(5.0, { prices_include_tax: true, sales_tax_rate: 0 })).toBe(5.0);
  });

  it('backs the tax out of the price when the setting is on with a real rate', () => {
    // $5.00 at 8.25% tax-inclusive -> $5.00 / 1.0825 ≈ $4.6189
    const net = getNetSalePrice(5.0, { prices_include_tax: true, sales_tax_rate: 0.0825 });
    expect(net).toBeCloseTo(4.6189, 4);
  });

  it('round-trips: net price plus its own tax equals the original price', () => {
    const rate = 0.0825;
    const raw = 6.5;
    const net = getNetSalePrice(raw, { prices_include_tax: true, sales_tax_rate: rate });
    expect(net * (1 + rate)).toBeCloseTo(raw, 10);
  });
});
