import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllEmployees, type UnifiedEmployee } from '@/hooks/use-all-employees';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Link2,
  Unlink,
  RefreshCw,
  MapPin,
  Users,
  Check,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { colors } from '@/lib/colors';

interface SquareStatus {
  connected: boolean;
  merchantId: string | null;
  locationId: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  mappingStats: {
    confirmed: number;
    suggested: number;
    ignored: number;
  };
}

interface SquareLocation {
  id: string;
  name?: string;
  status?: string;
}

interface SquareMapping {
  id: string;
  square_team_member_id: string;
  square_team_member_name: string;
  user_profile_id: string | null;
  tip_employee_id: string | null;
  status: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await (await import('@/lib/supabase-queries')).supabase.auth.getSession();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': session?.user?.id || '',
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function SquareIntegrationSettings() {
  const { tenant } = useAuth();
  const { data: employees = [] } = useAllEmployees(tenant?.id);
  const { toast } = useToast();

  const [status, setStatus] = useState<SquareStatus | null>(null);
  const [locations, setLocations] = useState<SquareLocation[]>([]);
  const [mappings, setMappings] = useState<SquareMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Per-mapping local employee selection
  const [localSelections, setLocalSelections] = useState<Record<string, string>>({});

  const fetchStatus = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const s = await apiFetch(`/api/square/status/${tenant.id}`);
      setStatus(s);
    } catch {
      setStatus({ connected: false, merchantId: null, locationId: null, syncEnabled: false, lastSyncAt: null, mappingStats: { confirmed: 0, suggested: 0, ignored: 0 } });
    }
  }, [tenant?.id]);

  const fetchMappings = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const m = await apiFetch(`/api/square/mappings/${tenant.id}`);
      setMappings(m);
    } catch {
      // Ignore
    }
  }, [tenant?.id]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchStatus();
      await fetchMappings();
      setLoading(false);
    }
    init();
  }, [fetchStatus, fetchMappings]);

  // Handle OAuth callback (code in URL params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state) {
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname);

      (async () => {
        try {
          const result = await apiFetch('/api/square/callback', {
            method: 'POST',
            body: JSON.stringify({ code }),
          });
          if (result.locations) {
            setLocations(result.locations);
          }
          toast({ title: 'Square connected successfully' });
          await fetchStatus();
          await fetchMappings();
        } catch (err: any) {
          toast({ title: 'Failed to connect Square', description: err.message, variant: 'destructive' });
        }
      })();
    }
  }, [toast, fetchStatus, fetchMappings]);

  const handleConnect = async () => {
    try {
      const result = await apiFetch('/api/square/auth-url');
      window.location.href = result.url;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Square? This will remove all employee mappings and stop syncing.')) return;
    setDisconnecting(true);
    try {
      await apiFetch('/api/square/disconnect', { method: 'POST' });
      setStatus(null);
      setMappings([]);
      setLocations([]);
      toast({ title: 'Square disconnected' });
      await fetchStatus();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSetLocation = async (locationId: string) => {
    if (!tenant?.id) return;
    try {
      await apiFetch(`/api/square/set-location/${tenant.id}`, {
        method: 'POST',
        body: JSON.stringify({ locationId }),
      });
      toast({ title: 'Location set' });
      await fetchStatus();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    if (!tenant?.id) return;
    try {
      await apiFetch(`/api/square/toggle-sync/${tenant.id}`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
      await fetchStatus();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSyncNow = async () => {
    if (!tenant?.id) return;
    setSyncing(true);
    try {
      const result = await apiFetch(`/api/square/sync/${tenant.id}`, { method: 'POST' });
      toast({ title: 'Sync complete', description: `${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors` });
      await fetchStatus();
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSuggestMappings = async () => {
    if (!tenant?.id) return;
    setSuggesting(true);
    try {
      await apiFetch(`/api/square/suggest-mappings/${tenant.id}`, { method: 'POST' });
      toast({ title: 'Auto-matching complete' });
      await fetchMappings();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSuggesting(false);
    }
  };

  const handleConfirmMapping = async (mappingId: string) => {
    const selection = localSelections[mappingId];
    if (!selection) {
      toast({ title: 'Select a local employee first', variant: 'destructive' });
      return;
    }

    // Parse selection: "profile:id" or "tip:id"
    const [type, id] = selection.split(':');
    try {
      await apiFetch(`/api/square/mappings/${tenant?.id}`, {
        method: 'POST',
        body: JSON.stringify({
          mappingId,
          action: 'confirm',
          userProfileId: type === 'profile' ? id : null,
          tipEmployeeId: type === 'tip' ? id : null,
        }),
      });
      toast({ title: 'Mapping confirmed' });
      await fetchMappings();
      await fetchStatus();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleIgnoreMapping = async (mappingId: string) => {
    try {
      await apiFetch(`/api/square/mappings/${tenant?.id}`, {
        method: 'POST',
        body: JSON.stringify({ mappingId, action: 'ignore' }),
      });
      await fetchMappings();
      await fetchStatus();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const getEmployeeSelectValue = (mapping: SquareMapping): string => {
    if (localSelections[mapping.id]) return localSelections[mapping.id];
    if (mapping.user_profile_id) return `profile:${mapping.user_profile_id}`;
    if (mapping.tip_employee_id) return `tip:${mapping.tip_employee_id}`;
    return '';
  };

  const fetchLocations = async () => {
    if (!tenant?.id) return;
    try {
      const locs = await apiFetch(`/api/square/locations/${tenant.id}`);
      setLocations(locs);
    } catch {
      // Ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.gold }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Card */}
      <Card style={{ borderColor: colors.creamDark }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <path d="M8 12h8M12 8v8" />
                </svg>
                Square Integration
              </CardTitle>
              <CardDescription>
                Sync timeclock data from Square's Labor API
              </CardDescription>
            </div>
            {status?.connected && (
              <Badge
                className="text-white"
                style={{ backgroundColor: colors.green }}
              >
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status?.connected ? (
            <div className="text-center py-6">
              <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
                Connect your Square account to automatically import timeclock entries for your team.
              </p>
              <Button onClick={handleConnect} style={{ backgroundColor: colors.gold, color: '#fff' }}>
                <Link2 className="h-4 w-4 mr-2" />
                Connect to Square
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm" style={{ color: colors.brownLight }}>
                  Merchant ID: <span className="font-mono">{status.merchantId}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unlink className="h-4 w-4 mr-1" />}
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location & Sync — only show when connected */}
      {status?.connected && (
        <>
          <Card style={{ borderColor: colors.creamDark }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
                <MapPin className="h-4 w-4" />
                Location & Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Location picker */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium" style={{ color: colors.brown }}>Square Location:</label>
                {status.locationId ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{status.locationId}</Badge>
                    <Button variant="ghost" size="sm" onClick={fetchLocations}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={fetchLocations}>
                    Select Location
                  </Button>
                )}
              </div>

              {locations.length > 0 && (
                <Select onValueChange={handleSetLocation} value={status.locationId || ''}>
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                    <SelectValue placeholder="Choose a Square location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name || loc.id} {loc.status === 'INACTIVE' ? '(Inactive)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Sync controls */}
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: colors.creamDark }}>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={status.syncEnabled}
                    onCheckedChange={handleToggleSync}
                    disabled={!status.locationId}
                  />
                  <span className="text-sm" style={{ color: colors.brown }}>
                    Auto-sync every 15 minutes
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncNow}
                  disabled={syncing || !status.locationId}
                  style={{ borderColor: colors.gold }}
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Sync Now
                </Button>
              </div>

              {status.lastSyncAt && (
                <p className="text-xs" style={{ color: colors.brownLight }}>
                  Last synced: {new Date(status.lastSyncAt).toLocaleString()}
                </p>
              )}

              {/* Mapping summary */}
              <div className="flex gap-3 text-xs pt-2" style={{ color: colors.brownLight }}>
                <span>{status.mappingStats.confirmed} confirmed</span>
                <span>{status.mappingStats.suggested} pending</span>
                <span>{status.mappingStats.ignored} ignored</span>
              </div>
            </CardContent>
          </Card>

          {/* Employee Mapping */}
          <Card style={{ borderColor: colors.creamDark }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
                  <Users className="h-4 w-4" />
                  Employee Mapping
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestMappings}
                  disabled={suggesting}
                  style={{ borderColor: colors.gold }}
                >
                  {suggesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                  Auto-Suggest
                </Button>
              </div>
              <CardDescription>
                Map Square team members to local employees. Only confirmed mappings will sync.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: colors.brownLight }}>
                  No mappings yet. Click "Auto-Suggest" to match Square team members by name.
                </p>
              ) : (
                <div className="space-y-3">
                  {mappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ backgroundColor: colors.cream }}
                    >
                      {/* Square name + status */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: colors.brown }}>
                            {mapping.square_team_member_name}
                          </span>
                          <Badge
                            variant={mapping.status === 'confirmed' ? 'default' : 'secondary'}
                            className={mapping.status === 'confirmed' ? 'text-white' : ''}
                            style={mapping.status === 'confirmed' ? { backgroundColor: colors.green } : {}}
                          >
                            {mapping.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Local employee dropdown */}
                      {mapping.status !== 'ignored' && (
                        <Select
                          value={getEmployeeSelectValue(mapping)}
                          onValueChange={(val) =>
                            setLocalSelections((prev) => ({ ...prev, [mapping.id]: val }))
                          }
                        >
                          <SelectTrigger
                            className="w-48"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                          >
                            <SelectValue placeholder="Select employee..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp: UnifiedEmployee) => {
                              const val = emp.user_profile_id
                                ? `profile:${emp.user_profile_id}`
                                : `tip:${emp.tip_employee_id}`;
                              return (
                                <SelectItem key={val} value={val}>
                                  {emp.name} ({emp.source})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Actions */}
                      {mapping.status !== 'confirmed' && mapping.status !== 'ignored' && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleConfirmMapping(mapping.id)}
                            className="text-green-600 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleIgnoreMapping(mapping.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {mapping.status === 'confirmed' && (
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
