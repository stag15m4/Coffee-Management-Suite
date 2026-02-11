import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, UserPlus, Loader2, Mail, MapPin, Building2, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { colors } from '@/lib/colors';

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
  const { user, profile, tenant, accessibleLocations, branding, primaryTenant } = useAuth();
  const { toast } = useToast();
  
  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
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
    } else {
      setLoading(false);
    }
  }, [profile?.tenant_id, loadLocations]);

  useEffect(() => {
    if (locations.length > 0) {
      loadUserAssignments();
    }
  }, [locations, loadUserAssignments]);

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
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button style={{ backgroundColor: colors.gold, color: colors.brown }} data-testid="button-add-user">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add New User
                </Button>
              </DialogTrigger>
              <DialogContent style={{ backgroundColor: colors.white }}>
                <DialogHeader>
                  <DialogTitle style={{ color: colors.brown }}>Add New Team Member</DialogTitle>
                  <DialogDescription style={{ color: colors.brownLight }}>
                    Create a new user account for your team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label style={{ color: colors.brown }}>Email *</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="team@example.com"
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
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-new-user-name"
                    />
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Role</Label>
                    <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                      <SelectTrigger
                        tabIndex={0}
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
                    style={{ backgroundColor: colors.gold, color: colors.brown }}
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
              </DialogContent>
            </Dialog>
            
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
                    style={{ backgroundColor: colors.gold, color: colors.brown }}
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
                          className="px-3 py-1 rounded text-sm font-medium capitalize"
                          style={{ backgroundColor: colors.gold, color: colors.brown }}
                        >
                          {user.role}
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
                              {canEditOwners && <SelectItem value="owner">Owner</SelectItem>}
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                            </SelectContent>
                          </Select>
                          
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

        {/* Location Assignment Dialog */}
        <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <DialogContent style={{ backgroundColor: colors.white }}>
            <DialogHeader>
              <DialogTitle style={{ color: colors.brown }}>
                Assign Locations
              </DialogTitle>
              <DialogDescription style={{ color: colors.brownLight }}>
                Select which locations {selectedUser?.full_name || selectedUser?.email} can access
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {locations.filter(l => l.is_active).map(location => (
                  <div
                    key={location.id}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover-elevate"
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
              <div className="flex gap-3">
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
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
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
          </DialogContent>
        </Dialog>

        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle style={{ color: colors.brown }}>Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <p className="font-medium" style={{ color: colors.brown }}>Owner</p>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Full access to all modules, user management, and branding settings
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <p className="font-medium" style={{ color: colors.brown }}>Manager</p>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Access to Recipe Costing, Tip Payout, Cash Deposit, Coffee Orders, Equipment Maintenance, and user management
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <p className="font-medium" style={{ color: colors.brown }}>Lead</p>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Access to Tip Payout, Coffee Orders, and Equipment Maintenance
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <p className="font-medium" style={{ color: colors.brown }}>Employee</p>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Access to Equipment Maintenance only
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
