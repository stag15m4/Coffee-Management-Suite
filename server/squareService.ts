import { sql } from 'drizzle-orm';
import { db } from './db';
import {
  getSquareClient,
  getSquareAppClient,
  getSquareAppId,
  getSquareAppSecret,
} from './squareClient';
import { log } from './index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SquareTenantConfig {
  id: string;
  square_merchant_id: string | null;
  square_access_token: string | null;
  square_refresh_token: string | null;
  square_token_expires_at: string | null;
  square_location_id: string | null;
  square_sync_enabled: boolean;
  square_last_sync_at: string | null;
}

export interface SquareTeamMember {
  id: string;
  givenName?: string | null;
  familyName?: string | null;
  emailAddress?: string | null;
  status?: string | null;
}

export interface SquareLocation {
  id: string;
  name?: string;
  address?: object;
  status?: string;
}

export interface SquareTimecardBreak {
  id: string;
  startAt: string;
  endAt?: string;
  name?: string;
  isPaid: boolean;
}

export interface SquareTimecard {
  id: string;
  teamMemberId?: string | null;
  locationId?: string | null;
  startAt: string;
  endAt?: string | null;
  status?: string | null;
  breaks?: SquareTimecardBreak[];
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

export interface SuggestedMapping {
  squareTeamMemberId: string;
  squareTeamMemberName: string;
  suggestedUserProfileId: string | null;
  suggestedTipEmployeeId: string | null;
  suggestedLocalName: string | null;
  confidence: 'exact' | 'partial' | 'none';
}

export interface EmployeeMapping {
  id: string;
  tenant_id: string;
  square_team_member_id: string;
  square_team_member_name: string;
  user_profile_id: string | null;
  tip_employee_id: string | null;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SquareService {
  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    merchantId: string;
  }> {
    const client = getSquareAppClient();
    const result = await client.oAuth.obtainToken({
      clientId: getSquareAppId(),
      clientSecret: getSquareAppSecret(),
      code,
      grantType: 'authorization_code',
      redirectUri,
    });

    if (!result.accessToken || !result.refreshToken || !result.merchantId) {
      throw new Error('Incomplete OAuth response from Square');
    }

    const expiresAt = result.expiresAt
      ? new Date(result.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30 days

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt,
      merchantId: result.merchantId,
    };
  }

  async refreshAccessToken(tenantId: string): Promise<void> {
    const tenant = await this.getTenantSquareConfig(tenantId);
    if (!tenant?.square_refresh_token) {
      throw new Error('No Square refresh token for tenant');
    }

    const client = getSquareAppClient();
    const result = await client.oAuth.obtainToken({
      clientId: getSquareAppId(),
      clientSecret: getSquareAppSecret(),
      refreshToken: tenant.square_refresh_token,
      grantType: 'refresh_token',
    });

    if (!result.accessToken) {
      throw new Error('Failed to refresh Square access token');
    }

    const expiresAt = result.expiresAt
      ? new Date(result.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.execute(sql`
      UPDATE tenants SET
        square_access_token = ${result.accessToken},
        square_refresh_token = ${result.refreshToken || tenant.square_refresh_token},
        square_token_expires_at = ${expiresAt.toISOString()}::timestamptz,
        updated_at = NOW()
      WHERE id = ${tenantId}::uuid
    `);
  }

  // -------------------------------------------------------------------------
  // Tenant config
  // -------------------------------------------------------------------------

  async getTenantSquareConfig(tenantId: string): Promise<SquareTenantConfig | null> {
    const result = await db.execute(sql`
      SELECT id, square_merchant_id, square_access_token, square_refresh_token,
             square_token_expires_at, square_location_id, square_sync_enabled,
             square_last_sync_at
      FROM tenants
      WHERE id = ${tenantId}::uuid
    `);
    if (!result.rows.length) return null;
    return result.rows[0] as unknown as SquareTenantConfig;
  }

  async saveTenantSquareTokens(
    tenantId: string,
    merchantId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    await db.execute(sql`
      UPDATE tenants SET
        square_merchant_id = ${merchantId},
        square_access_token = ${accessToken},
        square_refresh_token = ${refreshToken},
        square_token_expires_at = ${expiresAt.toISOString()}::timestamptz,
        updated_at = NOW()
      WHERE id = ${tenantId}::uuid
    `);
  }

  async disconnectSquare(tenantId: string): Promise<void> {
    await db.execute(sql`
      UPDATE tenants SET
        square_merchant_id = NULL,
        square_access_token = NULL,
        square_refresh_token = NULL,
        square_token_expires_at = NULL,
        square_location_id = NULL,
        square_sync_enabled = false,
        square_last_sync_at = NULL,
        updated_at = NOW()
      WHERE id = ${tenantId}::uuid
    `);

    // Also clean up employee mappings
    await db.execute(sql`
      DELETE FROM square_employee_mappings WHERE tenant_id = ${tenantId}::uuid
    `);
  }

  async setSquareLocation(tenantId: string, locationId: string): Promise<void> {
    await db.execute(sql`
      UPDATE tenants SET
        square_location_id = ${locationId},
        updated_at = NOW()
      WHERE id = ${tenantId}::uuid
    `);
  }

  async toggleSquareSync(tenantId: string, enabled: boolean): Promise<void> {
    await db.execute(sql`
      UPDATE tenants SET
        square_sync_enabled = ${enabled},
        updated_at = NOW()
      WHERE id = ${tenantId}::uuid
    `);
  }

  // -------------------------------------------------------------------------
  // Square API calls (per-tenant)
  // -------------------------------------------------------------------------

  private async getAuthenticatedClient(tenantId: string) {
    const tenant = await this.getTenantSquareConfig(tenantId);
    if (!tenant?.square_access_token) {
      throw new Error('Square not connected for this tenant');
    }

    // Refresh token if expired or within 1 hour of expiry
    if (tenant.square_token_expires_at) {
      const expiresAt = new Date(tenant.square_token_expires_at);
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      if (expiresAt <= oneHourFromNow) {
        await this.refreshAccessToken(tenantId);
        const refreshed = await this.getTenantSquareConfig(tenantId);
        if (!refreshed?.square_access_token) {
          throw new Error('Failed to refresh Square token');
        }
        return { client: getSquareClient(refreshed.square_access_token), tenant: refreshed };
      }
    }

    return { client: getSquareClient(tenant.square_access_token), tenant };
  }

  async listLocations(tenantId: string): Promise<SquareLocation[]> {
    const { client } = await this.getAuthenticatedClient(tenantId);
    const result = await client.locations.list();
    return (result.locations || []).map((loc: any) => ({
      id: loc.id!,
      name: loc.name,
      address: loc.address,
      status: loc.status,
    }));
  }

  async listTeamMembers(tenantId: string): Promise<SquareTeamMember[]> {
    const { client, tenant } = await this.getAuthenticatedClient(tenantId);
    const members: SquareTeamMember[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.teamMembers.search({
        query: {
          filter: {
            locationIds: tenant.square_location_id ? [tenant.square_location_id] : undefined,
            status: 'ACTIVE',
          },
        },
        limit: 100,
        cursor,
      });

      for (const m of result.teamMembers || []) {
        members.push({
          id: m.id!,
          givenName: m.givenName,
          familyName: m.familyName,
          emailAddress: m.emailAddress,
          status: m.status,
        });
      }
      cursor = result.cursor;
    } while (cursor);

    return members;
  }

  async searchTimecards(
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<SquareTimecard[]> {
    const { client, tenant } = await this.getAuthenticatedClient(tenantId);

    if (!tenant.square_location_id) {
      throw new Error('Square location not configured');
    }

    const timecards: SquareTimecard[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.labor.searchTimecards({
        query: {
          filter: {
            ...(startDate && endDate
              ? {
                  workday: {
                    dateRange: { startDate, endDate },
                    matchTimecardsBy: 'START_AT',
                    defaultTimezone: 'America/Los_Angeles',
                  },
                }
              : {}),
          },
        },
        limit: 100,
        cursor,
      });

      for (const tc of result.timecards || []) {
        timecards.push({
          id: tc.id!,
          teamMemberId: tc.teamMemberId,
          locationId: tc.locationId,
          startAt: tc.startAt!,
          endAt: tc.endAt,
          status: tc.status,
          breaks: (tc.breaks || []).map((b: any) => ({
            id: b.id!,
            startAt: b.startAt!,
            endAt: b.endAt,
            name: b.name,
            isPaid: b.isPaid ?? false,
          })),
        });
      }
      cursor = result.cursor;
    } while (cursor);

    return timecards;
  }

  // -------------------------------------------------------------------------
  // Sync logic
  // -------------------------------------------------------------------------

  async syncShiftsForTenant(
    tenantId: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<SyncResult> {
    const tenant = await this.getTenantSquareConfig(tenantId);
    if (!tenant?.square_access_token || !tenant.square_location_id) {
      throw new Error('Square not fully configured for this tenant');
    }

    // Determine date range
    let startDate = options?.startDate;
    let endDate = options?.endDate;

    if (!startDate) {
      if (tenant.square_last_sync_at) {
        // Incremental: from last sync date
        const d = new Date(tenant.square_last_sync_at);
        startDate = d.toISOString().slice(0, 10);
      } else {
        // First sync: last 30 days
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().slice(0, 10);
      }
    }
    if (!endDate) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      endDate = d.toISOString().slice(0, 10);
    }

    // Fetch timecards from Square
    const timecards = await this.searchTimecards(tenantId, startDate, endDate);

    // Load confirmed employee mappings
    const mappingsResult = await db.execute(sql`
      SELECT square_team_member_id, user_profile_id, tip_employee_id, square_team_member_name
      FROM square_employee_mappings
      WHERE tenant_id = ${tenantId}::uuid AND status = 'confirmed'
    `);
    const mappings = new Map(
      (mappingsResult.rows as any[]).map((r) => [
        r.square_team_member_id,
        {
          userProfileId: r.user_profile_id,
          tipEmployeeId: r.tip_employee_id,
          name: r.square_team_member_name,
        },
      ])
    );

    const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };

    for (const tc of timecards) {
      try {
        // Skip if team member not mapped
        if (!tc.teamMemberId || !mappings.has(tc.teamMemberId)) {
          result.skipped++;
          continue;
        }

        await this.processSingleTimecard(tenantId, tc, mappings);
        result.synced++;
      } catch (err: any) {
        log(`Error syncing timecard ${tc.id}: ${err.message}`, 'square');
        result.errors++;
      }
    }

    // Update last sync timestamp
    await db.execute(sql`
      UPDATE tenants SET
        square_last_sync_at = NOW(),
        updated_at = NOW()
      WHERE id = ${tenantId}::uuid
    `);

    log(
      `Square sync for tenant ${tenantId}: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`,
      'square'
    );

    return result;
  }

  async processSingleTimecard(
    tenantId: string,
    tc: SquareTimecard,
    mappings?: Map<string, { userProfileId: string | null; tipEmployeeId: string | null; name: string }>
  ): Promise<void> {
    // Load mappings if not provided (for webhook handler)
    if (!mappings) {
      const mappingsResult = await db.execute(sql`
        SELECT square_team_member_id, user_profile_id, tip_employee_id, square_team_member_name
        FROM square_employee_mappings
        WHERE tenant_id = ${tenantId}::uuid AND status = 'confirmed'
      `);
      mappings = new Map(
        (mappingsResult.rows as any[]).map((r) => [
          r.square_team_member_id,
          {
            userProfileId: r.user_profile_id,
            tipEmployeeId: r.tip_employee_id,
            name: r.square_team_member_name,
          },
        ])
      );
    }

    if (!tc.teamMemberId || !mappings.has(tc.teamMemberId)) {
      return; // Skip unmapped
    }

    const mapping = mappings.get(tc.teamMemberId)!;

    // Upsert time_clock_entry
    const entryResult = await db.execute(sql`
      INSERT INTO time_clock_entries (
        tenant_id, employee_id, tip_employee_id, employee_name,
        clock_in, clock_out, source, external_id
      ) VALUES (
        ${tenantId}::uuid,
        ${mapping.userProfileId}::uuid,
        ${mapping.tipEmployeeId}::uuid,
        ${mapping.name},
        ${tc.startAt}::timestamptz,
        ${tc.endAt || null}::timestamptz,
        'square',
        ${tc.id}
      )
      ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
      DO UPDATE SET
        clock_in = EXCLUDED.clock_in,
        clock_out = EXCLUDED.clock_out,
        employee_name = EXCLUDED.employee_name,
        updated_at = NOW()
      RETURNING id
    `);

    const entryId = (entryResult.rows[0] as any)?.id;
    if (!entryId) return;

    // Upsert breaks
    for (const brk of tc.breaks || []) {
      await db.execute(sql`
        INSERT INTO time_clock_breaks (
          tenant_id, time_clock_entry_id, break_start, break_end,
          break_type, is_paid, external_id
        ) VALUES (
          ${tenantId}::uuid,
          ${entryId}::uuid,
          ${brk.startAt}::timestamptz,
          ${brk.endAt || null}::timestamptz,
          ${brk.name || 'break'},
          ${brk.isPaid},
          ${brk.id}
        )
        ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
        DO UPDATE SET
          break_start = EXCLUDED.break_start,
          break_end = EXCLUDED.break_end,
          is_paid = EXCLUDED.is_paid,
          break_type = EXCLUDED.break_type
      `);
    }
  }

  // -------------------------------------------------------------------------
  // Employee mapping
  // -------------------------------------------------------------------------

  async suggestEmployeeMappings(tenantId: string): Promise<SuggestedMapping[]> {
    // Fetch Square team members
    const squareMembers = await this.listTeamMembers(tenantId);

    // Load local employees
    const profilesResult = await db.execute(sql`
      SELECT id, full_name FROM user_profiles
      WHERE tenant_id = ${tenantId}::uuid AND is_active = true
    `);
    const tipResult = await db.execute(sql`
      SELECT id, name FROM tip_employees
      WHERE tenant_id = ${tenantId}::uuid AND (is_active IS NULL OR is_active = true)
    `);

    const profiles = profilesResult.rows as any[];
    const tipEmployees = tipResult.rows as any[];

    // Load existing mappings to skip already-mapped members
    const existingResult = await db.execute(sql`
      SELECT square_team_member_id FROM square_employee_mappings
      WHERE tenant_id = ${tenantId}::uuid
    `);
    const existingIds = new Set((existingResult.rows as any[]).map((r) => r.square_team_member_id));

    const suggestions: SuggestedMapping[] = [];

    for (const member of squareMembers) {
      if (existingIds.has(member.id)) continue;

      const squareName = [member.givenName, member.familyName].filter(Boolean).join(' ').trim();
      const squareNameLower = squareName.toLowerCase();

      let bestMatch: SuggestedMapping = {
        squareTeamMemberId: member.id,
        squareTeamMemberName: squareName,
        suggestedUserProfileId: null,
        suggestedTipEmployeeId: null,
        suggestedLocalName: null,
        confidence: 'none',
      };

      // Check user_profiles for exact match
      for (const p of profiles) {
        if (p.full_name?.toLowerCase() === squareNameLower) {
          bestMatch = {
            ...bestMatch,
            suggestedUserProfileId: p.id,
            suggestedLocalName: p.full_name,
            confidence: 'exact',
          };
          break;
        }
      }

      // If no exact profile match, check tip_employees
      if (bestMatch.confidence === 'none') {
        for (const t of tipEmployees) {
          if (t.name?.toLowerCase() === squareNameLower) {
            bestMatch = {
              ...bestMatch,
              suggestedTipEmployeeId: t.id,
              suggestedLocalName: t.name,
              confidence: 'exact',
            };
            break;
          }
        }
      }

      // Partial match (contains) as fallback
      if (bestMatch.confidence === 'none') {
        for (const p of profiles) {
          const localLower = p.full_name?.toLowerCase() || '';
          if (localLower.includes(squareNameLower) || squareNameLower.includes(localLower)) {
            bestMatch = {
              ...bestMatch,
              suggestedUserProfileId: p.id,
              suggestedLocalName: p.full_name,
              confidence: 'partial',
            };
            break;
          }
        }
      }

      if (bestMatch.confidence === 'none') {
        for (const t of tipEmployees) {
          const localLower = t.name?.toLowerCase() || '';
          if (localLower.includes(squareNameLower) || squareNameLower.includes(localLower)) {
            bestMatch = {
              ...bestMatch,
              suggestedTipEmployeeId: t.id,
              suggestedLocalName: t.name,
              confidence: 'partial',
            };
            break;
          }
        }
      }

      // Insert as suggested mapping
      await db.execute(sql`
        INSERT INTO square_employee_mappings (
          tenant_id, square_team_member_id, square_team_member_name,
          user_profile_id, tip_employee_id, status
        ) VALUES (
          ${tenantId}::uuid,
          ${member.id},
          ${squareName},
          ${bestMatch.suggestedUserProfileId}::uuid,
          ${bestMatch.suggestedTipEmployeeId}::uuid,
          'suggested'
        )
        ON CONFLICT (tenant_id, square_team_member_id) DO NOTHING
      `);

      suggestions.push(bestMatch);
    }

    return suggestions;
  }

  async getMappings(tenantId: string): Promise<EmployeeMapping[]> {
    const result = await db.execute(sql`
      SELECT id, tenant_id, square_team_member_id, square_team_member_name,
             user_profile_id, tip_employee_id, status, confirmed_by, confirmed_at
      FROM square_employee_mappings
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY square_team_member_name ASC
    `);
    return result.rows as unknown as EmployeeMapping[];
  }

  async confirmMapping(
    mappingId: string,
    userProfileId: string | null,
    tipEmployeeId: string | null,
    confirmedBy: string
  ): Promise<void> {
    if (!userProfileId && !tipEmployeeId) {
      throw new Error('Must provide either userProfileId or tipEmployeeId');
    }

    await db.execute(sql`
      UPDATE square_employee_mappings SET
        user_profile_id = ${userProfileId}::uuid,
        tip_employee_id = ${tipEmployeeId}::uuid,
        status = 'confirmed',
        confirmed_by = ${confirmedBy}::uuid,
        confirmed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${mappingId}::uuid
    `);
  }

  async ignoreMapping(mappingId: string): Promise<void> {
    await db.execute(sql`
      UPDATE square_employee_mappings SET
        status = 'ignored',
        updated_at = NOW()
      WHERE id = ${mappingId}::uuid
    `);
  }

  async deleteMapping(mappingId: string): Promise<void> {
    await db.execute(sql`
      DELETE FROM square_employee_mappings WHERE id = ${mappingId}::uuid
    `);
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  async getSquareStatus(tenantId: string) {
    const tenant = await this.getTenantSquareConfig(tenantId);
    if (!tenant) return null;

    const mappingStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
        COUNT(*) FILTER (WHERE status = 'suggested') AS suggested,
        COUNT(*) FILTER (WHERE status = 'ignored') AS ignored
      FROM square_employee_mappings
      WHERE tenant_id = ${tenantId}::uuid
    `);

    const stats = (mappingStats.rows[0] as any) || {};

    return {
      connected: !!tenant.square_access_token,
      merchantId: tenant.square_merchant_id,
      locationId: tenant.square_location_id,
      syncEnabled: tenant.square_sync_enabled,
      lastSyncAt: tenant.square_last_sync_at,
      mappingStats: {
        confirmed: Number(stats.confirmed || 0),
        suggested: Number(stats.suggested || 0),
        ignored: Number(stats.ignored || 0),
      },
    };
  }
}

export const squareService = new SquareService();
