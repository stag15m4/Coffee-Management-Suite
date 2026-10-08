import { describe, it, expect } from 'vitest';
import { calculateActualVolumeOverhead } from '../../client/src/pages/recipe-costing/utils';

// Regression coverage for the fix to a real reported problem: "Overhead per
// Item" assumed the shop makes an item every `minutes_per_drink` minutes,
// nonstop, for its entire open time — a theoretical full-capacity rate with
// no connection to actual sales volume. At real volume (well under that
// assumed throughput), this systematically under-allocated overhead to
// every item, overstating margin. calculateActualVolumeOverhead derives the
// real rate from logged transaction counts instead.

describe('calculateActualVolumeOverhead', () => {
  it('returns null with no transaction data (falls back to theoretical)', () => {
    expect(
      calculateActualVolumeOverhead({
        avgDailyTransactions: 0,
        transactionDayCount: 0,
        itemsPerTransaction: 1,
        costPerMinute: 1.13,
        hoursPerDay: 10.5,
        assumedMinutesPerItem: 2,
      })
    ).toBeNull();
  });

  it('returns null when cost per minute is not yet known', () => {
    expect(
      calculateActualVolumeOverhead({
        avgDailyTransactions: 100,
        transactionDayCount: 30,
        itemsPerTransaction: 1,
        costPerMinute: 0,
        hoursPerDay: 10.5,
        assumedMinutesPerItem: 2,
      })
    ).toBeNull();
  });

  it('matches the real-world Coffee on Broad numbers (Sept 2026 pace)', () => {
    // $1.13/min, 10.5h/day open, ~113.2 transactions/day (Sept), 1 item/txn (conservative).
    const result = calculateActualVolumeOverhead({
      avgDailyTransactions: 113.2,
      transactionDayCount: 26,
      itemsPerTransaction: 1,
      costPerMinute: 1.13,
      hoursPerDay: 10.5,
      assumedMinutesPerItem: 2,
    });
    expect(result).not.toBeNull();
    // 630 min open / 113.2 txns ≈ 5.57 true min/item
    expect(result!.trueMinutesPerItem).toBeCloseTo(5.57, 1);
    // $1.13 x 5.57 ≈ $6.30/item — far above the theoretical $2.26 (1.13 x 2)
    expect(result!.trueOverheadPerItem).toBeCloseTo(6.3, 1);
    // scalingFactor x theoretical $2.26 should reproduce the true figure
    const theoreticalPerItem = 1.13 * 2;
    expect(theoreticalPerItem * result!.scalingFactor).toBeCloseTo(result!.trueOverheadPerItem, 5);
  });

  it('a bigger average ticket (more items per transaction) lowers true overhead per item', () => {
    const oneItemPerTicket = calculateActualVolumeOverhead({
      avgDailyTransactions: 107.7,
      transactionDayCount: 80,
      itemsPerTransaction: 1,
      costPerMinute: 1.13,
      hoursPerDay: 10.5,
      assumedMinutesPerItem: 2,
    })!;
    const biggerTickets = calculateActualVolumeOverhead({
      avgDailyTransactions: 107.7,
      transactionDayCount: 80,
      itemsPerTransaction: 1.34,
      costPerMinute: 1.13,
      hoursPerDay: 10.5,
      assumedMinutesPerItem: 2,
    })!;
    expect(biggerTickets.trueOverheadPerItem).toBeLessThan(oneItemPerTicket.trueOverheadPerItem);
  });

  it('scaling the theoretical overhead rate by scalingFactor is exact, not just close, for any recipe prep time', () => {
    const result = calculateActualVolumeOverhead({
      avgDailyTransactions: 50,
      transactionDayCount: 10,
      itemsPerTransaction: 1,
      costPerMinute: 2,
      hoursPerDay: 8,
      assumedMinutesPerItem: 3,
    })!;
    // A recipe with its own 5-minute prep time should scale the same way as the 3-minute default.
    const theoreticalFiveMinRecipe = 2 * 5;
    const rescaled = theoreticalFiveMinRecipe * result.scalingFactor;
    // True rate for a 5-minute-prep recipe = costPerMinute * (trueMinutesPerItem/assumedMinutesPerItem) * 5
    const expected = 2 * (result.trueMinutesPerItem / 3) * 5;
    expect(rescaled).toBeCloseTo(expected, 10);
  });
});
