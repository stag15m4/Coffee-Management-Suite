import { describe, expect, it } from 'vitest';
import { squareSyncRequestSchema } from '../../server/squareSyncRequest';

describe('Square manual sync request', () => {
  it.each([undefined, {}])('accepts the Sync Now request %j without overriding service defaults', (body) => {
    expect(squareSyncRequestSchema.parse(body)).toEqual({});
  });

  it('preserves an explicit valid date range', () => {
    const range = { startDate: '2026-10-01', endDate: '2026-10-24' };
    expect(squareSyncRequestSchema.parse(range)).toEqual(range);
  });

  it.each([
    { startDate: '2026-10-01' },
    { endDate: '2026-10-24' },
    { startDate: '2026-10-24', endDate: '2026-10-01' },
    { startDate: 'not-a-date', endDate: '2026-10-24' },
    { startDate: '2026-99-99', endDate: '2026-10-24' },
    null,
  ])('rejects invalid explicit ranges %j', (body) => {
    expect(squareSyncRequestSchema.safeParse(body).success).toBe(false);
  });
});
