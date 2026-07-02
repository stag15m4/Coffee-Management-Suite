import type { Request } from 'express';
import { getUserIdFromRequest, getTenantIdForUser } from './routes/core';
import { timingSafeTokenMatch, parseAllowedTenantIds, resolveServiceTenant } from './service-auth-core';

export interface ServiceAuthResult {
  authenticated: boolean;
  isServiceToken: boolean;
  userId: string | null;
  tenantId: string | null;
  /** Tenants the service token may read (null for user-session auth). */
  allowedTenantIds: string[] | null;
  /** True when a tenant_id was requested that this credential does not own → respond 403. */
  tenantForbidden: boolean;
  debug: string;
}

/**
 * Validates request authentication via either:
 * 1. Normal user session (Bearer JWT) - returns user's tenant context
 * 2. Service token (X-Alfred-Token header) - read access scoped to
 *    ALFRED_ALLOWED_TENANT_IDS (comma-separated tenant UUIDs)
 *
 * Fail-closed properties:
 * - Inert when ALFRED_SERVICE_TOKEN is unset.
 * - A valid token with no ALFRED_ALLOWED_TENANT_IDS grants nothing.
 * - A tenant_id outside the allowlist sets tenantForbidden (handlers return 403).
 */
export async function getApiAuth(req: Request): Promise<ServiceAuthResult> {
  const serviceToken = process.env.ALFRED_SERVICE_TOKEN;
  const providedToken = req.headers['x-alfred-token'];

  if (serviceToken && providedToken !== undefined) {
    if (timingSafeTokenMatch(providedToken, serviceToken)) {
      const allowedTenantIds = parseAllowedTenantIds(process.env.ALFRED_ALLOWED_TENANT_IDS);
      const scope = resolveServiceTenant(req.query.tenant_id, allowedTenantIds);

      if (allowedTenantIds.length === 0) {
        // Token is valid but unscoped — fail closed rather than grant global reads
        return {
          authenticated: false,
          isServiceToken: true,
          userId: null,
          tenantId: null,
          allowedTenantIds: [],
          tenantForbidden: true,
          debug: 'Service token valid but ALFRED_ALLOWED_TENANT_IDS is not configured',
        };
      }

      return {
        authenticated: true,
        isServiceToken: true,
        userId: null,
        tenantId: scope.tenantId,
        allowedTenantIds,
        tenantForbidden: scope.forbidden,
        debug: scope.forbidden ? 'Service token not authorized for requested tenant' : 'Service token authenticated',
      };
    }
    // A token header was presented but didn't match — reject, don't fall through to session auth
    return {
      authenticated: false,
      isServiceToken: false,
      userId: null,
      tenantId: null,
      allowedTenantIds: null,
      tenantForbidden: false,
      debug: 'Invalid service token',
    };
  }

  // Fall back to normal user session auth
  const { userId, debug } = await getUserIdFromRequest(req);
  if (!userId) {
    return {
      authenticated: false,
      isServiceToken: false,
      userId: null,
      tenantId: null,
      allowedTenantIds: null,
      tenantForbidden: false,
      debug,
    };
  }

  const tenantId = await getTenantIdForUser(userId);
  return {
    authenticated: true,
    isServiceToken: false,
    userId,
    tenantId,
    allowedTenantIds: null,
    tenantForbidden: false,
    debug: 'User session authenticated',
  };
}
