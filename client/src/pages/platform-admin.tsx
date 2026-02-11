import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Users,
  Plus,
  LogOut,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  Settings,
  Package,
  Key,
  ShieldCheck,
  Pencil,
  Trash2,
  UserPlus,
  ExternalLink,
  LayoutDashboard,
} from 'lucide-react';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Footer } from '@/components/Footer';
import { formatRelativeTime, getActivityColor } from '@/hooks/use-store-profile';
import { colors } from '@/lib/colors';

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  subscription_status: string;
  subscription_plan: string;
  is_active: boolean;
  created_at: string;
  user_count?: number;
  last_login_at?: string | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
}

interface Module {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  is_premium_only: boolean;
}

interface ModuleSubscription {
  module_id: string;
}

interface PlatformAdminRecord {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export default function PlatformAdmin() {
  const { user, platformAdmin, isPlatformAdmin, loading: authLoading, signOut, enterTenantView } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    trialTenants: 0,
  });

  const [showNewTenantDialog, setShowNewTenantDialog] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [savingSubscription, setSavingSubscription] = useState(false);

  // Platform admin management state
  const [admins, setAdmins] = useState<PlatformAdminRecord[]>([]);
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);

  // Rename tenant state
  const [showRenameTenantDialog, setShowRenameTenantDialog] = useState(false);
  const [renameTenantId, setRenameTenantId] = useState('');
  const [renameTenantName, setRenameTenantName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Tenant IDs where this admin has a user profile
  const [myTenantIds, setMyTenantIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !isPlatformAdmin) {
      setLocation('/login');
    }
  }, [authLoading, isPlatformAdmin, setLocation]);

  useEffect(() => {
    if (isPlatformAdmin) {
      loadTenants();
      loadSubscriptionData();
      loadAdmins();
      loadMyTenants();
    }
  }, [isPlatformAdmin]);

  const loadMyTenants = async () => {
    if (!user) return;
    const [profileResult, assignmentsResult] = await Promise.all([
      supabase.from('user_profiles').select('tenant_id').eq('id', user.id),
      supabase.from('user_tenant_assignments').select('tenant_id').eq('user_id', user.id).eq('is_active', true),
    ]);
    const ids = new Set<string>();
    profileResult.data?.forEach(p => ids.add(p.tenant_id));
    assignmentsResult.data?.forEach(a => ids.add(a.tenant_id));
    setMyTenantIds(ids);
  };

  const loadSubscriptionData = async () => {
    try {
      const [plansResult, modulesResult] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('display_order'),
        supabase.from('modules').select('*').order('display_order'),
      ]);

      if (plansResult.data) {
        setSubscriptionPlans(plansResult.data);
      }
      if (modulesResult.data) {
        setModules(modulesResult.data);
      }
    } catch (error: unknown) {
      console.error('Error loading subscription data:', error);
    }
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.id || '',
  });

  const loadAdmins = async () => {
    try {
      const res = await fetch('/api/platform-admins', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data);
      }
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) {
      toast({ title: 'Email is required', variant: 'destructive' });
      return;
    }

    setAddingAdmin(true);
    try {
      const res = await fetch('/api/platform-admins', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: newAdminEmail, full_name: newAdminName || null }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error adding admin', description: data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Platform admin added successfully!' });
      setShowAddAdminDialog(false);
      setNewAdminEmail('');
      setNewAdminName('');
      loadAdmins();
    } catch (error: any) {
      toast({ title: 'Error adding admin', description: error.message, variant: 'destructive' });
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    setRemovingAdminId(adminId);
    try {
      const res = await fetch(`/api/platform-admins/${adminId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: 'Error removing admin', description: data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Platform admin removed' });
      loadAdmins();
    } catch (error: any) {
      toast({ title: 'Error removing admin', description: error.message, variant: 'destructive' });
    } finally {
      setRemovingAdminId(null);
    }
  };

  const openSubscriptionDialog = async (tenant: TenantWithStats) => {
    setSelectedTenant(tenant);
    const plan = tenant.subscription_plan || 'free';
    setSelectedPlan(plan);
    
    if (plan === 'alacarte') {
      const { data: subs } = await supabase
        .from('tenant_module_subscriptions')
        .select('module_id')
        .eq('tenant_id', tenant.id);
      setSelectedModules((subs || []).map((s: ModuleSubscription) => s.module_id));
    } else {
      setSelectedModules([]);
    }
    
    setShowSubscriptionDialog(true);
  };

  const toggleModule = (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      setSelectedModules(selectedModules.filter(m => m !== moduleId));
    } else {
      setSelectedModules([...selectedModules, moduleId]);
    }
  };

  const calculateMonthlyTotal = (): number => {
    if (selectedPlan === 'premium') return 99.99;
    if (selectedPlan === 'test_eval') return 0;
    if (selectedPlan === 'free') return 0;
    return selectedModules.reduce((total, moduleId) => {
      const module = modules.find(m => m.id === moduleId);
      const price = parseFloat(String(module?.monthly_price || 0)) || 0;
      return total + price;
    }, 0);
  };

  const saveSubscriptionSettings = async () => {
    if (!selectedTenant) return;
    
    setSavingSubscription(true);
    try {
      const { error: planError } = await supabase
        .from('tenants')
        .update({ subscription_plan: selectedPlan })
        .eq('id', selectedTenant.id);

      if (planError) throw planError;

      await supabase
        .from('tenant_module_subscriptions')
        .delete()
        .eq('tenant_id', selectedTenant.id);

      // For premium and test_eval plans, enable ALL modules
      // For alacarte, enable only selected modules
      let modulesToInsert: string[] = [];
      
      if (selectedPlan === 'premium' || selectedPlan === 'test_eval') {
        // Enable all modules for premium and test_eval plans
        modulesToInsert = modules.map(m => m.id);
      } else if (selectedPlan === 'alacarte' && selectedModules.length > 0) {
        modulesToInsert = selectedModules;
      }

      if (modulesToInsert.length > 0) {
        const subsToInsert = modulesToInsert.map(moduleId => ({
          tenant_id: selectedTenant.id,
          module_id: moduleId
        }));

        const { error: subError } = await supabase
          .from('tenant_module_subscriptions')
          .insert(subsToInsert);

        if (subError) throw subError;
      }

      toast({ title: 'Subscription updated successfully!' });
      setShowSubscriptionDialog(false);
      loadTenants();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error updating subscription', description: message, variant: 'destructive' });
    } finally {
      setSavingSubscription(false);
    }
  };

  const loadTenants = async () => {
    setLoading(true);
    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tenantsWithStats = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          const [{ count }, { data: loginData }] = await Promise.all([
            supabase
              .from('user_profiles')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenant.id),
            supabase
              .from('user_profiles')
              .select('last_login_at')
              .eq('tenant_id', tenant.id)
              .not('last_login_at', 'is', null)
              .order('last_login_at', { ascending: false })
              .limit(1),
          ]);

          return {
            ...tenant,
            user_count: count || 0,
            last_login_at: loginData?.[0]?.last_login_at || null,
          };
        })
      );

      setTenants(tenantsWithStats);

      const totalUsers = tenantsWithStats.reduce((sum, t) => sum + (t.user_count || 0), 0);
      setStats({
        totalTenants: tenantsWithStats.length,
        activeTenants: tenantsWithStats.filter(t => t.is_active).length,
        totalUsers,
        trialTenants: tenantsWithStats.filter(t => t.subscription_status === 'trial').length,
      });
    } catch (error: any) {
      toast({ title: 'Error loading tenants', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenantName || !newTenantSlug || !ownerEmail) {
      toast({ title: 'Business name, slug, and owner email are required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newTenantName,
          slug: newTenantSlug,
          ownerEmail,
          ownerName: ownerName || undefined,
          ownerPassword: ownerPassword || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      toast({ title: 'Business created successfully!' });
      setShowNewTenantDialog(false);
      setNewTenantName('');
      setNewTenantSlug('');
      setOwnerEmail('');
      setOwnerName('');
      setOwnerPassword('');
      loadTenants();
    } catch (error: any) {
      toast({ title: 'Error creating tenant', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggleTenantActive = async (tenantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: !currentStatus })
        .eq('id', tenantId);

      if (error) throw error;
      toast({ title: `Tenant ${!currentStatus ? 'activated' : 'deactivated'}` });
      loadTenants();
    } catch (error: any) {
      toast({ title: 'Error updating tenant', description: error.message, variant: 'destructive' });
    }
  };

  const openRenameDialog = (tenant: TenantWithStats) => {
    setRenameTenantId(tenant.id);
    setRenameTenantName(tenant.name);
    setShowRenameTenantDialog(true);
  };

  const handleRenameTenant = async () => {
    if (!renameTenantName.trim()) {
      toast({ title: 'Business name is required', variant: 'destructive' });
      return;
    }

    setRenaming(true);
    try {
      const newName = renameTenantName.trim();

      // Update both tenants.name and tenant_branding.company_name
      // so the new name shows everywhere across the platform
      const [tenantResult, brandingResult] = await Promise.all([
        supabase
          .from('tenants')
          .update({ name: newName })
          .eq('id', renameTenantId),
        supabase
          .from('tenant_branding')
          .update({ company_name: newName })
          .eq('tenant_id', renameTenantId),
      ]);

      if (tenantResult.error) throw tenantResult.error;
      if (brandingResult.error) throw brandingResult.error;
      toast({ title: 'Business renamed successfully!' });
      setShowRenameTenantDialog(false);
      loadTenants();
    } catch (error: any) {
      toast({ title: 'Error renaming business', description: error.message, variant: 'destructive' });
    } finally {
      setRenaming(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setLocation('/login');
  };

  if (authLoading || loading) {
    return <CoffeeLoader fullScreen />;
  }

  if (!isPlatformAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-4 border-b" style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8" style={{ color: colors.gold }} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: colors.brown }} data-testid="text-platform-admin-title">Platform Admin</h1>
              <p className="text-sm" style={{ color: colors.brownLight }}>{platformAdmin?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setLocation('/')}
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-my-dashboard"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              My Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation('/reseller-management')}
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-reseller-management"
            >
              <Key className="w-4 h-4 mr-2" />
              Wholesale Partners
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardHeader className="pb-2">
              <CardDescription style={{ color: colors.brownLight }}>Total Businesses</CardDescription>
              <CardTitle className="text-3xl" style={{ color: colors.brown }} data-testid="text-total-tenants">{stats.totalTenants}</CardTitle>
            </CardHeader>
            <CardContent>
              <Building2 className="w-8 h-8" style={{ color: colors.gold }} />
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardHeader className="pb-2">
              <CardDescription style={{ color: colors.brownLight }}>Active Businesses</CardDescription>
              <CardTitle className="text-3xl" style={{ color: colors.brown }} data-testid="text-active-tenants">{stats.activeTenants}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckCircle className="w-8 h-8" style={{ color: colors.green }} />
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardHeader className="pb-2">
              <CardDescription style={{ color: colors.brownLight }}>Total Users</CardDescription>
              <CardTitle className="text-3xl" style={{ color: colors.brown }} data-testid="text-total-users">{stats.totalUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <Users className="w-8 h-8" style={{ color: colors.gold }} />
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardHeader className="pb-2">
              <CardDescription style={{ color: colors.brownLight }}>On Trial</CardDescription>
              <CardTitle className="text-3xl" style={{ color: colors.brown }} data-testid="text-trial-tenants">{stats.trialTenants}</CardTitle>
            </CardHeader>
            <CardContent>
              <Activity className="w-8 h-8" style={{ color: colors.yellow }} />
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: colors.brown }}>Businesses</h2>
          <Dialog open={showNewTenantDialog} onOpenChange={setShowNewTenantDialog}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: colors.gold, color: colors.brown }} data-testid="button-add-business">
                <Plus className="w-4 h-4 mr-2" />
                Add Business
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl" style={{ color: colors.brown }}>Create New Business</DialogTitle>
                <DialogDescription style={{ color: colors.brownLight }}>
                  Set up a new tenant with their owner account
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="tenant-name">Business Name</Label>
                  <Input
                    id="tenant-name"
                    value={newTenantName}
                    onChange={(e) => {
                      setNewTenantName(e.target.value);
                      setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }}
                    placeholder="Acme Coffee Shop"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-tenant-name"
                  />
                </div>
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="tenant-slug">URL Slug</Label>
                  <Input
                    id="tenant-slug"
                    value={newTenantSlug}
                    onChange={(e) => setNewTenantSlug(e.target.value)}
                    placeholder="acme-coffee"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-tenant-slug"
                  />
                </div>
                <hr style={{ borderColor: colors.creamDark }} />
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="owner-name">Owner Name</Label>
                  <Input
                    id="owner-name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="John Smith"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-owner-name"
                  />
                </div>
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="owner-email">Owner Email</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@example.com"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-owner-email"
                  />
                </div>
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="owner-password">Temporary Password</Label>
                  <Input
                    id="owner-password"
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Leave blank if user already exists"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-owner-password"
                  />
                  <p className="text-xs mt-1" style={{ color: colors.brownLight }}>Only needed for new users. Existing accounts will be linked automatically.</p>
                </div>
                <Button
                  onClick={handleCreateTenant}
                  disabled={creating}
                  className="w-full"
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                  data-testid="button-create-tenant"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Business
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="hover:shadow-lg transition-shadow" style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
                      <Building2 className="w-6 h-6" style={{ color: colors.gold }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.brown }} data-testid={`text-tenant-name-${tenant.id}`}>{tenant.name}</h3>
                      <p className="text-sm" style={{ color: colors.brownLight }}>{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm" style={{ color: colors.brownLight }}>{tenant.user_count} users</p>
                      <p className="text-xs mt-0.5" style={{ color: getActivityColor(tenant.last_login_at ?? null) }}>
                        Last active: {formatRelativeTime(tenant.last_login_at ?? null)}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge
                          style={tenant.is_active
                            ? { backgroundColor: colors.green, color: '#fff' }
                            : { backgroundColor: colors.creamDark, color: colors.brown }
                          }
                        >
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" style={{ borderColor: colors.creamDark, color: colors.brownLight }}>
                          {tenant.subscription_status || 'trial'}
                        </Badge>
                      </div>
                    </div>
                    {myTenantIds.has(tenant.id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await enterTenantView(tenant.id);
                          setLocation('/');
                        }}
                        style={{ backgroundColor: colors.gold, color: colors.brown }}
                        data-testid={`button-go-to-tenant-${tenant.id}`}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" /> Go to page
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRenameDialog(tenant)}
                      style={{ borderColor: colors.gold, color: colors.gold }}
                      data-testid={`button-rename-tenant-${tenant.id}`}
                    >
                      <Pencil className="w-4 h-4 mr-1" /> Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSubscriptionDialog(tenant)}
                      style={{ borderColor: colors.gold, color: colors.gold }}
                      data-testid={`button-manage-subscription-${tenant.id}`}
                    >
                      <Package className="w-4 h-4 mr-1" /> Modules
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTenantActive(tenant.id, tenant.is_active)}
                      style={tenant.is_active
                        ? { borderColor: colors.red, color: colors.red }
                        : { borderColor: colors.green, color: colors.green }
                      }
                      data-testid={`button-toggle-tenant-${tenant.id}`}
                    >
                      {tenant.is_active ? (
                        <>
                          <XCircle className="w-4 h-4 mr-1" /> Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" /> Activate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {tenants.length === 0 && !loading && (
            <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-8 text-center" style={{ color: colors.brownLight }}>
                No businesses yet. Click "Add Business" to create your first tenant.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Platform Admins Section */}
        <div className="flex items-center justify-between mb-6 mt-12">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.brown }}>
            <ShieldCheck className="w-6 h-6" style={{ color: colors.gold }} />
            Platform Admins
          </h2>
          <Dialog open={showAddAdminDialog} onOpenChange={setShowAddAdminDialog}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: colors.gold, color: colors.brown }} data-testid="button-add-admin">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl" style={{ color: colors.brown }}>Add Platform Admin</DialogTitle>
                <DialogDescription style={{ color: colors.brownLight }}>
                  Add an existing user as a platform admin. They must already have an account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="admin-email">Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="user@example.com"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-admin-email"
                  />
                </div>
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="admin-name">Full Name (optional)</Label>
                  <Input
                    id="admin-name"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Jane Doe"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-admin-name"
                  />
                </div>
                <Button
                  onClick={handleAddAdmin}
                  disabled={addingAdmin}
                  className="w-full"
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                  data-testid="button-confirm-add-admin"
                >
                  {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add Platform Admin
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4 mb-8">
          {admins.map((admin) => (
            <Card key={admin.id} className="hover:shadow-lg transition-shadow" style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
                      <ShieldCheck className="w-6 h-6" style={{ color: colors.gold }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.brown }}>{admin.full_name || admin.email}</h3>
                      <p className="text-sm" style={{ color: colors.brownLight }}>{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      style={admin.is_active
                        ? { backgroundColor: colors.green, color: '#fff' }
                        : { backgroundColor: colors.creamDark, color: colors.brown }
                      }
                    >
                      {admin.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {admin.id !== user?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAdmin(admin.id)}
                        disabled={removingAdminId === admin.id}
                        style={{ borderColor: colors.red, color: colors.red }}
                        data-testid={`button-remove-admin-${admin.id}`}
                      >
                        {removingAdminId === admin.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-1" /> Remove
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {admins.length === 0 && (
            <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-8 text-center" style={{ color: colors.brownLight }}>
                Loading platform admins...
              </CardContent>
            </Card>
          )}
        </div>

        {/* Subscription Management Dialog */}
        <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl" style={{ color: colors.brown }}>Manage Subscription</DialogTitle>
              <DialogDescription style={{ color: colors.brownLight }}>
                {selectedTenant?.name} - Configure plan and modules
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Premium Suite Toggle */}
              <div
                className="p-4 rounded-xl border-2 cursor-pointer transition-colors"
                style={{
                  borderColor: selectedPlan === 'premium' ? colors.gold : colors.creamDark,
                  backgroundColor: selectedPlan === 'premium' ? colors.cream : colors.white,
                }}
                onClick={() => setSelectedPlan(selectedPlan === 'premium' ? 'alacarte' : 'premium')}
                data-testid="toggle-premium-suite"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg" style={{ color: colors.brown }}>Premium Suite</p>
                    <p className="text-sm" style={{ color: colors.brownLight }}>All {modules.length} modules including Recipe Costing</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold" style={{ color: colors.gold }}>$99.99</p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>/month</p>
                  </div>
                </div>
                <Switch
                  checked={selectedPlan === 'premium'}
                  onCheckedChange={(checked) => setSelectedPlan(checked ? 'premium' : 'alacarte')}
                  className="mt-3"
                  data-testid="switch-premium"
                />
              </div>

              {/* Test & Eval Option (Internal/Unpublished) */}
              <div
                className="p-4 rounded-xl border-2 cursor-pointer transition-colors"
                style={{
                  borderColor: selectedPlan === 'test_eval' ? '#3b82f6' : colors.creamDark,
                  backgroundColor: selectedPlan === 'test_eval' ? '#eff6ff' : colors.white,
                }}
                onClick={() => setSelectedPlan(selectedPlan === 'test_eval' ? 'alacarte' : 'test_eval')}
                data-testid="toggle-test-eval"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg" style={{ color: colors.brown }}>Test & Eval</p>
                    <p className="text-sm" style={{ color: colors.brownLight }}>Full access for testing and evaluation</p>
                    <Badge variant="outline" style={{ borderColor: '#3b82f6', color: '#2563eb' }} className="text-xs mt-1">
                      Internal Only
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold" style={{ color: colors.green }}>FREE</p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>unpublished</p>
                  </div>
                </div>
                <Switch
                  checked={selectedPlan === 'test_eval'}
                  onCheckedChange={(checked) => setSelectedPlan(checked ? 'test_eval' : 'alacarte')}
                  className="mt-3"
                  data-testid="switch-test-eval"
                />
              </div>

              {/* Free Trial Option */}
              {selectedTenant?.subscription_status === 'trial' && (
                <div
                  className="p-4 rounded-xl border-2 cursor-pointer transition-colors"
                  style={{
                    borderColor: selectedPlan === 'free' ? colors.green : colors.creamDark,
                    backgroundColor: selectedPlan === 'free' ? '#f0fdf4' : colors.white,
                  }}
                  onClick={() => setSelectedPlan('free')}
                  data-testid="toggle-free-trial"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: colors.brown }}>Free Trial</p>
                      <p className="text-sm" style={{ color: colors.brownLight }}>14-day trial with all features</p>
                    </div>
                    <Badge style={{ backgroundColor: colors.green, color: '#fff' }}>FREE</Badge>
                  </div>
                </div>
              )}

              {/* À La Carte Modules */}
              {selectedPlan !== 'premium' && selectedPlan !== 'test_eval' && selectedPlan !== 'free' && (
                <div>
                  <Label className="mb-3 block" style={{ color: colors.brown }}>À La Carte Modules</Label>
                  <div className="space-y-3">
                    {modules.map((module) => {
                      const isSelected = selectedModules.includes(module.id);
                      const isPremiumOnly = module.is_premium_only;

                      return (
                        <div
                          key={module.id}
                          className="flex items-center justify-between p-3 rounded-xl"
                          style={{
                            backgroundColor: isPremiumOnly ? colors.creamDark : colors.cream,
                            opacity: isPremiumOnly ? 0.6 : 1,
                          }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm" style={{ color: colors.brown }}>{module.name}</p>
                              {isPremiumOnly && (
                                <Badge variant="outline" style={{ borderColor: colors.gold, color: colors.gold }} className="text-xs">
                                  Premium Only
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: colors.brownLight }}>
                              {isPremiumOnly ? 'Available in Premium Suite' : `$${parseFloat(String(module.monthly_price || 0)).toFixed(2)}/mo`}
                            </p>
                          </div>
                          <Switch
                            checked={isSelected}
                            onCheckedChange={() => toggleModule(module.id)}
                            disabled={isPremiumOnly}
                            data-testid={`switch-module-${module.id}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Premium/Test & Eval modules preview */}
              {(selectedPlan === 'premium' || selectedPlan === 'test_eval') && (
                <div>
                  <Label className="mb-3 block" style={{ color: colors.brown }}>Included Modules</Label>
                  <div className="space-y-2">
                    {modules.map((module) => (
                      <div key={module.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: colors.cream }}>
                        <CheckCircle className="w-4 h-4" style={{ color: colors.green }} />
                        <span className="text-sm" style={{ color: colors.brown }}>{module.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly Total */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: colors.cream }}>
                <span className="font-semibold" style={{ color: colors.brown }}>Monthly Total</span>
                <span className="text-2xl font-bold" style={{ color: colors.green }}>
                  ${calculateMonthlyTotal().toFixed(2)}
                </span>
              </div>

              <Button
                onClick={saveSubscriptionSettings}
                disabled={savingSubscription}
                className="w-full"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-save-subscription"
              >
                {savingSubscription ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Tenant Dialog */}
        <Dialog open={showRenameTenantDialog} onOpenChange={setShowRenameTenantDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl" style={{ color: colors.brown }}>Rename Business</DialogTitle>
              <DialogDescription style={{ color: colors.brownLight }}>
                Update the business name. All data and history will be preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label style={{ color: colors.brown }} htmlFor="rename-tenant-name">Business Name</Label>
                <Input
                  id="rename-tenant-name"
                  value={renameTenantName}
                  onChange={(e) => setRenameTenantName(e.target.value)}
                  placeholder="New business name"
                  style={{ backgroundColor: colors.inputBg }}
                  data-testid="input-rename-tenant-name"
                />
              </div>
              <Button
                onClick={handleRenameTenant}
                disabled={renaming}
                className="w-full"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-confirm-rename-tenant"
              >
                {renaming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Name
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}
