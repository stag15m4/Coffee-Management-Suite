import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';
import { colors } from '@/lib/colors';
import { Clock, RefreshCw, Unplug } from 'lucide-react';

interface Status {
  connected: boolean;
  timeClockId: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  mappingCounts: Record<string, number>;
}

interface MappingRow {
  connecteam_user_id: string;
  connecteam_user_name: string;
  status: 'suggested' | 'confirmed' | 'ignored';
  tip_employee_id: string | null;
  suggested_tip_employee_id: string | null;
}

interface TipEmployeeOption {
  id: string;
  name: string;
  tip_eligible: boolean | null;
}

const UNMAPPED = '__unmapped__';

async function api(path: string, options?: RequestInit): Promise<any> {
  const { getAuthHeaders } = await import('@/lib/api-helpers');
  const authHeaders = await getAuthHeaders();
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...(options?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export default function ConnecteamIntegrationSettings() {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const tenantId = tenant?.id;

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [timeClocks, setTimeClocks] = useState<Array<{ id: string; name: string }>>([]);
  const [mappings, setMappings] = useState<MappingRow[] | null>(null);
  const [tipEmployees, setTipEmployees] = useState<TipEmployeeOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!tenantId) return;
    try {
      setStatus(await api(`/api/connecteam/status/${tenantId}`));
    } catch (err) {
      console.error('Connecteam status error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    if (!tenantId || !apiKey.trim()) return;
    setConnecting(true);
    try {
      const result = await api('/api/connecteam/connect', {
        method: 'POST',
        body: JSON.stringify({ tenantId, apiKey: apiKey.trim() }),
      });
      setTimeClocks(result.timeClocks || []);
      setApiKey('');
      toast({ title: 'Connecteam connected' });
      await loadStatus();
    } catch (err) {
      toast({ title: 'Connection failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleConfig = async (config: { timeClockId?: string; syncEnabled?: boolean }) => {
    if (!tenantId) return;
    try {
      await api('/api/connecteam/config', { method: 'POST', body: JSON.stringify({ tenantId, ...config }) });
      await loadStatus();
    } catch (err) {
      toast({ title: 'Could not save setting', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const handleDisconnect = async () => {
    if (!tenantId) return;
    if (!window.confirm('Disconnect Connecteam? Synced hours stay in CMS; syncing stops.')) return;
    try {
      await api('/api/connecteam/disconnect', { method: 'POST', body: JSON.stringify({ tenantId }) });
      setMappings(null);
      setLastSyncSummary(null);
      toast({ title: 'Connecteam disconnected' });
      await loadStatus();
    } catch (err) {
      toast({ title: 'Disconnect failed', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  const loadUsers = async () => {
    if (!tenantId) return;
    setLoadingUsers(true);
    try {
      const result = await api(`/api/connecteam/users/${tenantId}`);
      setTipEmployees(result.tip_employees || []);
      setMappings(
        (result.users || []).map((u: MappingRow) => ({
          ...u,
          tip_employee_id: u.tip_employee_id ?? u.suggested_tip_employee_id,
          status: u.tip_employee_id || u.suggested_tip_employee_id ? u.status : 'ignored',
        }))
      );
    } catch (err) {
      toast({ title: 'Could not load Connecteam users', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const saveMappings = async () => {
    if (!tenantId || !mappings) return;
    setSavingMappings(true);
    try {
      const payload = mappings.map((m) => ({
        connecteam_user_id: m.connecteam_user_id,
        connecteam_user_name: m.connecteam_user_name,
        tip_employee_id: m.tip_employee_id,
        status: m.tip_employee_id ? ('confirmed' as const) : ('ignored' as const),
      }));
      await api('/api/connecteam/mappings', { method: 'POST', body: JSON.stringify({ tenantId, mappings: payload }) });
      toast({ title: 'Mappings saved' });
      setMappings(null);
      await loadStatus();
    } catch (err) {
      toast({ title: 'Could not save mappings', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setSavingMappings(false);
    }
  };

  const handleSync = async () => {
    if (!tenantId) return;
    setSyncing(true);
    setLastSyncSummary(null);
    try {
      const r = await api('/api/connecteam/sync', { method: 'POST', body: JSON.stringify({ tenantId }) });
      const unmatched = r.unmatchedUsers?.length
        ? ` — ${r.unmatchedUsers.length} Connecteam user(s) with hours are unmapped`
        : '';
      setLastSyncSummary(
        `Synced ${r.entriesUpserted} entr${r.entriesUpserted === 1 ? 'y' : 'ies'} across ${r.weeksTouched.length} week(s)${unmatched}.`
      );
      toast({ title: 'Sync complete' });
      await loadStatus();
    } catch (err) {
      toast({ title: 'Sync failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  if (!tenantId || loading) return null;

  return (
    <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
          <Clock className="w-5 h-5" style={{ color: colors.gold }} />
          Connecteam
        </CardTitle>
        <CardDescription>
          Sync clock in/out hours from Connecteam into weekly tip-payout hours automatically — for all hourly staff,
          tipped or not.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.connected ? (
          <div className="space-y-2">
            <Label style={{ color: colors.brown }}>API Key</Label>
            <p className="text-xs" style={{ color: colors.brownLight }}>
              Create one in Connecteam admin under Settings → API. The key is stored server-side and never shown again.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Connecteam API key"
                data-testid="input-connecteam-api-key"
              />
              <Button
                onClick={handleConnect}
                disabled={connecting || !apiKey.trim()}
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-connecteam-connect"
              >
                {connecting ? 'Connecting…' : 'Connect'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{ backgroundColor: '#dcfce7', color: '#166534' }}
              >
                Connected
              </span>
              {status.lastSyncAt && (
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  Last sync: {new Date(status.lastSyncAt).toLocaleString()}
                </span>
              )}
              <span className="text-xs" style={{ color: colors.brownLight }}>
                {status.mappingCounts.confirmed || 0} employee(s) mapped
              </span>
            </div>

            {timeClocks.length > 1 && (
              <div className="space-y-1">
                <Label style={{ color: colors.brown }}>Time Clock</Label>
                <Select value={status.timeClockId ?? undefined} onValueChange={(v) => handleConfig({ timeClockId: v })}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a time clock" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeClocks.map((tc) => (
                      <SelectItem key={tc.id} value={tc.id}>
                        {tc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={status.syncEnabled}
                onCheckedChange={(checked) => handleConfig({ syncEnabled: checked })}
                data-testid="switch-connecteam-sync"
              />
              <span className="text-sm" style={{ color: colors.brown }}>
                Automatic sync (every 15 minutes)
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={loadUsers}
                disabled={loadingUsers}
                style={{ borderColor: colors.gold, color: colors.brown }}
                data-testid="button-connecteam-map"
              >
                {loadingUsers ? 'Loading…' : 'Map Employees'}
              </Button>
              <Button
                onClick={handleSync}
                disabled={syncing}
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-connecteam-sync"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                style={{ borderColor: '#ef4444', color: '#ef4444' }}
                data-testid="button-connecteam-disconnect"
              >
                <Unplug className="w-4 h-4 mr-1.5" />
                Disconnect
              </Button>
            </div>

            {lastSyncSummary && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {lastSyncSummary}
              </p>
            )}

            {mappings && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: colors.creamDark }}>
                <p className="text-sm font-medium" style={{ color: colors.brown }}>
                  Match each Connecteam user to a CMS employee (leave unmapped to skip their hours):
                </p>
                {mappings.map((m, idx) => (
                  <div key={m.connecteam_user_id} className="flex items-center gap-3">
                    <span className="text-sm w-40 truncate" style={{ color: colors.brown }}>
                      {m.connecteam_user_name}
                    </span>
                    <Select
                      value={m.tip_employee_id ?? UNMAPPED}
                      onValueChange={(v) =>
                        setMappings((prev) =>
                          prev
                            ? prev.map((row, i) =>
                                i === idx ? { ...row, tip_employee_id: v === UNMAPPED ? null : v } : row
                              )
                            : prev
                        )
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>— Not synced —</SelectItem>
                        {tipEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                            {e.tip_eligible === false ? ' (no tips)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={saveMappings}
                    disabled={savingMappings}
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                    data-testid="button-connecteam-save-mappings"
                  >
                    {savingMappings ? 'Saving…' : 'Save Mappings'}
                  </Button>
                  <Button variant="outline" onClick={() => setMappings(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
