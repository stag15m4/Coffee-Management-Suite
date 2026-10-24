import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/, 'Invalid date format');

// Sync Now sends no body. Let the service use its incremental/backfill
// defaults, while still validating explicit date ranges from other callers.
export const squareSyncRequestSchema = z
  .object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .default({})
  .refine((d) => (d.startDate === undefined) === (d.endDate === undefined), {
    message: 'Provide both startDate and endDate, or neither',
  })
  .refine((d) => !d.startDate || !d.endDate || new Date(d.startDate) <= new Date(d.endDate), {
    message: 'startDate must not be after endDate',
  });
