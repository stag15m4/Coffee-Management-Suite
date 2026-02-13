import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Clock,
  DollarSign,
  User,
  Calendar,
  CalendarDays,
  Mail,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  useStoreTeamMembers,
  useStoreOperatingHours,
  useUpsertOperatingHours,
  useUpdateDrawerDefault,
  getDayName,
  formatTime,
  calculateTenure,
  formatRelativeTime,
  getActivityColor,
  getRoleBadgeColor,
  type StoreTeamMember,
  type OperatingHoursEntry,
} from '@/hooks/use-store-profile';
import { useTodayShifts, type Shift } from '@/hooks/use-shifts';
import { colors } from '@/lib/colors';

export default function StoreProfile() {
  const [, params] = useRoute('/store/:id');
  const storeId = params?.id;
  const { tenant, profile, switchLocation, primaryTenant, accessibleLocations, branding } = useAuth();
  const { toast } = useToast();

  const canEdit = profile?.role === 'owner' || profile?.role === 'manager';

  // Switch to this store's location context if needed
  useEffect(() => {
    if (storeId && tenant?.id !== storeId) {
      const target = accessibleLocations?.find((l) => l.id === storeId);
      if (target) {
        switchLocation(storeId);
      }
    }
  }, [storeId, tenant?.id, accessibleLocations, switchLocation]);

  const storeTenant = accessibleLocations?.find((l) => l.id === storeId);
  const isChildLocation = !!storeTenant?.parent_tenant_id;
  const displayName = storeTenant?.name || 'Store';
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const isParent = storeTenant?.id === primaryTenant?.id;

  const { data: teamMembers, isLoading: loadingTeam } = useStoreTeamMembers(storeId);
  const { data: operatingHours, isLoading: loadingHours } = useStoreOperatingHours(storeId);
  const { data: todayShifts } = useTodayShifts(storeId);

  const [selectedMember, setSelectedMember] = useState<StoreTeamMember | null>(null);
  const [editingHours, setEditingHours] = useState(false);
  const [editingDrawer, setEditingDrawer] = useState(false);

  if (!storeId || !storeTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <p style={{ color: colors.brownLight }}>Store not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Store Header */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: colors.white, border: `2px solid ${colors.gold}` }}
          >
            <Building2 className="w-7 h-7" style={{ color: colors.gold }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" style={{ color: colors.brown }}>
                {displayName}
              </h1>
              {isParent && (
                <Badge variant="secondary" className="text-xs">Main</Badge>
              )}
            </div>
            {isChildLocation && orgName && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {orgName}
              </p>
            )}
          </div>
        </div>

        {/* Team Members */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <User className="w-5 h-5" style={{ color: colors.gold }} />
              Team Members
              {teamMembers && (
                <span className="text-sm font-normal" style={{ color: colors.brownLight }}>
                  ({teamMembers.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTeam ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: colors.cream }} />
                ))}
              </div>
            ) : teamMembers && teamMembers.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    className="flex flex-col items-center text-center p-4 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    style={{ backgroundColor: colors.cream }}
                    onClick={() => setSelectedMember(member)}
                  >
                    <div
                      className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mb-2"
                      style={{ backgroundColor: colors.white, border: `2px solid ${colors.gold}` }}
                    >
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8" style={{ color: colors.brownLight }} />
                      )}
                    </div>
                    <p className="font-medium text-sm truncate w-full" style={{ color: colors.brown }}>
                      {member.full_name || member.email.split('@')[0]}
                    </p>
                    <Badge
                      className="capitalize mt-1 text-xs"
                      style={{ backgroundColor: getRoleBadgeColor(member.role), color: colors.white }}
                    >
                      {member.role}
                    </Badge>
                    <p className="text-xs mt-1" style={{ color: getActivityColor(member.last_login_at) }}>
                      {formatRelativeTime(member.last_login_at)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                No team members assigned to this location
              </p>
            )}
          </CardContent>
        </Card>

        {/* Working Today */}
        {todayShifts && todayShifts.length > 0 && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
                <CalendarDays className="w-5 h-5" style={{ color: colors.gold }} />
                Working Today
                <span className="text-sm font-normal" style={{ color: colors.brownLight }}>
                  ({todayShifts.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todayShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center gap-3 p-2 rounded-lg"
                    style={{ backgroundColor: colors.cream }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                      style={{
                        backgroundColor: colors.gold,
                        color: colors.white,
                      }}
                    >
                      {shift.employee_avatar ? (
                        <img src={shift.employee_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        (shift.employee_name || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: colors.brown }}>
                        {shift.employee_name || 'Unassigned'}
                      </p>
                      <p className="text-xs" style={{ color: colors.brownLight }}>
                        {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                        {shift.position && ` · ${shift.position}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Operating Hours */}
        <OperatingHoursCard
          storeId={storeId}
          hours={operatingHours}
          isLoading={loadingHours}
          canEdit={canEdit}
          editing={editingHours}
          onEditToggle={() => setEditingHours(!editingHours)}
        />

        {/* Starting Drawer */}
        <DrawerDefaultCard
          storeId={storeId}
          currentAmount={storeTenant.starting_drawer_default}
          canEdit={canEdit}
          editing={editingDrawer}
          onEditToggle={() => setEditingDrawer(!editingDrawer)}
        />
      </div>

      {/* Team Member Profile Overlay */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-md" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Team Member</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.cream, border: `2px solid ${colors.gold}` }}
                >
                  {selectedMember.avatar_url ? (
                    <img src={selectedMember.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10" style={{ color: colors.brownLight }} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold" style={{ color: colors.brown }}>
                    {selectedMember.full_name || selectedMember.email.split('@')[0]}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4" style={{ color: colors.brownLight }} />
                    <span className="text-sm" style={{ color: colors.brownLight }}>
                      {selectedMember.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4" style={{ color: colors.brownLight }} />
                    <span className="text-sm" style={{ color: colors.brownLight }}>
                      {calculateTenure(selectedMember.start_date)} with the team
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4" style={{ color: getActivityColor(selectedMember.last_login_at) }} />
                    <span className="text-sm" style={{ color: getActivityColor(selectedMember.last_login_at) }}>
                      Last active: {formatRelativeTime(selectedMember.last_login_at)}
                    </span>
                  </div>
                  <Badge
                    className="capitalize mt-2"
                    style={{ backgroundColor: getRoleBadgeColor(selectedMember.role), color: colors.white }}
                  >
                    {selectedMember.role}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

// --- Operating Hours Card ---

function OperatingHoursCard({
  storeId,
  hours,
  isLoading,
  canEdit,
  editing,
  onEditToggle,
}: {
  storeId: string;
  hours: OperatingHoursEntry[] | undefined;
  isLoading: boolean;
  canEdit: boolean;
  editing: boolean;
  onEditToggle: () => void;
}) {
  const { toast } = useToast();
  const upsertMutation = useUpsertOperatingHours();

  // Local editable state: 7 days
  const [editState, setEditState] = useState<
    { day_of_week: number; open_time: string; close_time: string; is_closed: boolean }[]
  >([]);

  useEffect(() => {
    if (editing) {
      const state = Array.from({ length: 7 }, (_, i) => {
        const existing = hours?.find((h) => h.day_of_week === i);
        return {
          day_of_week: i,
          open_time: existing?.open_time?.substring(0, 5) || '06:00',
          close_time: existing?.close_time?.substring(0, 5) || '16:00',
          is_closed: existing?.is_closed ?? false,
        };
      });
      setEditState(state);
    }
  }, [editing, hours]);

  const handleSave = async () => {
    try {
      await upsertMutation.mutateAsync(
        editState.map((entry) => ({
          tenant_id: storeId,
          day_of_week: entry.day_of_week,
          open_time: entry.is_closed ? null : entry.open_time,
          close_time: entry.is_closed ? null : entry.close_time,
          is_closed: entry.is_closed,
        }))
      );
      toast({ title: 'Operating hours saved' });
      onEditToggle();
    } catch {
      toast({ title: 'Failed to save hours', variant: 'destructive' });
    }
  };

  const updateDay = (dayIndex: number, field: string, value: string | boolean) => {
    setEditState((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, [field]: value } : d))
    );
  };

  return (
    <Card style={{ backgroundColor: colors.white }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
            <Clock className="w-5 h-5" style={{ color: colors.gold }} />
            Operating Hours
          </CardTitle>
          {canEdit && !editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditToggle}
              style={{ color: colors.brownLight }}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
          {editing && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditToggle}
                style={{ color: colors.brownLight }}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={upsertMutation.isPending}
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                <Check className="w-4 h-4 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-8 rounded animate-pulse" style={{ backgroundColor: colors.cream }} />
            ))}
          </div>
        ) : editing ? (
          <div className="space-y-2">
            {editState.map((day) => (
              <div
                key={day.day_of_week}
                className="flex items-center gap-3 p-2 rounded"
                style={{ backgroundColor: colors.cream }}
              >
                <span
                  className="w-24 text-sm font-medium flex-shrink-0"
                  style={{ color: colors.brown }}
                >
                  {getDayName(day.day_of_week)}
                </span>
                <label className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={day.is_closed}
                    onChange={(e) => updateDay(day.day_of_week, 'is_closed', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs" style={{ color: colors.brownLight }}>Closed</span>
                </label>
                {!day.is_closed && (
                  <>
                    <Input
                      type="time"
                      value={day.open_time}
                      onChange={(e) => updateDay(day.day_of_week, 'open_time', e.target.value)}
                      className="w-28 h-8 text-sm"
                    />
                    <span className="text-sm" style={{ color: colors.brownLight }}>to</span>
                    <Input
                      type="time"
                      value={day.close_time}
                      onChange={(e) => updateDay(day.day_of_week, 'close_time', e.target.value)}
                      className="w-28 h-8 text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : hours && hours.length > 0 ? (
          <div className="space-y-1">
            {Array.from({ length: 7 }, (_, i) => {
              const entry = hours.find((h) => h.day_of_week === i);
              return (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span
                    className="w-24 text-sm font-medium"
                    style={{ color: colors.brown }}
                  >
                    {getDayName(i)}
                  </span>
                  {entry?.is_closed ? (
                    <span className="text-sm" style={{ color: colors.brownLight }}>
                      Closed
                    </span>
                  ) : entry?.open_time && entry?.close_time ? (
                    <span className="text-sm" style={{ color: colors.brownLight }}>
                      {formatTime(entry.open_time)} – {formatTime(entry.close_time)}
                    </span>
                  ) : (
                    <span className="text-sm italic" style={{ color: colors.creamDark }}>
                      Not set
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm" style={{ color: colors.brownLight }}>
            No hours set{canEdit ? ' — tap Edit to add operating hours' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Drawer Default Card ---

function DrawerDefaultCard({
  storeId,
  currentAmount,
  canEdit,
  editing,
  onEditToggle,
}: {
  storeId: string;
  currentAmount?: number | null;
  canEdit: boolean;
  editing: boolean;
  onEditToggle: () => void;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateDrawerDefault();
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (editing) {
      setAmount(currentAmount != null ? String(currentAmount) : '200');
    }
  }, [editing, currentAmount]);

  const handleSave = async () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({ tenantId: storeId, amount: parsed });
      toast({ title: 'Starting drawer updated' });
      onEditToggle();
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  return (
    <Card style={{ backgroundColor: colors.white }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
            <DollarSign className="w-5 h-5" style={{ color: colors.gold }} />
            Starting Drawer
          </CardTitle>
          {canEdit && !editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditToggle}
              style={{ color: colors.brownLight }}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          )}
          {editing && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditToggle}
                style={{ color: colors.brownLight }}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                <Check className="w-4 h-4 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: colors.brown }}>$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40"
            />
          </div>
        ) : (
          <p className="text-lg font-semibold" style={{ color: colors.brown }}>
            {currentAmount != null
              ? `$${Number(currentAmount).toFixed(2)}`
              : 'Not set'}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
          Recommended amount to start the cash drawer with each shift
        </p>
      </CardContent>
    </Card>
  );
}
