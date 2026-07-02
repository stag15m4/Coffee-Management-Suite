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
 * Resolves which tenant a service-token request may access.
 * - Empty allowlist → forbidden (fail closed; token grants nothing).
 * - Requested tenant not in allowlist → forbidden.
 * - No tenant requested + exactly one allowed → defaults to it.
 * - No tenant requested + several allowed → tenantId null (caller returns 400).
 */
export function resolveServiceTenant(requestedTenantId: unknown, allowedTenantIds: string[]): TenantScopeResult {
  if (allowedTenantIds.length === 0) {
    return { tenantId: null, forbidden: true };
  }
  if (typeof requestedTenantId === 'string' && requestedTenantId.length > 0) {
    return allowedTenantIds.includes(requestedTenantId)
      ? { tenantId: requestedTenantId, forbidden: false }
      : { tenantId: null, forbidden: true };
  }
  if (allowedTenantIds.length === 1) {
    return { tenantId: allowedTenantIds[0], forbidden: false };
  }
  return { tenantId: null, forbidden: false };
}
