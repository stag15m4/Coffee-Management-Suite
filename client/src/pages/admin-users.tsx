import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, UserPlus } from 'lucide-react';
import { Link } from 'wouter';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  red: '#C74B4B',
};

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'owner' | 'manager' | 'lead' | 'employee';
  is_active: boolean;
}

export default function AdminUsers() {
  const { profile, tenant } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'manager' | 'lead' | 'employee'>('employee');
  const [saving, setSaving] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('AdminUsers mounted, profile:', profile);
  }, [profile]);

  useEffect(() => {
    if (profile?.tenant_id) {
      loadUsers();
    }
  }, [profile?.tenant_id]);

  const loadUsers = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    try {
      console.log('Loading users for tenant:', profile.tenant_id);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, is_active')
        .eq('tenant_id', profile.tenant_id)
        .order('role', { ascending: true });

      if (error) {
        console.error('Error loading users:', error);
        throw error;
      }
      console.log('Loaded users:', data);
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

  if (profile.role !== 'owner') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <p style={{ color: colors.brown }}>Access denied. Owner role required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header 
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" data-testid="link-back-dashboard">
            <Button variant="ghost" size="icon" style={{ color: colors.brown }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg" style={{ color: colors.brown }}>Manage Users</h1>
            <p className="text-sm" style={{ color: colors.brownLight }}>Add, edit, or remove team members</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Card style={{ backgroundColor: colors.white }} className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle style={{ color: colors.brown }}>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: colors.cream }}>
              <p className="text-sm" style={{ color: colors.brownLight }}>
                <strong>Note:</strong> To add new users, they must first sign up through Supabase Auth. 
                Once they sign up, you can assign them to your tenant and set their role here.
                For now, you can manage existing team members below.
              </p>
            </div>

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
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {user.id === profile?.id ? (
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
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                            </SelectContent>
                          </Select>
                          
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
                  Access to Recipe Costing, Tip Payout, Cash Deposit, and Coffee Orders
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <p className="font-medium" style={{ color: colors.brown }}>Lead</p>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Access to Tip Payout and Coffee Orders only
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                <p className="font-medium" style={{ color: colors.brown }}>Employee</p>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  View-only access (for future expansion)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
