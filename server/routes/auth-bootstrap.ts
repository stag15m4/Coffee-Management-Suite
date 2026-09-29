import type { Express, Request, Response } from 'express';
import logger from '../logger';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { getUserIdFromRequest } from './core';

export function registerAuthBootstrapRoutes(app: Express): void {
  app.get('/api/auth/bootstrap', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const { userId } = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const admin = getSupabaseAdmin();
    const profileResult = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (profileResult.error) {
      logger.error({ err: profileResult.error, userId }, 'Auth bootstrap profile lookup failed');
      return res.status(502).json({ error: 'Profile unavailable' });
    }

    if (!profileResult.data) {
      const adminResult = await admin
        .from('platform_admins')
        .select('*')
        .eq('id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (adminResult.error) {
        logger.error({ err: adminResult.error, userId }, 'Auth bootstrap admin lookup failed');
        return res.status(502).json({ error: 'Admin profile unavailable' });
      }

      if (!adminResult.data) {
        return res.status(403).json({ error: 'No active profile' });
      }

      return res.json({
        profile: null,
        platformAdmin: adminResult.data,
        durationMs: Date.now() - startedAt,
      });
    }

    const profile = profileResult.data;
    const primaryTenantId = profile.tenant_id as string;
    const isOwner = profile.role === 'owner';

    const [tenantResult, childResult, assignmentsResult] = await Promise.all([
      admin.from('tenants').select('*').eq('id', primaryTenantId).eq('is_active', true).maybeSingle(),
      isOwner
        ? admin.from('tenants').select('*').eq('parent_tenant_id', primaryTenantId).eq('is_active', true).order('name')
        : Promise.resolve({ data: [], error: null }),
      admin
        .from('user_tenant_assignments')
        .select('tenant:tenants!inner(*)')
        .eq('user_id', userId)
        .eq('is_active', true),
    ]);

    const scopeError = tenantResult.error || childResult.error || assignmentsResult.error;
    if (scopeError || !tenantResult.data) {
      logger.error({ err: scopeError, userId, primaryTenantId }, 'Auth bootstrap tenant scope lookup failed');
      return res.status(502).json({ error: 'Tenant scope unavailable' });
    }

    const primaryTenant = tenantResult.data;
    const locations = [primaryTenant, ...(childResult.data || [])];

    for (const assignment of assignmentsResult.data || []) {
      const assignedTenant = assignment.tenant as unknown as {
        id: string;
        is_active?: boolean;
      };

      if (assignedTenant?.is_active && !locations.some((location) => location.id === assignedTenant.id)) {
        locations.push(assignedTenant as typeof primaryTenant);
      }
    }

    const requestedLocationId = typeof req.query.locationId === 'string' ? req.query.locationId : null;
    const activeTenant = locations.find((location) => location.id === requestedLocationId) || primaryTenant;
    const activeTenantId = activeTenant.id as string;

    const [brandingResult, modulesResult, roleSettingsResult] = await Promise.all([
      admin.from('tenant_branding').select('*').eq('tenant_id', activeTenantId).maybeSingle(),
      admin.rpc('get_tenant_enabled_modules', { p_tenant_id: activeTenantId }),
      admin.from('tenant_role_settings').select('*').eq('tenant_id', activeTenantId).order('role'),
    ]);

    if (modulesResult.error) {
      logger.error({ err: modulesResult.error, activeTenantId }, 'Auth bootstrap module lookup failed');
      return res.status(502).json({ error: 'Module access unavailable' });
    }

    if (brandingResult.error) {
      logger.warn({ err: brandingResult.error, activeTenantId }, 'Auth bootstrap branding unavailable');
    }

    if (roleSettingsResult.error) {
      logger.warn({ err: roleSettingsResult.error, activeTenantId }, 'Auth bootstrap role settings unavailable');
    }

    return res.json({
      profile,
      platformAdmin: null,
      primaryTenant,
      tenant: activeTenant,
      accessibleLocations: locations,
      activeLocationId: activeTenantId,
      isParentTenant: isOwner && (childResult.data?.length || 0) > 0,
      branding: brandingResult.data || null,
      enabledModules: modulesResult.data || [],
      roleSettings: roleSettingsResult.data || null,
      durationMs: Date.now() - startedAt,
    });
  });
}
