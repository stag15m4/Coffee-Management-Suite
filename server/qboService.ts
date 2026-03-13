/**
 * QuickBooks Online integration service.
 * Handles OAuth2 flow, token management, and data sync (CoA + P&L actuals).
 */

import OAuthClient from 'intuit-oauth';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getSupabaseAdmin } from './supabaseAdmin';
import { encrypt, decrypt, isEncrypted } from './crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getOAuthClient(): OAuthClient {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('QBO_CLIENT_ID, QBO_CLIENT_SECRET, and QBO_REDIRECT_URI must be set');
  }

  return new OAuthClient({
    clientId,
    clientSecret,
    environment: process.env.QBO_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
    redirectUri,
  });
}

// ---------------------------------------------------------------------------
// OAuth Flow
// ---------------------------------------------------------------------------

export function getQboAuthUrl(stateToken: string): string {
  const oauthClient = getOAuthClient();
  return oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: stateToken,
  });
}

export async function exchangeQboCode(url: string): Promise<{
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const oauthClient = getOAuthClient();
  const authResponse = await oauthClient.createToken(url);
  const token = authResponse.getJson();

  return {
    realmId: token.realmId || new URL(url, 'http://localhost').searchParams.get('realmId') || '',
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
  };
}

// ---------------------------------------------------------------------------
// Token Storage
// ---------------------------------------------------------------------------

export async function saveQboTokens(
  tenantId: string,
  realmId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
): Promise<void> {
  // AES-256-GCM encrypt sensitive fields at rest (Intuit requirement)
  const encryptedRealmId = encrypt(realmId);
  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = encrypt(refreshToken);

  await db.execute(sql`
    UPDATE tenants SET
      qbo_realm_id = ${encryptedRealmId},
      qbo_access_token = ${encryptedAccessToken},
      qbo_refresh_token = ${encryptedRefreshToken},
      qbo_token_expires_at = ${expiresAt.toISOString()}::timestamptz,
      qbo_connected_at = COALESCE(qbo_connected_at, NOW())
    WHERE id = ${tenantId}::uuid
  `);
}

export async function getQboConfig(tenantId: string): Promise<{
  realmId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
} | null> {
  const result = await db.execute(sql`
    SELECT qbo_realm_id, qbo_access_token, qbo_refresh_token,
           qbo_token_expires_at, qbo_connected_at, qbo_last_sync_at
    FROM tenants WHERE id = ${tenantId}::uuid
  `);
  const row = result.rows[0] as any;
  if (!row) return null;

  // Decrypt tokens — handles both encrypted and legacy plaintext values
  const decryptField = (val: string | null): string | null => {
    if (!val) return null;
    if (isEncrypted(val)) return decrypt(val);
    return val; // legacy plaintext — will be re-encrypted on next token save/refresh
  };

  return {
    realmId: decryptField(row.qbo_realm_id),
    accessToken: decryptField(row.qbo_access_token),
    refreshToken: decryptField(row.qbo_refresh_token),
    expiresAt: row.qbo_token_expires_at,
    connectedAt: row.qbo_connected_at,
    lastSyncAt: row.qbo_last_sync_at,
  };
}

export async function disconnectQbo(tenantId: string): Promise<void> {
  const config = await getQboConfig(tenantId);
  // Try to revoke the token
  if (config?.accessToken) {
    try {
      const oauthClient = getOAuthClient();
      oauthClient.setToken({
        access_token: config.accessToken,
        refresh_token: config.refreshToken || '',
        token_type: 'bearer',
        expires_in: 3600,
      });
      await oauthClient.revoke({ token: config.accessToken });
    } catch (err) {
      // Best-effort revocation — proceed with disconnect regardless
      console.warn('[qbo] Token revocation failed:', (err as Error).message);
    }
  }

  await db.execute(sql`
    UPDATE tenants SET
      qbo_realm_id = NULL,
      qbo_access_token = NULL,
      qbo_refresh_token = NULL,
      qbo_token_expires_at = NULL,
      qbo_connected_at = NULL,
      qbo_last_sync_at = NULL
    WHERE id = ${tenantId}::uuid
  `);
}

// ---------------------------------------------------------------------------
// Token Refresh
// ---------------------------------------------------------------------------

async function getValidToken(tenantId: string): Promise<{ accessToken: string; realmId: string }> {
  const config = await getQboConfig(tenantId);
  if (!config?.accessToken || !config.refreshToken || !config.realmId) {
    throw new Error('QuickBooks is not connected');
  }

  // Refresh if token expires within 5 minutes
  const expiresAt = config.expiresAt ? new Date(config.expiresAt).getTime() : 0;
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const oauthClient = getOAuthClient();
    oauthClient.setToken({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      token_type: 'bearer',
      expires_in: 0,
    });
    const refreshResponse = await oauthClient.refresh();
    const token = refreshResponse.getJson();

    const newExpires = new Date(Date.now() + token.expires_in * 1000);
    await saveQboTokens(tenantId, config.realmId, token.access_token, token.refresh_token, newExpires);

    return { accessToken: token.access_token, realmId: config.realmId };
  }

  return { accessToken: config.accessToken, realmId: config.realmId };
}

// ---------------------------------------------------------------------------
// QBO API Helpers
// ---------------------------------------------------------------------------

async function qboApiCall(tenantId: string, endpoint: string): Promise<any> {
  const { accessToken, realmId } = await getValidToken(tenantId);
  const baseUrl = process.env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

  const url = `${baseUrl}/v3/company/${realmId}/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QBO API ${response.status}: ${text}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Sync: Chart of Accounts
// ---------------------------------------------------------------------------

interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  AcctNum?: string;
  SubAccount: boolean;
  ParentRef?: { value: string; name: string };
  Active: boolean;
}

function mapQboAccountType(qboType: string): string {
  const t = qboType.toLowerCase();
  if (t.includes('income') || t.includes('revenue')) return 'Revenue';
  if (t.includes('cost of goods') || t === 'cogs') return 'COGS';
  if (t.includes('expense')) return 'Expense';
  return 'Other';
}

export async function syncChartOfAccounts(tenantId: string): Promise<{
  imported: number;
  updated: number;
  skipped: number;
}> {
  const data = await qboApiCall(tenantId, "query?query=SELECT * FROM Account MAXRESULTS 1000");
  const accounts: QboAccount[] = data?.QueryResponse?.Account || [];

  const supabaseAdmin = getSupabaseAdmin();
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  // Build QBO ID → our ID map for parent resolution
  const qboIdToOurId = new Map<string, string>();

  // Snapshot hidden accounts before replacing so we can re-apply the flag
  const { data: existingAccounts } = await supabaseAdmin
    .from('budget_chart_of_accounts')
    .select('name, account_number, is_active')
    .eq('tenant_id', tenantId);

  const hiddenKeys = new Set<string>();
  for (const row of existingAccounts || []) {
    if (!row.is_active) {
      // Key by account_number if available, otherwise by name
      hiddenKeys.add(row.account_number || row.name);
    }
  }

  // Clear existing accounts and replace with fresh QBO data
  await supabaseAdmin
    .from('budget_chart_of_accounts')
    .delete()
    .eq('tenant_id', tenantId);

  // Sort so parents come before children
  const sorted = accounts.sort((a, b) => (a.SubAccount ? 1 : 0) - (b.SubAccount ? 1 : 0));

  for (const acc of sorted) {
    if (!acc.Active) {
      skipped++;
      continue;
    }

    const accountType = mapQboAccountType(acc.AccountType);
    const parentId = acc.ParentRef ? qboIdToOurId.get(acc.ParentRef.value) || null : null;
    const depth = acc.SubAccount && parentId ? 1 : 0;

    // Preserve hidden state: if user previously hid this account, keep it hidden
    const wasHidden = hiddenKeys.has(acc.AcctNum || acc.Name);

    const { data: inserted, error } = await supabaseAdmin
      .from('budget_chart_of_accounts')
      .insert({
        tenant_id: tenantId,
        name: acc.Name,
        account_number: acc.AcctNum || null,
        account_type: accountType,
        detail_type: acc.AccountSubType || null,
        parent_id: parentId,
        depth,
        display_order: parseInt(acc.Id) || 0,
        is_active: !wasHidden,
      })
      .select('id')
      .single();

    if (inserted) {
      qboIdToOurId.set(acc.Id, inserted.id);
      imported++;
    } else {
      skipped++;
    }
  }

  return { imported, updated, skipped };
}

// ---------------------------------------------------------------------------
// Sync: P&L Actuals
// ---------------------------------------------------------------------------

export async function syncActuals(
  tenantId: string,
  fiscalYearId: string,
  year: number,
): Promise<{ synced: number; errors: string[] }> {
  const supabaseAdmin = getSupabaseAdmin();
  let synced = 0;
  const errors: string[] = [];

  // Fetch our CoA to map QBO account names to our account IDs
  const { data: ourAccounts } = await supabaseAdmin
    .from('budget_chart_of_accounts')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const accountByName = new Map<string, string>();
  for (const a of ourAccounts || []) {
    accountByName.set(a.name.toLowerCase(), a.id);
  }

  // Fetch P&L for each month
  const monthFetches = [];
  for (let month = 1; month <= 12; month++) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    monthFetches.push(
      qboApiCall(tenantId, `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&summarize_column_by=Total`)
        .then((data) => ({ month, data }))
        .catch((err) => {
          errors.push(`Month ${month}: ${err.message}`);
          return { month, data: null };
        })
    );
  }

  const results = await Promise.all(monthFetches);

  // Parse P&L rows and upsert actuals
  for (const { month, data } of results) {
    if (!data) continue;

    const rows = extractPnLRows(data);
    const upserts: Array<{
      tenant_id: string;
      fiscal_year_id: string;
      account_id: string;
      month: number;
      actual_amount: number;
    }> = [];

    for (const row of rows) {
      const accountId = accountByName.get(row.name.toLowerCase());
      if (!accountId) continue;

      upserts.push({
        tenant_id: tenantId,
        fiscal_year_id: fiscalYearId,
        account_id: accountId,
        month,
        actual_amount: row.amount,
      });
    }

    if (upserts.length > 0) {
      // Upsert each — update actual_amount only
      for (const item of upserts) {
        const { error } = await supabaseAdmin
          .from('budget_line_items')
          .upsert(
            { ...item, budget_amount: 0, updated_at: new Date().toISOString() },
            { onConflict: 'tenant_id,fiscal_year_id,account_id,month' }
          );

        if (error) {
          // If row exists, just update the actual_amount
          await supabaseAdmin
            .from('budget_line_items')
            .update({ actual_amount: item.actual_amount, updated_at: new Date().toISOString() })
            .eq('tenant_id', item.tenant_id)
            .eq('fiscal_year_id', item.fiscal_year_id)
            .eq('account_id', item.account_id)
            .eq('month', item.month);
        }
        synced++;
      }
    }
  }

  // Update last sync timestamp
  await db.execute(sql`
    UPDATE tenants SET qbo_last_sync_at = NOW() WHERE id = ${tenantId}::uuid
  `);

  return { synced, errors };
}

// ---------------------------------------------------------------------------
// P&L Report Parser
// ---------------------------------------------------------------------------

interface PnLRow {
  name: string;
  amount: number;
}

function extractPnLRows(reportData: any): PnLRow[] {
  const rows: PnLRow[] = [];

  function walkRows(rowGroup: any) {
    if (!rowGroup?.Row) return;
    for (const row of rowGroup.Row) {
      if (row.type === 'Data' && row.ColData) {
        const name = row.ColData[0]?.value;
        const amount = parseFloat(row.ColData[1]?.value) || 0;
        if (name && amount !== 0) {
          rows.push({ name, amount: Math.abs(amount) });
        }
      }
      // Recurse into sections (Income, COGS, Expenses, etc.)
      if (row.Rows) {
        walkRows(row.Rows);
      }
    }
  }

  if (reportData?.Rows) {
    walkRows(reportData.Rows);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function getQboStatus(tenantId: string): Promise<{
  connected: boolean;
  realmId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
}> {
  const config = await getQboConfig(tenantId);
  return {
    connected: !!(config?.accessToken && config?.realmId),
    realmId: config?.realmId || null,
    connectedAt: config?.connectedAt || null,
    lastSyncAt: config?.lastSyncAt || null,
  };
}
