import type { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getSupabaseAdmin } from '../supabaseAdmin';
import logger from '../logger';
import {
  getUserIdFromRequest,
  getTenantIdForUser,
  requirePlatformAdmin,
  logAuditEvent,
  authRateLimit,
  ROLE_HIERARCHY,
} from './core';

export function registerAdminRoutes(app: Express): void {
  // =====================================================
  // TENANT CREATION (handles existing users)
  // =====================================================

  app.post('/api/tenants', requirePlatformAdmin, async (req, res) => {
    try {
      const { name, slug, ownerEmail, ownerName, ownerPassword } = req.body;
      if (!name || !slug || !ownerEmail) {
        return res.status(400).json({ error: 'name, slug, and ownerEmail are required' });
      }

      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // 1. Create the tenant
      const tenantResult = await db.execute(sql`
        INSERT INTO tenants (name, slug)
        VALUES (${name}, ${cleanSlug})
        RETURNING id, name, slug
      `);
      const tenant = tenantResult.rows[0] as { id: string; name: string; slug: string };

      // 2. Create tenant branding
      await db.execute(sql`
        INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, background_color, company_name)
        VALUES (${tenant.id}::uuid, '#334155', '#0F172A', '#F1F5F9', '#FFFFFF', ${name})
      `);

      // 3. Find or create user via Supabase admin API
      const supabaseAdmin = getSupabaseAdmin();
      let userId: string;

      // Try to create the user first
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword || undefined,
        email_confirm: true,
        user_metadata: { full_name: ownerName || ownerEmail.split('@')[0] },
      });

      if (newUserData?.user) {
        userId = newUserData.user.id;
      } else {
        // User likely already exists — look them up via DB (avoids listUsers pagination issues)
        const existingUser = await db.execute(sql`
          SELECT id FROM auth.users WHERE email = ${ownerEmail} LIMIT 1
        `);
        if (!existingUser.rows.length) {
          throw new Error(createError?.message || 'Could not find or create user with this email');
        }
        userId = (existingUser.rows[0] as any).id;
      }

      // 4. Create profile or assign existing user to new tenant
      // Check if user already has a profile (existing user)
      const existingProfile = await db.execute(sql`
        SELECT id, tenant_id FROM user_profiles WHERE id = ${userId}::uuid LIMIT 1
      `);

      if (existingProfile.rows.length > 0) {
        // Existing user — don't overwrite their primary profile.
        // Add a cross-tenant assignment as owner of the new tenant instead.
        await db.execute(sql`
          INSERT INTO user_tenant_assignments (user_id, tenant_id, role, is_primary, is_active)
          VALUES (${userId}::uuid, ${tenant.id}::uuid, 'owner', false, true)
          ON CONFLICT (user_id, tenant_id) DO UPDATE SET
            role = 'owner',
            is_active = true
        `);
      } else {
        // New user — create their primary profile on this tenant
        await db.execute(sql`
          INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
          VALUES (${userId}::uuid, ${tenant.id}::uuid, ${ownerEmail}, ${ownerName || ownerEmail.split('@')[0]}, 'owner', true)
        `);
      }

      res.status(201).json({ tenant, userId });
    } catch (error: any) {
      // If tenant was created but later steps failed, try to clean up
      logger.error({ err: error }, 'Tenant creation failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =====================================================
  // PLATFORM ADMIN MANAGEMENT ROUTES
  // =====================================================

  // List all platform admins
  app.get('/api/platform-admins', requirePlatformAdmin, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, email, full_name, is_active, created_at
        FROM platform_admins
        ORDER BY created_at ASC
      `);
      res.json(result.rows);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to list platform admins');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Add a new platform admin by email
  app.post('/api/platform-admins', requirePlatformAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Look up the user via DB (avoids listUsers pagination issues)
      const authUserResult = await db.execute(sql`
        SELECT id, email FROM auth.users WHERE email = ${email} LIMIT 1
      `);
      if (!authUserResult.rows.length) {
        return res.status(404).json({ error: 'No user found with that email. They must have an account first.' });
      }
      const authUser = authUserResult.rows[0] as { id: string; email: string };

      // Check if already a platform admin
      const existingResult = await db.execute(sql`
        SELECT id FROM platform_admins WHERE id = ${authUser.id}::uuid
      `);

      if (existingResult.rows.length) {
        return res.status(409).json({ error: 'This user is already a platform admin' });
      }

      // Insert into platform_admins
      const insertResult = await db.execute(sql`
        INSERT INTO platform_admins (id, email, full_name, is_active)
        VALUES (${authUser.id}::uuid, ${authUser.email}, ${req.body.full_name || null}, true)
        RETURNING id, email, full_name, is_active, created_at
      `);

      res.status(201).json(insertResult.rows[0]);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to add platform admin');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Remove a platform admin
  app.delete('/api/platform-admins/:id', requirePlatformAdmin, async (req, res) => {
    try {
      const requesterId = (req as any).userId as string;

      // Prevent removing yourself
      if (req.params.id === requesterId) {
        return res.status(400).json({ error: 'You cannot remove yourself as a platform admin' });
      }

      const result = await db.execute(sql`
        DELETE FROM platform_admins WHERE id = ${req.params.id}::uuid RETURNING *
      `);

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Platform admin not found' });
      }

      res.status(204).end();
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to remove platform admin');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =====================================================
  // USER INVITE ROUTE
  // =====================================================

  app.post('/api/users/invite', authRateLimit, async (req, res) => {
    try {
      const { email, fullName, role, tenantId, redirectTo } = req.body;

      // Authenticate via JWT (not from request body)
      const { userId: requestingUserId } = await getUserIdFromRequest(req);
      if (!requestingUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!email || !tenantId) {
        return res.status(400).json({ error: 'Email and tenantId are required' });
      }

      // M14: Validate role is one of the allowed values
      const VALID_ROLES = ['owner', 'manager', 'lead', 'employee'];
      const assignedRole = VALID_ROLES.includes(role) ? role : 'employee';

      // Verify the requesting user is an owner or manager of this tenant
      const requesterResult = await db.execute(sql`
        SELECT role FROM user_profiles
        WHERE id = ${requestingUserId}::uuid AND tenant_id = ${tenantId}::uuid AND is_active = true
        LIMIT 1
      `);
      const requesterRole = (requesterResult.rows[0] as any)?.role;
      if (!requesterRole || !['owner', 'manager'].includes(requesterRole)) {
        return res.status(403).json({ error: 'Only owners and managers can invite users' });
      }

      // H2: Role hierarchy — managers cannot invite owners; only owners can assign owner role
      if ((ROLE_HIERARCHY[assignedRole] || 0) > (ROLE_HIERARCHY[requesterRole] || 0)) {
        return res.status(403).json({ error: 'Cannot invite users with a higher role than your own' });
      }

      // M11: Validate redirectTo to prevent open redirect
      if (redirectTo) {
        try {
          const url = new URL(redirectTo);
          // Use forwarded host (Codespaces proxy) or fall back to raw host
          const trustedHost = req.get('x-forwarded-host') || req.get('host') || '';
          if (trustedHost && url.host !== trustedHost) {
            return res.status(400).json({ error: 'Invalid redirect URL' });
          }
        } catch {
          return res.status(400).json({ error: 'Invalid redirect URL' });
        }
      }

      const supabaseAdmin = getSupabaseAdmin();
      let userId: string;
      let isNewUser = false;

      // Try to invite the user (creates auth user + sends Supabase invite email)
      const inviteOptions: any = {
        data: { full_name: fullName || email.split('@')[0] },
      };
      if (redirectTo) {
        inviteOptions.redirectTo = redirectTo;
      }
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        inviteOptions
      );

      if (inviteData?.user) {
        userId = inviteData.user.id;
        isNewUser = true;
      } else {
        // User already exists in auth — look them up via DB
        const existingAuthUser = await db.execute(sql`
          SELECT id FROM auth.users WHERE email = ${email} LIMIT 1
        `);
        if (!existingAuthUser.rows.length) {
          throw new Error(inviteError?.message || 'Could not find or create user with this email');
        }
        userId = (existingAuthUser.rows[0] as any).id;

        // H1: Check if user already belongs to another tenant — prevent hijacking
        const existingProfile = await db.execute(sql`
          SELECT tenant_id FROM user_profiles WHERE id = ${userId}::uuid AND is_active = true LIMIT 1
        `);
        if (existingProfile.rows.length > 0 && (existingProfile.rows[0] as any).tenant_id !== tenantId) {
          return res.status(409).json({ error: 'This user already belongs to another organization' });
        }

        // Send password recovery email so the user can set their own password
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const anonClient = createClient(supabaseUrl, supabaseKey);
          const resetOptions: any = {};
          if (redirectTo) {
            resetOptions.redirectTo = redirectTo;
          }
          const { error: resetError } = await anonClient.auth.resetPasswordForEmail(email, resetOptions);
          if (resetError) {
            logger.warn({ err: resetError }, 'Password reset email failed');
          }
        }
      }

      // Upsert user profile — only update if user belongs to THIS tenant (prevent hijack)
      await db.execute(sql`
        INSERT INTO user_profiles (id, tenant_id, email, full_name, role, is_active)
        VALUES (${userId}::uuid, ${tenantId}::uuid, ${email}, ${fullName || email.split('@')[0]}, ${assignedRole}, true)
        ON CONFLICT (id) DO UPDATE SET
          role = ${assignedRole},
          full_name = ${fullName || email.split('@')[0]},
          is_active = true
        WHERE user_profiles.tenant_id = ${tenantId}::uuid
      `);

      res.status(201).json({ userId, email, isNewUser });
    } catch (error: any) {
      logger.error({ err: error }, 'User invite failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Deactivate / Activate User (with role hierarchy) ─────────
  app.post('/api/users/deactivate', authRateLimit, async (req, res) => {
    try {
      const { userId: targetUserId } = req.body;

      // Authenticate via JWT
      const { userId: requestingUserId } = await getUserIdFromRequest(req);
      if (!requestingUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!targetUserId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Cannot deactivate yourself
      if (requestingUserId === targetUserId) {
        return res.status(403).json({ error: 'You cannot deactivate yourself' });
      }

      // Fetch requesting user's profile
      const requesterResult = await db.execute(sql`
        SELECT role, tenant_id FROM user_profiles
        WHERE id = ${requestingUserId}::uuid AND is_active = true
        LIMIT 1
      `);
      const requester = requesterResult.rows[0] as any;
      if (!requester) {
        return res.status(403).json({ error: 'Your profile was not found or is inactive' });
      }

      // Fetch target user's profile (must be in same tenant)
      const targetResult = await db.execute(sql`
        SELECT role, is_active, tenant_id FROM user_profiles
        WHERE id = ${targetUserId}::uuid AND tenant_id = ${requester.tenant_id}::uuid
        LIMIT 1
      `);
      const target = targetResult.rows[0] as any;
      if (!target) {
        return res.status(404).json({ error: 'Target user not found in your organization' });
      }

      const requesterLevel = ROLE_HIERARCHY[requester.role] ?? -1;
      const targetLevel = ROLE_HIERARCHY[target.role] ?? -1;

      // Cannot deactivate an owner (only platform admins could, if at all)
      if (target.role === 'owner') {
        return res.status(403).json({ error: 'Owners cannot be deactivated' });
      }

      // Requesting user must outrank the target
      if (requesterLevel <= targetLevel) {
        return res.status(403).json({ error: 'You can only deactivate users with a lower role than your own' });
      }

      // Toggle is_active
      const newIsActive = !target.is_active;

      await db.execute(sql`
        UPDATE user_profiles
        SET is_active = ${newIsActive}, updated_at = NOW()
        WHERE id = ${targetUserId}::uuid AND tenant_id = ${requester.tenant_id}::uuid
      `);

      await logAuditEvent(
        requester.tenant_id,
        requestingUserId,
        newIsActive ? 'user.activated' : 'user.deactivated',
        'user',
        targetUserId,
        { is_active: target.is_active },
        { is_active: newIsActive },
        req.ip
      );

      res.json({ success: true, is_active: newIsActive });
    } catch (error: any) {
      logger.error({ err: error }, 'Deactivate user error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Change User Email (admin) ─────────────────────────────────
  app.post('/api/users/change-email', authRateLimit, async (req, res) => {
    try {
      const { targetUserId, newEmail } = req.body;

      const { userId: requestingUserId } = await getUserIdFromRequest(req);
      if (!requestingUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!targetUserId || !newEmail) {
        return res.status(400).json({ error: 'targetUserId and newEmail are required' });
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Load requester's profile
      const requesterResult = await db.execute(sql`
        SELECT role, tenant_id FROM user_profiles
        WHERE id = ${requestingUserId}::uuid AND is_active = true
        LIMIT 1
      `);
      const requester = requesterResult.rows[0] as any;
      if (!requester || !['owner', 'manager'].includes(requester.role)) {
        return res.status(403).json({ error: 'Only owners and managers can change user emails' });
      }

      // Load target user's profile — must be in same tenant
      const targetResult = await db.execute(sql`
        SELECT role, tenant_id, email FROM user_profiles
        WHERE id = ${targetUserId}::uuid AND tenant_id = ${requester.tenant_id}::uuid AND is_active = true
        LIMIT 1
      `);
      const target = targetResult.rows[0] as any;
      if (!target) {
        return res.status(404).json({ error: 'User not found in your organization' });
      }

      // Role hierarchy — cannot change email of someone with higher or equal role (unless owner)
      if (requester.role !== 'owner' && (ROLE_HIERARCHY[target.role] || 0) >= (ROLE_HIERARCHY[requester.role] || 0)) {
        return res.status(403).json({ error: 'Cannot change email of a user with equal or higher role' });
      }

      // Check if new email is already in use
      const existingUser = await db.execute(sql`
        SELECT id FROM auth.users WHERE email = ${newEmail} LIMIT 1
      `);
      if (existingUser.rows.length > 0 && (existingUser.rows[0] as any).id !== targetUserId) {
        return res.status(409).json({ error: 'This email is already in use by another account' });
      }

      // Update email in Supabase Auth
      const supabaseAdmin = getSupabaseAdmin();
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        email: newEmail,
        email_confirm: true,
      });
      if (authError) {
        return res.status(500).json({ error: `Failed to update auth email: ${authError.message}` });
      }

      // Update email in user_profiles
      await db.execute(sql`
        UPDATE user_profiles SET email = ${newEmail}, updated_at = now()
        WHERE id = ${targetUserId}::uuid AND tenant_id = ${requester.tenant_id}::uuid
      `);

      res.json({ success: true, oldEmail: target.email, newEmail });
    } catch (error: any) {
      logger.error({ err: error }, 'Change email error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // =====================================================
  // USER ROLE CHANGE ROUTE
  // =====================================================

  app.post('/api/users/change-role', authRateLimit, async (req, res) => {
    try {
      const { userId: targetUserId, newRole } = req.body;

      const { userId: requestingUserId } = await getUserIdFromRequest(req);
      if (!requestingUserId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!targetUserId || !newRole) {
        return res.status(400).json({ error: 'userId and newRole are required' });
      }

      if (ROLE_HIERARCHY[newRole] === undefined) {
        return res.status(400).json({ error: 'Invalid role. Must be one of: employee, lead, manager, owner' });
      }

      // Cannot change your own role
      if (requestingUserId === targetUserId) {
        return res.status(403).json({ error: 'Cannot change your own role' });
      }

      // Load requester's profile
      const requesterResult = await db.execute(sql`
        SELECT role, tenant_id FROM user_profiles
        WHERE id = ${requestingUserId}::uuid AND is_active = true
        LIMIT 1
      `);
      const requester = requesterResult.rows[0] as any;
      if (!requester) {
        return res.status(403).json({ error: 'Requester profile not found or inactive' });
      }

      const requesterLevel = ROLE_HIERARCHY[requester.role] ?? -1;

      // Only owners, managers, and leads can change roles
      if (!['owner', 'manager', 'lead'].includes(requester.role)) {
        return res.status(403).json({ error: 'Insufficient permissions to change user roles' });
      }

      // Load target user's profile (must be in the same tenant)
      const targetResult = await db.execute(sql`
        SELECT role, tenant_id FROM user_profiles
        WHERE id = ${targetUserId}::uuid AND tenant_id = ${requester.tenant_id}::uuid AND is_active = true
        LIMIT 1
      `);
      const target = targetResult.rows[0] as any;
      if (!target) {
        return res.status(404).json({ error: 'User not found in your organization' });
      }

      const targetCurrentLevel = ROLE_HIERARCHY[target.role] ?? -1;
      const newRoleLevel = ROLE_HIERARCHY[newRole] ?? -1;

      // Cannot change another owner's role (owners are peers)
      if (target.role === 'owner' && requester.role === 'owner') {
        return res.status(403).json({ error: "Cannot change another owner's role" });
      }

      // Requester's role must be strictly higher than the target's current role
      if (requesterLevel <= targetCurrentLevel) {
        return res
          .status(403)
          .json({ error: 'Cannot change the role of a user with equal or higher role than your own' });
      }

      // Requester's role must be strictly higher than the new role being assigned
      if (requesterLevel <= newRoleLevel) {
        return res.status(403).json({ error: 'Cannot assign a role equal to or higher than your own' });
      }

      // Perform the update via service role client
      const supabaseAdmin = getSupabaseAdmin();
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', targetUserId)
        .eq('tenant_id', requester.tenant_id);

      if (updateError) {
        throw updateError;
      }

      await logAuditEvent(
        requester.tenant_id,
        requestingUserId,
        'user.role_changed',
        'user',
        targetUserId,
        { role: target.role },
        { role: newRole },
        req.ip
      );

      res.json({ success: true, userId: targetUserId, newRole });
    } catch (error: any) {
      logger.error({ err: error }, 'Change role error');
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
