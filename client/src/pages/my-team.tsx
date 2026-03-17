import { getErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { User, Calendar, Mail, Lock, TrendingUp, Phone, MapPin, Heart, Users, Pencil } from 'lucide-react';
import { useLocation } from 'wouter';
import { colors } from '@/lib/colors';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  avatar_url: string | null;
  start_date: string | null;
  created_at: string;
  phone: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

function calculateTenure(startDate: string | null): string {
  if (!startDate) return 'N/A';

  const start = new Date(startDate);
  const now = new Date();

  const years = now.getFullYear() - start.getFullYear();
  const months = now.getMonth() - start.getMonth();

  let totalMonths = years * 12 + months;

  // Adjust if we haven't reached the day of the month yet
  if (now.getDate() < start.getDate()) {
    totalMonths--;
  }

  if (totalMonths < 1) {
    return 'Less than 1 month';
  } else if (totalMonths < 12) {
    return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  } else {
    const displayYears = Math.floor(totalMonths / 12);
    const displayMonths = totalMonths % 12;

    if (displayMonths === 0) {
      return `${displayYears} year${displayYears !== 1 ? 's' : ''}`;
    } else {
      return `${displayYears} year${displayYears !== 1 ? 's' : ''}, ${displayMonths} month${displayMonths !== 1 ? 's' : ''}`;
    }
  }
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return colors.gold;
    case 'manager':
      return '#8B4513';
    case 'lead':
      return '#CD853F';
    case 'employee':
      return colors.brownLight;
    default:
      return colors.brown;
  }
}

function formatAddress(m: TeamMember): string | null {
  const parts = [m.address_line1, m.address_line2, m.city, m.state, m.zip_code].filter(Boolean);
  if (parts.length === 0) return null;
  const street = [m.address_line1, m.address_line2].filter(Boolean).join(', ');
  const cityStateZip = [m.city, m.state].filter(Boolean).join(', ') + (m.zip_code ? ` ${m.zip_code}` : '');
  return [street, cityStateZip].filter(Boolean).join('\n');
}

export default function MyTeam() {
  const { profile, tenant, branding, primaryTenant, canAccessModule } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState<Partial<TeamMember>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Role-based access: owner/manager can see all directory fields and edit
  const canViewFullDirectory = profile?.role === 'owner' || profile?.role === 'manager';
  const canEditDirectory = profile?.role === 'owner' || profile?.role === 'manager';

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : branding?.company_name || tenant?.name || 'Erwin Mills Coffee';
  const orgName = primaryTenant?.name || branding?.company_name || '';
  // Fetch all team members
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch stats for selected member
  const { data: memberStats } = useQuery({
    queryKey: ['member-stats', selectedMember?.id, tenant?.id],
    queryFn: async () => {
      if (!selectedMember?.id || !tenant?.id) return null;

      // Fetch various stats - only from modules the current user has access to
      const stats: any = {
        tipPayouts: null,
        cashDeposits: null,
        maintenanceTasks: null,
        adminTasks: null,
      };

      // Tip Payouts (if user has access)
      if (canAccessModule('tip-payout')) {
        try {
          const { data: tipData } = await supabase
            .from('tip_employee_hours')
            .select('hours, week_key')
            .eq('tenant_id', tenant.id)
            .eq('employee_id', selectedMember.id)
            .order('week_key', { ascending: false })
            .limit(10);

          if (tipData && tipData.length > 0) {
            const totalHours = tipData.reduce((sum, record) => sum + Number(record.hours || 0), 0);
            stats.tipPayouts = {
              totalHours,
              recentWeeks: tipData.length,
            };
          }
        } catch (err) {
          console.error('Error fetching tip stats:', err);
        }
      }

      // Cash Deposits (if user has access)
      if (canAccessModule('cash-deposit')) {
        try {
          const { data: cashData } = await supabase
            .from('cash_activity')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('user_id', selectedMember.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (cashData && cashData.length > 0) {
            stats.cashDeposits = {
              lastActivity: cashData[0].created_at,
            };
          }
        } catch (err) {
          console.error('Error fetching cash stats:', err);
        }
      }

      // Maintenance Tasks (if user has access)
      if (canAccessModule('equipment-maintenance')) {
        try {
          const { data: maintenanceData, count } = await supabase
            .from('equipment_maintenance')
            .select('*', { count: 'exact' })
            .eq('tenant_id', tenant.id)
            .eq('assigned_to', selectedMember.id);

          stats.maintenanceTasks = {
            total: count || 0,
          };
        } catch (err) {
          console.error('Error fetching maintenance stats:', err);
        }
      }

      // Admin Tasks (if user has access)
      if (canAccessModule('admin-tasks')) {
        try {
          const { data: tasksData, count } = await supabase
            .from('admin_tasks')
            .select('*', { count: 'exact' })
            .eq('tenant_id', tenant.id)
            .eq('assigned_to', selectedMember.id)
            .eq('status', 'completed');

          stats.adminTasks = {
            completed: count || 0,
          };
        } catch (err) {
          console.error('Error fetching admin task stats:', err);
        }
      }

      return stats;
    },
    enabled: !!selectedMember?.id && !!tenant?.id,
  });

  function openEditDialog(member: TeamMember) {
    setEditingMember(member);
    setEditForm({
      phone: member.phone || '',
      date_of_birth: member.date_of_birth || '',
      address_line1: member.address_line1 || '',
      address_line2: member.address_line2 || '',
      city: member.city || '',
      state: member.state || '',
      zip_code: member.zip_code || '',
      emergency_contact_name: member.emergency_contact_name || '',
      emergency_contact_phone: member.emergency_contact_phone || '',
    });
  }

  async function handleSaveDirectory() {
    if (!editingMember) return;
    setSaving(true);

    const { error } = await supabase
      .from('user_profiles')
      .update({
        phone: editForm.phone?.trim() || null,
        date_of_birth: editForm.date_of_birth && editForm.date_of_birth.trim() !== '' ? editForm.date_of_birth : null,
        address_line1: editForm.address_line1?.trim() || null,
        address_line2: editForm.address_line2?.trim() || null,
        city: editForm.city?.trim() || null,
        state: editForm.state?.trim() || null,
        zip_code: editForm.zip_code?.trim() || null,
        emergency_contact_name: editForm.emergency_contact_name?.trim() || null,
        emergency_contact_phone: editForm.emergency_contact_phone?.trim() || null,
      })
      .eq('id', editingMember.id);

    if (error) {
      console.error('Directory update error:', error);
      toast({
        title: 'Error',
        description: `${error.message} (${error.code}: ${error.details})`,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Updated', description: `${editingMember.full_name || 'Member'}'s info saved.` });
      setEditingMember(null);
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    }
    setSaving(false);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full animate-pulse mx-auto mb-3" style={{ backgroundColor: colors.gold }} />
          <p style={{ color: colors.brownLight }}>Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
            My Team
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • {orgName}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers?.map((member) => {
            const tenure = calculateTenure(member.start_date);
            const address = canViewFullDirectory ? formatAddress(member) : null;

            return (
              <Card
                key={member.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                style={{ backgroundColor: colors.white }}
                onClick={() => setSelectedMember(member)}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div
                        className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
                        style={{ backgroundColor: colors.cream, border: `2px solid ${colors.gold}` }}
                      >
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.full_name || 'Team member'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <User className="w-10 h-10" style={{ color: colors.brownLight }} />
                        )}
                      </div>
                      {/* Edit button — owner/manager only */}
                      {canEditDirectory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(member);
                          }}
                          className="absolute -top-1 -right-1 p-1.5 rounded-full bg-white shadow-sm hover:bg-gray-50 transition-colors"
                          style={{ border: `1px solid ${colors.creamDark}` }}
                          title="Edit directory info"
                        >
                          <Pencil className="w-3 h-3" style={{ color: colors.brownLight }} />
                        </button>
                      )}
                    </div>

                    {/* Name & Role */}
                    <div>
                      <h3 className="font-semibold text-lg" style={{ color: colors.brown }}>
                        {member.full_name || member.email.split('@')[0]}
                      </h3>
                      <Badge
                        className="capitalize mt-1"
                        style={{
                          backgroundColor: getRoleBadgeColor(member.role),
                          color: colors.white,
                        }}
                      >
                        {member.role}
                      </Badge>
                    </div>

                    {/* Contact Info */}
                    <div
                      className="w-full text-left space-y-1.5 pt-2"
                      style={{ borderTop: `1px solid ${colors.creamDark}` }}
                    >
                      <div className="flex items-center gap-2 text-xs" style={{ color: colors.brownLight }}>
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: colors.brownLight }}>
                          <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.start_date && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: colors.brownLight }}>
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.gold }} />
                          <span>
                            Since{' '}
                            {new Date(member.start_date + 'T00:00:00').toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            ({tenure})
                          </span>
                        </div>
                      )}
                      {canViewFullDirectory && address && (
                        <div className="flex items-start gap-2 text-xs" style={{ color: colors.brownLight }}>
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span className="whitespace-pre-line">{address}</span>
                        </div>
                      )}
                      {canViewFullDirectory && member.emergency_contact_name && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: colors.brownLight }}>
                          <Heart className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.red }} />
                          <span>
                            {member.emergency_contact_name}
                            {member.emergency_contact_phone && ` — ${member.emergency_contact_phone}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {(!teamMembers || teamMembers.length === 0) && (
            <div className="text-center py-12 col-span-full">
              <Users className="w-12 h-12 mx-auto mb-3" style={{ color: colors.brownLight }} />
              <p style={{ color: colors.brownLight }}>No team members found.</p>
            </div>
          )}
        </div>
      </main>

      {/* Member Detail Dialog (Team tab) */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-2xl" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Team Member Details</DialogTitle>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-6">
              {/* Member Info */}
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.cream, border: `2px solid ${colors.gold}` }}
                >
                  {selectedMember.avatar_url ? (
                    <img
                      src={selectedMember.avatar_url}
                      alt={selectedMember.full_name || 'Team member'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
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
                      {selectedMember.start_date
                        ? `Serving Since ${new Date(selectedMember.start_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (${calculateTenure(selectedMember.start_date)})`
                        : 'No start date recorded'}
                    </span>
                  </div>
                  <Badge
                    className="capitalize mt-2"
                    style={{
                      backgroundColor: getRoleBadgeColor(selectedMember.role),
                      color: colors.white,
                    }}
                  >
                    {selectedMember.role}
                  </Badge>
                </div>
              </div>

              {/* Stats Section */}
              <div className="border-t pt-4" style={{ borderColor: colors.creamDark }}>
                <h4 className="font-semibold mb-4" style={{ color: colors.brown }}>
                  Activity & Stats
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tip Payouts */}
                  <Card style={{ backgroundColor: colors.cream }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span style={{ color: colors.brown }}>Tip Payouts</span>
                        {!canAccessModule('tip-payout') && (
                          <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {canAccessModule('tip-payout') ? (
                        memberStats?.tipPayouts ? (
                          <div className="space-y-1">
                            <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                              {memberStats.tipPayouts.totalHours}
                            </p>
                            <p className="text-xs" style={{ color: colors.brownLight }}>
                              hours in last {memberStats.tipPayouts.recentWeeks} weeks
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            No tip data available
                          </p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view tip statistics
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.white }}
                            onClick={() => setLocation('/billing')}
                          >
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Upgrade
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Cash Deposits */}
                  <Card style={{ backgroundColor: colors.cream }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span style={{ color: colors.brown }}>Cash Deposits</span>
                        {!canAccessModule('cash-deposit') && (
                          <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {canAccessModule('cash-deposit') ? (
                        memberStats?.cashDeposits ? (
                          <div className="space-y-1">
                            <p className="text-sm font-semibold" style={{ color: colors.brown }}>
                              Last Activity
                            </p>
                            <p className="text-xs" style={{ color: colors.brownLight }}>
                              {new Date(memberStats.cashDeposits.lastActivity).toLocaleDateString()}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            No cash activity
                          </p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view cash deposit data
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.white }}
                            onClick={() => setLocation('/billing')}
                          >
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Upgrade
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Maintenance Tasks */}
                  <Card style={{ backgroundColor: colors.cream }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span style={{ color: colors.brown }}>Maintenance Tasks</span>
                        {!canAccessModule('equipment-maintenance') && (
                          <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {canAccessModule('equipment-maintenance') ? (
                        memberStats?.maintenanceTasks ? (
                          <div className="space-y-1">
                            <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                              {memberStats.maintenanceTasks.total}
                            </p>
                            <p className="text-xs" style={{ color: colors.brownLight }}>
                              total tasks assigned
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            No maintenance tasks
                          </p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view maintenance stats
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.white }}
                            onClick={() => setLocation('/billing')}
                          >
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Upgrade
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Admin Tasks */}
                  <Card style={{ backgroundColor: colors.cream }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span style={{ color: colors.brown }}>Admin Tasks</span>
                        {!canAccessModule('admin-tasks') && (
                          <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {canAccessModule('admin-tasks') ? (
                        memberStats?.adminTasks ? (
                          <div className="space-y-1">
                            <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                              {memberStats.adminTasks.completed}
                            </p>
                            <p className="text-xs" style={{ color: colors.brownLight }}>
                              tasks completed
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            No admin tasks
                          </p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view admin task stats
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.white }}
                            onClick={() => setLocation('/billing')}
                          >
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Upgrade
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Directory Info Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>
              Edit — {editingMember?.full_name || editingMember?.email.split('@')[0]}
            </DialogTitle>
          </DialogHeader>

          {editingMember && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>
                  Phone
                </label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>
                  Date of Birth
                </label>
                <Input
                  type="date"
                  value={editForm.date_of_birth || ''}
                  onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>
                  Address Line 1
                </label>
                <Input
                  placeholder="123 Main St"
                  value={editForm.address_line1 || ''}
                  onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>

              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>
                  Address Line 2
                </label>
                <Input
                  placeholder="Apt 4B"
                  value={editForm.address_line2 || ''}
                  onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>
                    City
                  </label>
                  <Input
                    placeholder="Durham"
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>
                    State
                  </label>
                  <Input
                    placeholder="NC"
                    value={editForm.state || ''}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>
                    Zip
                  </label>
                  <Input
                    placeholder="27701"
                    value={editForm.zip_code || ''}
                    onChange={(e) => setEditForm({ ...editForm, zip_code: e.target.value })}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  />
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: colors.creamDark }}>
                <p className="text-sm font-medium mb-3" style={{ color: colors.brown }}>
                  Emergency Contact
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs" style={{ color: colors.brownLight }}>
                      Name
                    </label>
                    <Input
                      placeholder="Jane Doe"
                      value={editForm.emergency_contact_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                  </div>
                  <div>
                    <label className="text-xs" style={{ color: colors.brownLight }}>
                      Phone
                    </label>
                    <Input
                      type="tel"
                      placeholder="(555) 987-6543"
                      value={editForm.emergency_contact_phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingMember(null)}
                  style={{ borderColor: colors.brownLight, color: colors.brownLight }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveDirectory}
                  disabled={saving}
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
