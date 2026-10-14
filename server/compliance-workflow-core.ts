import crypto from 'crypto';
import { z } from 'zod';
export const workflowCommand = z.object({
  version: z.literal(1),
  event_id: z.string().uuid(),
  obligation_id: z.string().uuid(),
  parent_obligation_id: z.string().uuid().nullable().optional(),
  revision: z.number().int().positive(),
  action: z.enum(['bind', 'verify']),
  tenant_id: z.string().uuid(),
  record_id: z.string().uuid(),
  expected_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  owner_name: z.string().min(1).max(200),
  assignee_id: z.string().uuid().nullable(),
  evidence_requirements: z.string().min(3).max(4000),
});
export function complianceFingerprint(row: {
  title: string;
  due_date: string;
  notes?: string | null;
  recurrence?: string | null;
}) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([row.title, row.due_date, row.notes || '', row.recurrence || 'none']))
    .digest('hex');
}
export function complianceRenewalDate(value: string, interval: string) {
  const date = new Date(value + 'T00:00:00Z');
  if (interval === 'daily' || interval === 'weekly') {
    date.setUTCDate(date.getUTCDate() + (interval === 'daily' ? 1 : 7));
    return date.toISOString().slice(0, 10);
  }
  const months = ({ monthly: 1, quarterly: 3, yearly: 12 } as Record<string, number>)[interval];
  if (!months) throw new Error('Invalid recurrence');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
  return date.toISOString().slice(0, 10);
}
