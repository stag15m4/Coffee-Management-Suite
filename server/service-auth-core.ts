/**
 * Pure service-token auth logic — no DB or env imports so it's unit-testable.
 * Used by service-auth.ts (which wires in the user-session fallback).
 */
import crypto from 'crypto';

/** Timing-safe comparison of a provided token against the expected secret. */
export function timingSafeTokenMatch(provided: unknown, expected: string | undefined): boolean {
  if (!expected || typeof provided !== 'string' || provided.length === 0) return false;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  // timingSafeEqual requires equal lengths; length check itself leaks nothing useful
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/** Parses ALFRED_ALLOWED_TENANT_IDS (comma-separated UUIDs) into a clean list. */
export function parseAllowedTenantIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface TenantScopeResult {
  tenantId: string | null;
  /** True when a tenant was requested (or required) that the token does not own. */
  forbidden: boolean;
}

/**
 * Sentinels a caller may send to mean "resolve the tenant for me" rather than
 * naming a specific one. Treated identically to omitting tenant_id: the request
 * defaults to the sole allowed tenant, or (when several are allowed) gets a 400
 * asking for an explicit id — never a 403.
 */
const AUTO_TENANT_SENTINELS = new Set(['auto', 'default', 'me', 'self', 'none', 'null', 'undefined']);

/**
 * Resolves which tenant a service-token request may access.
 * - Empty allowlist → forbidden (fail closed; token grants nothing).
 * - Requested tenant not in allowlist → forbidden.
 * - No tenant requested (omitted or an auto-sentinel) + exactly one allowed → defaults to it.
 * - No tenant requested + several allowed → tenantId null (caller returns 400).
 */
export function resolveServiceTenant(requestedTenantId: unknown, allowedTenantIds: string[]): TenantScopeResult {
  if (allowedTenantIds.length === 0) {
    return { tenantId: null, forbidden: true };
  }
  const requested =
    typeof requestedTenantId === 'string' && !AUTO_TENANT_SENTINELS.has(requestedTenantId.trim().toLowerCase())
      ? requestedTenantId.trim()
      : '';
  if (requested.length > 0) {
    return allowedTenantIds.includes(requested)
      ? { tenantId: requested, forbidden: false }
      : { tenantId: null, forbidden: true };
  }
  if (allowedTenantIds.length === 1) {
    return { tenantId: allowedTenantIds[0], forbidden: false };
  }
  return { tenantId: null, forbidden: false };
}
