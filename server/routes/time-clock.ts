import type { Express } from 'express';
import { z } from 'zod';
import logger from '../logger';
import { ClockEntryNotOpenError, closeClockEntry } from '../timeClockService';
import { getUserIdFromRequest } from './core';

const clockOutRequest = z.object({
  tenantId: z.string().uuid(),
  entryId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export function registerTimeClockRoutes(app: Express): void {
  app.post('/api/time-clock/clock-out', async (req, res) => {
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const input = clockOutRequest.safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: 'Invalid tenant or clock entry' });

    try {
      const row = await closeClockEntry(input.data.tenantId, userId, input.data.entryId, false, input.data.notes);
      return res.json({ id: row.id, clock_out: row.clock_out });
    } catch (error) {
      if (error instanceof ClockEntryNotOpenError) {
        return res.status(409).json({ error: 'This shift has already ended or is not yours. Refresh and try again.' });
      }
      logger.error({ err: error, userId }, 'Clock out failed');
      return res.status(500).json({ error: 'Failed to clock out' });
    }
  });
}
