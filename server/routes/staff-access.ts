import type { Express, Request } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { getSupabaseAdmin } from '../supabaseAdmin';
import logger from '../logger';
import { getUserIdFromRequest, getTrustedBaseUrl, authRateLimit, logAuditEvent } from './core';
import { STAFF_LOGIN_PATTERN, staffAuthEmail } from '../../shared/staff-login';

const requestSchema = z.object({
  tenantId: z.string().uuid(),
  action: z.enum(['create', 'link', 'setup']),
  fullName: z.string().trim().min(1).max(100).optional(),
  loginId: z.string().trim().toLowerCase().regex(STAFF_LOGIN_PATTERN).optional(),
  tipEmployeeId: z.string().uuid().optional(),
  profileId: z.string().uuid().optional(),
});
async function setupLink(req: Request, email: string) {
  const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${getTrustedBaseUrl(req).replace(/\/$/, '')}/reset-password` },
  });
  if (error || !data.properties?.action_link)
    throw new Error('Could not generate a setup link. Use Staff access to try again.');
  return data.properties.action_link;
}
export function registerStaffAccessRoutes(app: Express) {
  app.post('/api/staff-access', authRateLimit, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    let createdId: string | undefined;
    let committed = false;
    try {
      const { userId } = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const input = requestSchema.parse(req.body);
      const actorResult = await db.execute(
        sql`SELECT role FROM user_profiles WHERE id=${userId}::uuid AND tenant_id=${input.tenantId}::uuid AND is_active=true`
      );
      const actor = actorResult.rows[0] as { role: string } | undefined;
      if (!actor || !['owner', 'manager'].includes(actor.role))
        return res.status(403).json({ error: 'Manager access required for this location' });
      if (input.action === 'link') {
        if (!input.tipEmployeeId || !input.profileId)
          return res.status(400).json({ error: 'Select both the roster employee and their account' });
        await db.execute(
          sql`SELECT link_staff_identity(${userId}::uuid,${input.tenantId}::uuid,${input.tipEmployeeId}::uuid,${input.profileId}::uuid)`
        );
        return res.json({ linked: true });
      }
      // Fail before account creation if the trusted app URL is not configured.
      getTrustedBaseUrl(req);
      if (input.action === 'setup') {
        if (!input.profileId) return res.status(400).json({ error: 'Select an account' });
        const result = await db.execute(
          sql`SELECT email,staff_login_id,role FROM user_profiles WHERE id=${input.profileId}::uuid AND tenant_id=${input.tenantId}::uuid AND is_active=true AND staff_login_id IS NOT NULL`
        );
        const target = result.rows[0] as { email: string; staff_login_id: string; role: string } | undefined;
        if (!target) return res.status(404).json({ error: 'Active staff-ID account not found in this location' });
        if (actor.role !== 'owner' && target.role !== 'employee')
          return res.status(403).json({ error: 'Only the owner can reset a privileged account' });
        const link = await setupLink(req, target.email);
        await logAuditEvent(
          input.tenantId,
          userId,
          'staff_setup_link',
          'user',
          input.profileId,
          null,
          { staffLoginId: target.staff_login_id },
          req.ip
        );
        return res.json({ profileId: input.profileId, loginId: target.staff_login_id, setupLink: link });
      }
      if (!input.fullName || !input.loginId)
        return res.status(400).json({ error: 'Full name and staff ID are required' });
      if (input.tipEmployeeId) {
        const tip = await db.execute(
          sql`SELECT id FROM tip_employees WHERE id=${input.tipEmployeeId}::uuid AND tenant_id=${input.tenantId}::uuid AND user_profile_id IS NULL`
        );
        if (!tip.rows.length)
          return res.status(409).json({ error: 'That roster person is missing or already linked. Refresh the list.' });
      }
      const email = staffAuthEmail(input.loginId);
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: `Aa1!${randomBytes(32).toString('base64url')}`,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      });
      if (error || !data.user)
        return res
          .status(409)
          .json({ error: 'Could not create this staff ID. It may already be in use; choose another ID.' });
      createdId = data.user.id;
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`INSERT INTO user_profiles(id,tenant_id,email,full_name,role,is_active,staff_login_id) VALUES(${createdId}::uuid,${input.tenantId}::uuid,${email},${input.fullName},'employee',true,${input.loginId})`
        );
        if (input.tipEmployeeId)
          await tx.execute(
            sql`SELECT link_staff_identity(${userId}::uuid,${input.tenantId}::uuid,${input.tipEmployeeId}::uuid,${createdId}::uuid)`
          );
      });
      committed = true;
      await logAuditEvent(
        input.tenantId,
        userId,
        'staff_account_created',
        'user',
        createdId,
        null,
        { staffLoginId: input.loginId, tipEmployeeId: input.tipEmployeeId ?? null },
        req.ip
      );
      let link: string | null = null;
      try {
        link = await setupLink(req, email);
      } catch {
        /* Account is saved; do not delete linked history if link generation fails. */
      }
      return res.status(201).json({
        profileId: createdId,
        loginId: input.loginId,
        setupLink: link,
        message: link ? undefined : 'Account saved. Select it under Staff access and generate a setup link.',
      });
    } catch (error) {
      if (createdId && !committed) {
        try {
          const cleanup = await getSupabaseAdmin().auth.admin.deleteUser(createdId);
          if (cleanup.error) throw cleanup.error;
        } catch {
          logger.error({ userId: createdId }, 'Staff provisioning cleanup failed; orphan auth account needs review');
        }
      }
      if (error instanceof z.ZodError)
        return res.status(400).json({ error: 'Check the staff ID and selected employee details' });
      // Never log setup URLs, credentials, or auth response payloads.
      logger.error({ code: (error as { code?: string })?.code }, 'Staff access operation failed');
      const message =
        (error as { cause?: { message?: string } })?.cause?.message ||
        (error instanceof Error ? error.message : 'Could not update staff access');
      const safe =
        /already linked|already has a roster|Overlapping work sessions|history belongs|Roster employee not found|Active account not found|Only the owner|Manager access|APP_URL/.test(
          message
        );
      return res.status(400).json({
        error: safe ? message : 'Could not update staff access. Check the selected identities and try again.',
      });
    }
  });
}
