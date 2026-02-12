import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';
import { useRoleSettings, useUpdateRoleSetting, ALL_PERMISSIONS, type TenantRoleSetting, type PermissionKey } from '@/hooks/use-role-settings';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, Save } from 'lucide-react';
import { colors } from '@/lib/colors';

const ROLE_ORDER: UserRole[] = ['owner', 'manager', 'lead', 'employee'];

// Group permissions by category
function groupPermissions() {
  const groups: Record<string, { key: PermissionKey; label: string }[]> = {};
  for (const p of ALL_PERMISSIONS) {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push({ key: p.key, label: p.label });
  }
  return groups;
}

const PERM_GROUPS = groupPermissions();

export default function AdminRoleSettings() {
  const { profile } = useAuth();
  const { data: settings, isLoading } = useRoleSettings();
  const updateSetting = useUpdateRoleSetting();
  const { toast } = useToast();

  // Track pending edits per role
  const [edits, setEdits] = useState<Record<string, Partial<TenantRoleSetting>>>({});

  if (!profile || profile.role !== 'owner') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <p style={{ color: colors.brown }}>Access denied. Owner role required.</p>
      </div>
    );
  }

  if (isLoading || !settings) {
    return <CoffeeLoader fullScreen text="Loading role settings..." />;
  }

  const getEditedValue = (setting: TenantRoleSetting, field: keyof TenantRoleSetting) => {
    const edit = edits[setting.id];
    if (edit && field in edit) return (edit as any)[field];
    return setting[field];
  };

  const setField = (settingId: string, field: string, value: any) => {
    setEdits(prev => ({
      ...prev,
      [settingId]: { ...prev[settingId], [field]: value },
    }));
  };

  const handleSave = async (setting: TenantRoleSetting) => {
    const edit = edits[setting.id];
    if (!edit || Object.keys(edit).length === 0) {
      toast({ title: 'No changes to save' });
      return;
    }
    try {
      await updateSetting.mutateAsync({ id: setting.id, updates: edit });
      setEdits(prev => {
        const next = { ...prev };
        delete next[setting.id];
        return next;
      });
      toast({ title: 'Role settings saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    }
  };

  const settingsByRole = new Map(settings.map(s => [s.role, s]));

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6" style={{ color: colors.gold }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: colors.brown }}>Role Settings</h1>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Customize permissions and display names for each role
            </p>
          </div>
        </div>

        {ROLE_ORDER.map(role => {
          const setting = settingsByRole.get(role);
          if (!setting) return null;
          const isOwnerRole = role === 'owner';
          const hasEdits = !!edits[setting.id] && Object.keys(edits[setting.id]).length > 0;

          return (
            <Card key={role} style={{ backgroundColor: colors.white }}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                  {isOwnerRole && <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />}
                  {getEditedValue(setting, 'display_name') as string}
                  <Badge variant="outline" className="text-xs" style={{ borderColor: colors.creamDark, color: colors.brownLight }}>
                    {role}
                  </Badge>
                </CardTitle>
                {!isOwnerRole && hasEdits && (
                  <Button size="sm" onClick={() => handleSave(setting)}
                    disabled={updateSetting.isPending}
                    style={{ backgroundColor: colors.gold, color: colors.brown }}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isOwnerRole ? (
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Owners always have full access to all permissions. This cannot be changed.
                  </p>
                ) : (
                  <>
                    {/* Display Name */}
                    <div className="space-y-1.5">
                      <Label style={{ color: colors.brown }}>Display Name</Label>
                      <Input
                        value={getEditedValue(setting, 'display_name') as string}
                        onChange={(e) => setField(setting.id, 'display_name', e.target.value)}
                        placeholder={role.charAt(0).toUpperCase() + role.slice(1)}
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      />
                    </div>

                    {/* Permission toggles by category */}
                    {Object.entries(PERM_GROUPS).map(([category, perms]) => (
                      <div key={category}>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.brownLight }}>
                          {category}
                        </p>
                        <div className="space-y-2">
                          {perms.map(perm => (
                            <div key={perm.key} className="flex items-center justify-between p-2 rounded-lg"
                              style={{ backgroundColor: colors.cream }}>
                              <span className="text-sm" style={{ color: colors.brown }}>{perm.label}</span>
                              <Switch
                                checked={getEditedValue(setting, perm.key) as boolean}
                                onCheckedChange={(checked) => setField(setting.id, perm.key, checked)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
