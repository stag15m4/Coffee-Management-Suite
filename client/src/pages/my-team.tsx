import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, Mail, Lock, TrendingUp } from 'lucide-react';
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

export default function MyTeam() {
  const { profile, tenant, branding, primaryTenant, canAccessModule } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
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

            return (
              <Card
                key={member.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                style={{ backgroundColor: colors.white }}
                onClick={() => setSelectedMember(member)}
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    {/* Avatar */}
                    <div
                      className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: colors.cream, border: `2px solid ${colors.gold}` }}
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name || 'Team member'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-12 h-12" style={{ color: colors.brownLight }} />
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <h3 className="font-semibold text-lg" style={{ color: colors.brown }}>
                        {member.full_name || member.email.split('@')[0]}
                      </h3>
                      <p className="text-sm" style={{ color: colors.brownLight }}>
                        {member.email}
                      </p>
                    </div>

                    {/* Role Badge */}
                    <Badge
                      className="capitalize"
                      style={{
                        backgroundColor: getRoleBadgeColor(member.role),
                        color: colors.white,
                      }}
                    >
                      {member.role}
                    </Badge>

                    {/* Tenure */}
                    <div className="flex items-center gap-2 text-sm" style={{ color: colors.brownLight }}>
                      <Calendar className="w-4 h-4" />
                      <span>{tenure}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Member Detail Dialog */}
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
                      {calculateTenure(selectedMember.start_date)} with the team
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
                        {!canAccessModule('tip-payout') && <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />}
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
                          <p className="text-sm" style={{ color: colors.brownLight }}>No tip data available</p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view tip statistics
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.brown }}
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
                        {!canAccessModule('cash-deposit') && <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />}
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
                          <p className="text-sm" style={{ color: colors.brownLight }}>No cash activity</p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view cash deposit data
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.brown }}
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
                        {!canAccessModule('equipment-maintenance') && <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />}
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
                          <p className="text-sm" style={{ color: colors.brownLight }}>No maintenance tasks</p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view maintenance stats
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.brown }}
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
                        {!canAccessModule('admin-tasks') && <Lock className="w-4 h-4" style={{ color: colors.brownLight }} />}
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
                          <p className="text-sm" style={{ color: colors.brownLight }}>No admin tasks</p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            Upgrade to view admin task stats
                          </p>
                          <Button
                            size="sm"
                            style={{ backgroundColor: colors.gold, color: colors.brown }}
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

    </div>
  );
}
