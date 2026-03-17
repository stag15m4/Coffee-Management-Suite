import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// The resellerBodySchema is defined inline inside registerRoutes() in server/routes.ts
// and is not exported. We replicate the exact schema here for unit testing.
// If the source schema changes, update this replica to match.
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

/** Minimal valid reseller payload — all required fields present */
const validReseller = {
  name: 'Bean Counter Wholesale',
  contactEmail: 'sales@beancounter.com',
  contactName: 'Jane Doe',
};

describe('resellerBodySchema', () => {
  it('accepts a valid minimal payload (defaults fill in the rest)', () => {
    const result = resellerBodySchema.safeParse(validReseller);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seatsTotal).toBe(0);
      expect(result.data.discountPercent).toBe(20);
      expect(result.data.tier).toBe('authorized');
      expect(result.data.billingCycle).toBe('monthly');
      expect(result.data.cardSurchargePercent).toBe(4);
    }
  });

  it('accepts a fully populated payload', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      phone: '+1-555-0100',
      companyAddress: '123 Coffee Lane',
      seatsTotal: 50,
      revenueSharePercent: 15,
      notes: 'Gold tier partner',
      tier: 'gold',
      discountPercent: 30,
      minimumSeats: 10,
      billingCycle: 'annual',
      annualCommitment: 12000,
      wholesaleRatePerSeat: 49.99,
      cardSurchargePercent: 3.5,
    });
    expect(result.success).toBe(true);
  });

  // --- Seats validation ---

  it('rejects negative seats', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      seatsTotal: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const seatIssue = result.error.issues.find((i) => i.path.includes('seatsTotal'));
      expect(seatIssue).toBeDefined();
    }
  });

  it('rejects fractional seats', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      seatsTotal: 5.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero seats', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      seatsTotal: 0,
    });
    expect(result.success).toBe(true);
  });

  // --- Discount validation ---

  it('rejects discount greater than 100', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      discountPercent: 101,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const discountIssue = result.error.issues.find((i) => i.path.includes('discountPercent'));
      expect(discountIssue).toBeDefined();
    }
  });

  it('rejects negative discount', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      discountPercent: -5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts discount at boundary values (0 and 100)', () => {
    expect(resellerBodySchema.safeParse({ ...validReseller, discountPercent: 0 }).success).toBe(true);
    expect(resellerBodySchema.safeParse({ ...validReseller, discountPercent: 100 }).success).toBe(true);
  });

  // --- Email validation ---

  it('rejects invalid email format', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      contactEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  // --- Name validation ---

  it('rejects empty name', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty contactName', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      contactName: '',
    });
    expect(result.success).toBe(false);
  });

  // --- Tier validation ---

  it('rejects invalid tier value', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      tier: 'diamond',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid tier values', () => {
    for (const tier of ['authorized', 'silver', 'gold', 'platinum']) {
      const result = resellerBodySchema.safeParse({ ...validReseller, tier });
      expect(result.success).toBe(true);
    }
  });

  // --- Billing cycle validation ---

  it('rejects invalid billing cycle', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      billingCycle: 'weekly',
    });
    expect(result.success).toBe(false);
  });

  // --- Card surcharge validation ---

  it('rejects card surcharge over 100%', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      cardSurchargePercent: 150,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative wholesale rate', () => {
    const result = resellerBodySchema.safeParse({
      ...validReseller,
      wholesaleRatePerSeat: -10,
    });
    expect(result.success).toBe(false);
  });
});
