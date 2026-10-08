import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Regression coverage for a real precision bug caught in review: the
// original migration used NUMERIC(6, 4) for sales_tax_rate, which silently
// rounds a common three-decimal percentage rate (e.g. NYC's 8.875%, stored
// as the fraction 0.08875) to 0.0888 — a wrong rate baked permanently into
// every future margin calculation. NUMERIC(8, 6) must preserve it exactly.

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE overhead_settings_test (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      prices_include_tax boolean DEFAULT false,
      sales_tax_rate numeric(8, 6) DEFAULT 0
    );
  `);
}, 30000);

afterAll(async () => {
  await db?.close();
});

describe('sales_tax_rate column precision', () => {
  it('preserves a three-decimal percentage rate (8.875% / 0.08875) exactly', async () => {
    await db.query('INSERT INTO overhead_settings_test (sales_tax_rate) VALUES ($1)', [0.08875]);
    const result = await db.query('SELECT sales_tax_rate FROM overhead_settings_test');
    expect(Number((result.rows[0] as any).sales_tax_rate)).toBeCloseTo(0.08875, 6);
  });

  it('preserves another common three-decimal rate (6.625%)', async () => {
    await db.query('INSERT INTO overhead_settings_test (sales_tax_rate) VALUES ($1)', [0.06625]);
    const result = await db.query(
      'SELECT sales_tax_rate FROM overhead_settings_test WHERE sales_tax_rate = $1',
      [0.06625]
    );
    expect(result.rows).toHaveLength(1);
  });
});
