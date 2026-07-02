import type { Request } from 'express';
import crypto from 'crypto';
import { getUserIdFromRequest, getTenantIdForUser } from './routes/core';

export interface ServiceAuthResult {
  authenticated: boolean;
  isServiceToken: boolean;
  userId: string | null;
  tenantId: string | null;
  debug: string;
}

/**
 * Validates request authentication via either:
 * 1. Normal user session (Bearer JWT) - returns user's tenant context
 * 2. Service token (X-Alfred-Token header) - returns admin-equivalent read context
 *
 * Service token auth is INERT when ALFRED_SERVICE_TOKEN env var is unset.
 */
export async function getApiAuth(req: Request): Promise<ServiceAuthResult> {
  // First, check for service token auth
  const serviceToken = process.env.ALFRED_SERVICE_TOKEN;
  const providedToken = req.headers['x-alfred-token'];

  if (serviceToken && providedToken && typeof providedToken === 'string') {
    // Use timing-safe comparison to prevent timing attacks
    const serviceTokenBuffer = Buffer.from(serviceToken, 'utf8');
    const providedTokenBuffer = Buffer.from(providedToken, 'utf8');

    // Only compare if lengths match (timingSafeEqual requires same length)
    if (
      serviceTokenBuffer.length === providedTokenBuffer.length &&
      crypto.timingSafeEqual(serviceTokenBuffer, providedTokenBuffer)
    ) {
      // Service token grants read access to all tenants
      // tenantId can be specified via query param for filtering
      const requestedTenantId = req.query.tenant_id as string | undefined;
      return {
        authenticated: true,
        isServiceToken: true,
        userId: null,
        tenantId: requestedTenantId || null,
        debug: 'Service token authenticated',
      };
    }
    // Invalid token provided - reject immediately
    return {
      authenticated: false,
      isServiceToken: false,
      userId: null,
      tenantId: null,
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
      debug,
    };
  }

  const tenantId = await getTenantIdForUser(userId);
  return {
    authenticated: true,
    isServiceToken: false,
    userId,
    tenantId,
    debug: 'User session authenticated',
  };
}
