import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, UserPlus, Loader2, Mail, MapPin, Building2, Check, X, Shield, DollarSign, Eye, EyeOff, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { colors } from '@/lib/colors';
import { useManagerAssignments, useSetManager, useUpdateCompensation } from '@/hooks/use-manager-assignment';
import { useLocation } from 'wouter';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'owner' | 'manager' | 'lead' | 'employee';
  is_active: boolean;
}

interface Location {
  id: string;
  name: string;
  is_active: boolean;
}

interface UserLocationAssignment {
  user_id: string;
  tenant_id: string;
  is_active: boolean;
}

export default function AdminUsers() {
  const { user, profile, tenant, accessibleLocations, branding, primaryTenant, getRoleDisplayName } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: managerData } = useManagerAssignments();
  const setManagerMut = useSetManager();
  const updateCompMut = useUpdateCompensation();
  
  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'My Coffee Shop');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Location management state
  const [locations, setLocations] = useState<Location[]>([]);
  const [userAssignments, setUserAssignments] = useState<Record<string, string[]>>({});
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [savingLocations, setSavingLocations] = useState(false);
  const [pendingAssignments, setPendingAssignments] = useState<string[]>([]);
  
  // Add user form state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'manager' | 'lead' | 'employee'>('employee');
  const [creating, setCreating] = useState(false);
  
  // Success dialog
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdUserEmail, setCreatedUserEmail] = useState('');

  // Detail sheet (manager assignment + compensation)
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [detailManager, setDetailManager] = useState('none');
  const [detailExempt, setDetailExempt] = useState(false);
  const [detailHourlyRate, setDetailHourlyRate] = useState('');
  const [detailAnnualSalary, setDetailAnnualSalary] = useState('');
  const [detailPayFrequency, setDetailPayFrequency] = useState('biweekly');
  const [detailPin, setDetailPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);

  // Kiosk settings (owner only)
  const [kioskCode, setKioskCode] = useState('');
  const [savingKioskCode, setSavingKioskCode] = useState(false);

  // Check if current tenant has child locations (multi-location enabled)
  const hasMultipleLocations = locations.length > 0;
  const isOwner = profile?.role === 'owner';

  // Load child locations for owners
  const loadLocations = useCallback(async () => {
    if (!profile?.tenant_id || profile.role !== 'owner') return;

    try {
      // Load child locations
      const { data: children, error } = await supabase
        .from('tenants')
        .select('id, name, is_active')
        .eq('parent_tenant_id', profile.tenant_id)
        .order('name');

      if (error) throw error;

      // Include parent tenant so users can be assigned to it too
      const { data: parent } = await supabase
        .from('tenants')
        .select('id, name, is_active')
        .eq('id', profile.tenant_id)
        .single();

      const allLocations = parent ? [parent, ...(children || [])] : (children || []);
      setLocations(allLocations);
    } catch (error: any) {
      console.error('Error loading locations:', error.message);
    }
  }, [profile?.tenant_id, profile?.role]);

  // Load user location assignments
  const loadUserAssignments = useCallback(async () => {
    if (!profile?.tenant_id || locations.length === 0) return;
    
    try {
      const locationIds = locations.map(l => l.id);
      const { data, error } = await supabase
        .from('user_tenant_assignments')
        .select('user_id, tenant_id')
        .in('tenant_id', locationIds)
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Group assignments by user
      const grouped: Record<string, string[]> = {};
      (data || []).forEach((a: { user_id: string; tenant_id: string }) => {
        if (!grouped[a.user_id]) grouped[a.user_id] = [];
        grouped[a.user_id].push(a.tenant_id);
      });
      setUserAssignments(grouped);
    } catch (error: any) {
      console.error('Error loading assignments:', error.message);
    }
  }, [profile?.tenant_id, locations]);

  useEffect(() => {
    if (profile?.tenant_id) {
      loadUsers();
      loadLocations();
      // Load kiosk code for owners
      if (profile.role === 'owner') {
        supabase.from('tenants').select('kiosk_code').eq('id', profile.tenant_id).single()
          .then(({ data }) => { if (data?.kiosk_code) setKioskCode(data.kiosk_code); });
      }
    } else {
      setLoading(false);
    }
  }, [profile?.tenant_id, loadLocations]);

  useEffect(() => {
    if (locations.length > 0) {
      loadUserAssignments();
    }
  }, [locations, loadUserAssignments]);

  // Populate detail sheet form when user is selected
  useEffect(() => {
    if (detailUser && managerData) {
      const match = managerData.find(u => u.id === detailUser.id);
      setDetailManager(match?.manager_id || 'none');
      setDetailExempt(match?.is_exempt ?? false);
      setDetailHourlyRate(match?.hourly_rate != null ? String(match.hourly_rate) : '');
      setDetailAnnualSalary(match?.annual_salary != null ? String(match.annual_salary) : '');
      setDetailPayFrequency(match?.pay_frequency || 'biweekly');
      // Fetch kiosk PIN
      setDetailPin('');
      setShowPin(false);
      supabase
        .from('user_profiles')
        .select('kiosk_pin')
        .eq('id', detailUser.id)
        .single()
        .then(({ data }) => {
          if (data?.kiosk_pin) setDetailPin(data.kiosk_pin);
        });
    }
  }, [detailUser, managerData]);

  const loadUsers = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, is_active')
        .eq('tenant_id', profile.tenant_id)
        .order('role', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({ title: 'Error loading users', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      toast({ title: 'Role updated' });
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      toast({ title: isActive ? 'User deactivated' : 'User activated' });
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error updating user', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail || !profile?.tenant_id || !user?.id) {
      toast({ title: 'Email is required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          fullName: newName || newEmail.split('@')[0],
          role: newRole,
          tenantId: profile.tenant_id,
          requestingUserId: user.id,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to invite user');

      // Show success dialog
      setCreatedUserEmail(newEmail);
      setShowAddDialog(false);
      setShowSuccessDialog(true);

      // Reset form
      setNewEmail('');
      setNewName('');
      setNewRole('employee');
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Error creating user', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Open location assignment dialog for a user
  const openLocationDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setPendingAssignments(userAssignments[user.id] || []);
    setShowLocationDialog(true);
  };

  // Toggle a location assignment in pending state
  const toggleLocationAssignment = (locationId: string) => {
    setPendingAssignments(prev => 
      prev.includes(locationId) 
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  // Save location assignments for selected user
  const saveLocationAssignments = async () => {
    if (!selectedUser) return;
    
    setSavingLocations(true);
    try {
      const currentAssignments = userAssignments[selectedUser.id] || [];
      const toAdd = pendingAssignments.filter(id => !currentAssignments.includes(id));
      const toRemove = currentAssignments.filter(id => !pendingAssignments.includes(id));
      
      // Remove assignments
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('user_tenant_assignments')
          .delete()
          .eq('user_id', selectedUser.id)
          .in('tenant_id', toRemove);
        
        if (error) throw error;
      }
      
      // Add new assignments
      for (const tenantId of toAdd) {
        const { error } = await supabase
          .from('user_tenant_assignments')
          .upsert({
            user_id: selectedUser.id,
            tenant_id: tenantId,
            role: selectedUser.role,
            is_active: true
          }, { onConflict: 'user_id,tenant_id' });
        
        if (error) throw error;
      }
      
      toast({ title: 'Location assignments updated' });
      setShowLocationDialog(false);
      loadUserAssignments();
    } catch (error: any) {
      toast({ title: 'Error updating assignments', description: error.message, variant: 'destructive' });
    } finally {
      setSavingLocations(false);
    }
  };

  // Save detail sheet (manager + compensation)
  const handleSaveDetail = async () => {
    if (!detailUser) return;
    setSavingDetail(true);
    try {
      await setManagerMut.mutateAsync({
        userId: detailUser.id,
        managerId: detailManager === 'none' ? null : detailManager,
      });
      await updateCompMut.mutateAsync({
        userId: detailUser.id,
        updates: {
          is_exempt: detailExempt,
          hourly_rate: detailExempt ? null : (detailHourlyRate ? parseFloat(detailHourlyRate) : null),
          annual_salary: detailExempt ? (detailAnnualSalary ? parseFloat(detailAnnualSalary) : null) : null,
          pay_frequency: detailPayFrequency || 'biweekly',
        },
      });
      // Save kiosk PIN if changed
      if (detailPin && detailPin.length === 4 && profile?.tenant_id) {
        const pinResp = await fetch('/api/kiosk/update-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: detailUser.id, tenantId: profile.tenant_id, newPin: detailPin }),
        });
        if (!pinResp.ok) {
          const pinErr = await pinResp.json();
          throw new Error(pinErr.error || 'Failed to update PIN');
        }
      }
      toast({ title: 'Employee details saved' });
      setShowDetailSheet(false);
    } catch (error: any) {
      toast({ title: 'Error saving details', description: error.message, variant: 'destructive' });
    } finally {
      setSavingDetail(false);
    }
  };

  const managerCandidates = (managerData || []).filter(u =>
    (u.role === 'owner' || u.role === 'manager') && u.id !== detailUser?.id
  );

  const getRoleOrder = (role: string) => {
    switch (role) {
      case 'owner': return 1;
      case 'manager': return 2;
      case 'lead': return 3;
      default: return 4;
    }
  };

  const sortedUsers = [...users].sort((a, b) => getRoleOrder(a.role) - getRoleOrder(b.role));

  // Show loading while profile loads
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full animate-pulse mx-auto mb-3" style={{ backgroundColor: colors.gold }} />
          <p style={{ color: colors.brownLight }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profile.role !== 'owner' && profile.role !== 'manager') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <p style={{ color: colors.brown }}>Access denied. Owner or Manager role required.</p>
      </div>
    );
  }
  
  const canEditOwners = profile.role === 'owner';

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
            Manage Users
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • {orgName}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Card style={{ backgroundColor: colors.white }} className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle style={{ color: colors.brown }}>Team Members</CardTitle>
            <Button
              onClick={() => setShowAddDialog(true)}
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-add-user"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add New User
            </Button>
            
            {/* Success Dialog */}
            <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
              <DialogContent style={{ backgroundColor: colors.white }}>
                <DialogHeader>
                  <DialogTitle style={{ color: colors.brown }}>Invitation Sent</DialogTitle>
                  <DialogDescription style={{ color: colors.brownLight }}>
                    A confirmation email has been sent to the new team member
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: colors.cream }}>
                    <div className="flex items-center gap-3">
                      <Mail className="w-8 h-8" style={{ color: colors.gold }} />
                      <div>
                        <Label className="text-xs" style={{ color: colors.brownLight }}>Email sent to</Label>
                        <p className="font-medium" style={{ color: colors.brown }}>{createdUserEmail}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    The user will receive a password reset email. They can click the link in the email to set their own password, then log in.
                  </p>
                  <Button
                    onClick={() => setShowSuccessDialog(false)}
                    className="w-full"
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                    data-testid="button-close-success-dialog"
                  >
                    Done
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>

            {loading ? (
              <p style={{ color: colors.brownLight }}>Loading...</p>
            ) : users.length === 0 ? (
              <p style={{ color: colors.brownLight }}>No team members found.</p>
            ) : (
              <div className="space-y-3">
                {sortedUsers.map(user => (
                  <div 
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg gap-4 flex-wrap"
                    style={{ 
                      backgroundColor: user.is_active ? colors.cream : colors.creamDark,
                      opacity: user.is_active ? 1 : 0.7
                    }}
                  >
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium" style={{ color: colors.brown }}>
                        {user.full_name || 'No name set'}
                        {user.id === profile?.id && (
                          <span className="ml-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.gold }}>
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-sm" style={{ color: colors.brownLight }}>{user.email}</p>
                      {hasMultipleLocations && userAssignments[user.id]?.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <MapPin className="w-3 h-3" style={{ color: colors.brownLight }} />
                          <span className="text-xs" style={{ color: colors.brownLight }}>
                            {userAssignments[user.id].length} location{userAssignments[user.id].length !== 1 ? 's' : ''} assigned
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {user.id === profile?.id || (user.role === 'owner' && !canEditOwners) ? (
                        <span
                          className="px-3 py-1 rounded text-sm font-medium"
                          style={{ backgroundColor: colors.gold, color: colors.white }}
                        >
                          {getRoleDisplayName(user.role)}
                        </span>
                      ) : (
                        <>
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateRole(user.id, value)}
                          >
                            <SelectTrigger
                              className="w-32"
                              style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                              data-testid={`select-role-${user.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {canEditOwners && <SelectItem value="owner">{getRoleDisplayName('owner')}</SelectItem>}
                              <SelectItem value="manager">{getRoleDisplayName('manager')}</SelectItem>
                              <SelectItem value="lead">{getRoleDisplayName('lead')}</SelectItem>
                              <SelectItem value="employee">{getRoleDisplayName('employee')}</SelectItem>
                            </SelectContent>
                          </Select>

                          {user.role !== 'owner' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setDetailUser(user); setShowDetailSheet(true); }}
                              style={{ borderColor: colors.gold, color: colors.gold }}
                            >
                              <DollarSign className="w-4 h-4 mr-1" />
                              Details
                            </Button>
                          )}

                          {hasMultipleLocations && isOwner && user.role !== 'owner' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openLocationDialog(user)}
                              style={{ borderColor: colors.gold, color: colors.gold }}
                              data-testid={`button-locations-${user.id}`}
                            >
                              <MapPin className="w-4 h-4 mr-1" />
                              Locations
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleActive(user.id, user.is_active)}
                            style={{
                              borderColor: user.is_active ? colors.red : colors.gold,
                              color: user.is_active ? colors.red : colors.gold
                            }}
                            data-testid={`button-toggle-${user.id}`}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isOwner && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold" style={{ color: colors.brown }}>Role Permissions</h3>
                  <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
                    Customize what each role can do and rename roles
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/admin/role-settings')}
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Customize
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Add User Sheet */}
        <Sheet open={showAddDialog} onOpenChange={setShowAddDialog}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle style={{ color: colors.brown }}>Add New Team Member</SheetTitle>
              <SheetDescription style={{ color: colors.brownLight }}>
                Create a new user account for your team
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <Label style={{ color: colors.brown }}>Email *</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="team@example.com"
                  className="mt-1"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-new-user-email"
                />
              </div>
              <div>
                <Label style={{ color: colors.brown }}>Full Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="John Doe"
                  className="mt-1"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-new-user-name"
                />
              </div>
              <div>
                <Label style={{ color: colors.brown }}>Role</Label>
                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                  <SelectTrigger
                    tabIndex={0}
                    className="mt-1"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    data-testid="select-new-user-role"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  An email will be sent to this address. The user will click a link to confirm their email and set their own password.
                </p>
              </div>
              <Button
                onClick={handleCreateUser}
                disabled={creating || !newEmail}
                className="w-full"
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-create-user"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Invite...
                  </>
                ) : (
                  'Send Invite'
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Assign Locations Sheet */}
        <Sheet open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle style={{ color: colors.brown }}>Assign Locations</SheetTitle>
              <SheetDescription style={{ color: colors.brownLight }}>
                Select which locations {selectedUser?.full_name || selectedUser?.email} can access
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                {locations.filter(l => l.is_active).map(location => (
                  <div
                    key={location.id}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:brightness-95"
                    style={{ backgroundColor: colors.cream }}
                    onClick={() => toggleLocationAssignment(location.id)}
                    data-testid={`location-option-${location.id}`}
                  >
                    <Checkbox
                      checked={pendingAssignments.includes(location.id)}
                      onCheckedChange={() => toggleLocationAssignment(location.id)}
                      data-testid={`checkbox-location-${location.id}`}
                    />
                    <Building2 className="w-4 h-4" style={{ color: colors.gold }} />
                    <span style={{ color: colors.brown }}>{location.name}</span>
                  </div>
                ))}
                {locations.filter(l => l.is_active).length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: colors.brownLight }}>
                    No active locations available
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowLocationDialog(false)}
                  className="flex-1"
                  style={{ borderColor: colors.creamDark, color: colors.brown }}
                  data-testid="button-cancel-locations"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveLocationAssignments}
                  disabled={savingLocations}
                  className="flex-1"
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                  data-testid="button-save-locations"
                >
                  {savingLocations ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Assignments'
                  )}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Employee Detail Sheet */}
        <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle style={{ color: colors.brown }}>
                {detailUser?.full_name || detailUser?.email}
              </SheetTitle>
              <SheetDescription style={{ color: colors.brownLight }}>
                Manager assignment &amp; compensation
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 mt-6">
              {/* Manager Assignment */}
              <div>
                <Label style={{ color: colors.brown }}>Manager</Label>
                <Select value={detailManager} onValueChange={setDetailManager}>
                  <SelectTrigger
                    className="mt-1"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  >
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No manager (auto-assign)</SelectItem>
                    {managerCandidates.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exempt Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <div>
                  <Label style={{ color: colors.brown }}>Exempt (Salaried)</Label>
                  <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>
                    Exempt employees skip the time clock
                  </p>
                </div>
                <Switch
                  checked={detailExempt}
                  onCheckedChange={setDetailExempt}
                />
              </div>

              {/* Compensation Fields */}
              {detailExempt ? (
                <>
                  <div>
                    <Label style={{ color: colors.brown }}>Annual Salary</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: colors.brownLight }}>$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={detailAnnualSalary}
                        onChange={(e) => setDetailAnnualSalary(e.target.value)}
                        className="pl-7"
                        placeholder="50000.00"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Pay Frequency</Label>
                    <Select value={detailPayFrequency} onValueChange={setDetailPayFrequency}>
                      <SelectTrigger
                        className="mt-1"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label style={{ color: colors.brown }}>Hourly Rate</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: colors.brownLight }}>$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={detailHourlyRate}
                        onChange={(e) => setDetailHourlyRate(e.target.value)}
                        className="pl-7"
                        placeholder="15.00"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Pay Frequency</Label>
                    <Select value={detailPayFrequency} onValueChange={setDetailPayFrequency}>
                      <SelectTrigger
                        className="mt-1"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="semi_monthly">Semi-Monthly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Kiosk PIN */}
              <div>
                <Label style={{ color: colors.brown }}>Kiosk PIN</Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      type={showPin ? 'text' : 'password'}
                      value={detailPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setDetailPin(val);
                      }}
                      maxLength={4}
                      placeholder="4-digit PIN"
                      inputMode="numeric"
                      className="tracking-widest"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPin(!showPin)}
                    style={{ borderColor: colors.creamDark, color: colors.brownLight }}
                    type="button"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                  Used for Time Clock Kiosk
                </p>
              </div>

              <Button
                onClick={handleSaveDetail}
                disabled={savingDetail}
                className="w-full"
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                {savingDetail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Details'
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Kiosk Settings (owner only) */}
        {isOwner && (
          <Card className="mt-6" style={{ backgroundColor: colors.white }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                <Clock className="w-5 h-5" style={{ color: colors.gold }} />
                Time Clock Kiosk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label style={{ color: colors.brown }}>Store Code</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={kioskCode}
                    onChange={(e) => setKioskCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    placeholder="e.g., COB"
                    className="tracking-widest uppercase flex-1"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  />
                  <Button
                    onClick={async () => {
                      if (!profile?.tenant_id) return;
                      setSavingKioskCode(true);
                      try {
                        const resp = await fetch('/api/kiosk/set-code', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ tenantId: profile.tenant_id, kioskCode }),
                        });
                        if (!resp.ok) {
                          const err = await resp.json();
                          throw new Error(err.error);
                        }
                        toast({ title: 'Kiosk code saved' });
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message, variant: 'destructive' });
                      } finally {
                        setSavingKioskCode(false);
                      }
                    }}
                    disabled={savingKioskCode}
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                  >
                    {savingKioskCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                  Employees enter this code on the kiosk iPad to identify your store.
                </p>
              </div>
              {kioskCode && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Kiosk URL:{' '}
                    <span className="font-mono font-medium" style={{ color: colors.brown }}>
                      {window.location.origin}/kiosk
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
