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
  Key,
  ShieldCheck,
  Trash2,
  UserPlus,
  ExternalLink,
  LayoutDashboard,
  Layers,
  FlaskConical,
  BarChart3,
  Send,
  Mail,
  Clock,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  vertical_id?: string | null;
  vertical_name?: string | null;
}

interface VerticalOption {
  id: string;
  slug: string;
  display_name: string;
}

// Match a business name to a vertical using slug/display_name keywords
function matchVertical(name: string, verticals: VerticalOption[]): VerticalOption | null {
  if (!name || verticals.length === 0) return null;
  const lower = name.toLowerCase();

  for (const v of verticals) {
    const words = [
      ...v.slug.split('-'),
      ...v.display_name.toLowerCase().split(/\s+/),
    ];
    if (words.some((w) => w.length >= 3 && lower.includes(w))) {
      return v;
    }
  }
  return null;
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
  rollout_status: 'internal' | 'beta' | 'ga';
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
  const [verticals, setVerticals] = useState<VerticalOption[]>([]);
  const [selectedVerticalId, setSelectedVerticalId] = useState<string>('');
  const [editTenantName, setEditTenantName] = useState<string>('');
  const [verticalPrompt, setVerticalPrompt] = useState(false); // true = name didn't match any vertical
  const [showCreateVertical, setShowCreateVertical] = useState(false);
  const [newVerticalName, setNewVerticalName] = useState('');
  const [creatingVertical, setCreatingVertical] = useState(false);

  // Platform admin management state
  const [admins, setAdmins] = useState<PlatformAdminRecord[]>([]);
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);

  // Beta invite state
  const [betaInvites, setBetaInvites] = useState<any[]>([]);
  const [showBetaInviteDialog, setShowBetaInviteDialog] = useState(false);
  const [betaInviteEmail, setBetaInviteEmail] = useState('');
  const [sendingBetaInvite, setSendingBetaInvite] = useState(false);

  // Usage analytics state
  const [moduleUsage, setModuleUsage] = useState<any[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState(30);

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
      loadBetaInvites();
      loadModuleUsage(analyticsDays);
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
      const [plansResult, modulesResult, verticalsResult] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('display_order'),
        supabase.from('modules').select('*').order('display_order'),
        supabase.from('verticals').select('id, slug, display_name').order('display_name'),
      ]);

      if (plansResult.data) {
        setSubscriptionPlans(plansResult.data);
      }
      if (modulesResult.data) {
        setModules(modulesResult.data);
      }
      if (verticalsResult.data) {
        setVerticals(verticalsResult.data);
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

  const loadBetaInvites = async () => {
    try {
      const res = await fetch('/api/beta-invites', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBetaInvites(data);
      }
    } catch (error) {
      console.error('Error loading beta invites:', error);
    }
  };

  const loadModuleUsage = async (days: number) => {
    try {
      const res = await fetch(`/api/analytics/module-usage?days=${days}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setModuleUsage(data.modules || []);
      }
    } catch (error) {
      console.error('Error loading module usage:', error);
    }
  };

  const handleSendBetaInvite = async () => {
    if (!betaInviteEmail) {
      toast({ title: 'Email is required', variant: 'destructive' });
      return;
    }

    setSendingBetaInvite(true);
    try {
      const res = await fetch('/api/beta-invite', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: betaInviteEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error sending invite', description: data.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Beta invite sent!', description: `Invite sent to ${betaInviteEmail}` });
      setShowBetaInviteDialog(false);
      setBetaInviteEmail('');
      loadBetaInvites();
    } catch (error: any) {
      toast({ title: 'Error sending invite', description: error.message, variant: 'destructive' });
    } finally {
      setSendingBetaInvite(false);
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

  const updateModuleRollout = async (moduleId: string, status: 'internal' | 'beta' | 'ga') => {
    const { error } = await supabase
      .from('modules')
      .update({ rollout_status: status })
      .eq('id', moduleId);

    if (error) {
      toast({ title: 'Error updating module rollout', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${moduleId} set to ${status.toUpperCase()}` });
      setModules(prev => prev.map(m => m.id === moduleId ? { ...m, rollout_status: status } : m));
    }
  };

  const openSubscriptionDialog = async (tenant: TenantWithStats) => {
    setSelectedTenant(tenant);
    setEditTenantName(tenant.name);
    setShowCreateVertical(false);
    setNewVerticalName('');

    // Auto-match vertical from name if none assigned
    if (!tenant.vertical_id) {
      const match = matchVertical(tenant.name, verticals);
      if (match) {
        setSelectedVerticalId(match.id);
        setVerticalPrompt(false);
      } else {
        setSelectedVerticalId('');
        setVerticalPrompt(true); // prompt user to choose or create
      }
    } else {
      setSelectedVerticalId(tenant.vertical_id);
      setVerticalPrompt(false);
    }

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

  // Re-run auto-match when name changes (only if no vertical manually selected)
  const handleNameChange = (name: string) => {
    setEditTenantName(name);
    if (!selectedVerticalId || selectedVerticalId === '') {
      const match = matchVertical(name, verticals);
      if (match) {
        setSelectedVerticalId(match.id);
        setVerticalPrompt(false);
      } else {
        setVerticalPrompt(true);
      }
    }
  };

  const handleCreateVertical = async () => {
    const displayName = newVerticalName.trim();
    if (!displayName) return;

    setCreatingVertical(true);
    try {
      const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const productName = displayName.replace(/\s+/g, '') + 'Suite';

      const res = await fetch('/api/verticals', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          slug,
          productName,
          displayName,
          isPublished: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create vertical');
      }

      const created = await res.json();
      // Add to local list and auto-select
      const newOption: VerticalOption = { id: created.id, slug: created.slug, display_name: created.display_name };
      setVerticals((prev) => [...prev, newOption]);
      setSelectedVerticalId(created.id);
      setVerticalPrompt(false);
      setShowCreateVertical(false);
      setNewVerticalName('');
      toast({ title: `Vertical "${displayName}" created` });
    } catch (error: any) {
      toast({ title: 'Error creating vertical', description: error.message, variant: 'destructive' });
    } finally {
      setCreatingVertical(false);
    }
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
    if (selectedPlan === 'beta') return 0;
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
      const newName = editTenantName.trim();
      if (!newName) {
        toast({ title: 'Business name is required', variant: 'destructive' });
        setSavingSubscription(false);
        return;
      }

      const { error: planError } = await supabase
        .from('tenants')
        .update({
          name: newName,
          subscription_plan: selectedPlan,
          vertical_id: selectedVerticalId || null,
        })
        .eq('id', selectedTenant.id);

      if (planError) throw planError;

      // Keep branding company_name in sync with tenant name
      if (newName !== selectedTenant.name) {
        await supabase
          .from('tenant_branding')
          .update({ company_name: newName })
          .eq('tenant_id', selectedTenant.id);
      }

      await supabase
        .from('tenant_module_subscriptions')
        .delete()
        .eq('tenant_id', selectedTenant.id);

      // For premium and beta plans, enable ALL modules
      // For alacarte, enable only selected modules
      let modulesToInsert: string[] = [];

      if (selectedPlan === 'premium' || selectedPlan === 'beta') {
        // Enable all modules for premium and beta plans
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
        .select('*, verticals(display_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tenantsWithStats = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          const [{ count }, { data: loginData }, { data: assignmentData }] = await Promise.all([
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
            // Also check cross-tenant activity via user_tenant_assignments
            supabase
              .from('user_tenant_assignments')
              .select('updated_at')
              .eq('tenant_id', tenant.id)
              .eq('is_active', true)
              .order('updated_at', { ascending: false })
              .limit(1),
          ]);

          // Use the most recent activity from either source
          const profileLogin = loginData?.[0]?.last_login_at || null;
          const assignmentActivity = assignmentData?.[0]?.updated_at || null;
          let lastActive = profileLogin;
          if (assignmentActivity && (!lastActive || assignmentActivity > lastActive)) {
            lastActive = assignmentActivity;
          }

          return {
            ...tenant,
            user_count: count || 0,
            last_login_at: lastActive,
            vertical_name: (tenant as any).verticals?.display_name || null,
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
              style={{ backgroundColor: colors.gold, color: colors.white }}
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
              <Button style={{ backgroundColor: colors.gold, color: colors.white }} data-testid="button-add-business">
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
                  style={{ backgroundColor: colors.gold, color: colors.white }}
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
            <Card
              key={tenant.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
              onClick={() => openSubscriptionDialog(tenant)}
              data-testid={`card-tenant-${tenant.id}`}
            >
              <CardContent className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
                      <Building2 className="w-6 h-6" style={{ color: colors.gold }} />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.brown }} data-testid={`text-tenant-name-${tenant.id}`}>{tenant.name}</h3>
                      <p className="text-sm" style={{ color: colors.brownLight }}>{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-sm" style={{ color: colors.brownLight }}>{tenant.user_count} users</p>
                      <p className="text-xs mt-0.5" style={{ color: getActivityColor(tenant.last_login_at ?? null) }}>
                        Last active: {formatRelativeTime(tenant.last_login_at ?? null)}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
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
                        {tenant.vertical_name && (
                          <Badge variant="outline" style={{ borderColor: colors.gold, color: colors.gold }}>
                            {tenant.vertical_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Ensure platform admin has an assignment so it shows in the store switcher
                        if (user && !myTenantIds.has(tenant.id)) {
                          await supabase.from('user_tenant_assignments').upsert({
                            user_id: user.id,
                            tenant_id: tenant.id,
                            role: 'owner',
                            is_active: true,
                          }, { onConflict: 'user_id,tenant_id' });
                          setMyTenantIds((prev) => { const next = new Set(Array.from(prev)); next.add(tenant.id); return next; });
                        }
                        await enterTenantView(tenant.id);
                        setLocation('/');
                      }}
                      style={{ backgroundColor: colors.gold, color: colors.white }}
                      data-testid={`button-go-to-tenant-${tenant.id}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" /> Go to page
                    </Button>
                    <Settings className="w-5 h-5" style={{ color: colors.brownLight }} />
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
              <Button style={{ backgroundColor: colors.gold, color: colors.white }} data-testid="button-add-admin">
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
                  style={{ backgroundColor: colors.gold, color: colors.white }}
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

        {/* Beta Invites Section */}
        <div className="flex items-center justify-between mb-6 mt-12">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.brown }}>
            <FlaskConical className="w-6 h-6" style={{ color: colors.gold }} />
            Beta Invites
          </h2>
          <Dialog open={showBetaInviteDialog} onOpenChange={setShowBetaInviteDialog}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: colors.gold, color: colors.white }}>
                <Send className="w-4 h-4 mr-2" />
                Send Invite
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl" style={{ color: colors.brown }}>Send Beta Invite</DialogTitle>
                <DialogDescription style={{ color: colors.brownLight }}>
                  Send a beta access code to a new tester via email.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label style={{ color: colors.brown }} htmlFor="beta-email">Email Address</Label>
                  <Input
                    id="beta-email"
                    type="email"
                    value={betaInviteEmail}
                    onChange={(e) => setBetaInviteEmail(e.target.value)}
                    placeholder="tester@example.com"
                    style={{ backgroundColor: colors.inputBg }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendBetaInvite()}
                  />
                </div>
                <Button
                  onClick={handleSendBetaInvite}
                  disabled={sendingBetaInvite}
                  className="w-full"
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {sendingBetaInvite ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Beta Invite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3 mb-8">
          {betaInvites.length > 0 ? betaInvites.map((invite: any) => (
            <Card key={invite.id} style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
                      <Mail className="w-5 h-5" style={{ color: colors.gold }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: colors.brown }}>{invite.invited_email || 'No email'}</h3>
                      <p className="text-xs font-mono" style={{ color: colors.brownLight }}>{invite.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge style={invite.tenant_name
                        ? { backgroundColor: colors.green, color: '#fff' }
                        : { backgroundColor: '#dbeafe', color: '#2563eb' }
                      }>
                        {invite.tenant_name ? 'Redeemed' : 'Pending'}
                      </Badge>
                      {invite.tenant_name && (
                        <p className="text-xs mt-1" style={{ color: colors.brownLight }}>{invite.tenant_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: colors.brownLight }}>
                      <Clock className="w-3 h-3" />
                      {new Date(invite.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-8 text-center" style={{ color: colors.brownLight }}>
                No beta invites sent yet. Click "Send Invite" to invite a beta tester.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Module Rollout Section */}
        <div className="flex items-center justify-between mb-6 mt-12">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.brown }}>
            <Layers className="w-6 h-6" style={{ color: colors.gold }} />
            Module Rollout
          </h2>
        </div>

        <div className="space-y-3 mb-8">
          {modules.map((module) => {
            const statusColors = {
              internal: { bg: colors.creamDark, text: colors.brown, label: 'Internal' },
              beta: { bg: '#dbeafe', text: '#2563eb', label: 'Beta' },
              ga: { bg: '#dcfce7', text: '#16a34a', label: 'GA' },
            };
            const status = statusColors[module.rollout_status] || statusColors.ga;

            return (
              <Card key={module.id} style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold" style={{ color: colors.brown }}>{module.name}</h3>
                        <p className="text-xs" style={{ color: colors.brownLight }}>{module.id}</p>
                      </div>
                      <Badge style={{ backgroundColor: status.bg, color: status.text }}>
                        {status.label}
                      </Badge>
                    </div>
                    <Select
                      value={module.rollout_status}
                      onValueChange={(value) => updateModuleRollout(module.id, value as 'internal' | 'beta' | 'ga')}
                    >
                      <SelectTrigger className="w-[140px]" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="beta">Beta</SelectItem>
                        <SelectItem value="ga">GA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {modules.length === 0 && (
            <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-8 text-center" style={{ color: colors.brownLight }}>
                Loading modules...
              </CardContent>
            </Card>
          )}
        </div>

        {/* Usage Analytics Section */}
        <div className="flex items-center justify-between mb-6 mt-12">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.brown }}>
            <BarChart3 className="w-6 h-6" style={{ color: colors.gold }} />
            Usage Analytics
          </h2>
          <div className="flex items-center gap-2">
            {[7, 30].map((d) => (
              <Button
                key={d}
                variant={analyticsDays === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setAnalyticsDays(d);
                  loadModuleUsage(d);
                }}
                style={analyticsDays === d
                  ? { backgroundColor: colors.gold, color: colors.white }
                  : { borderColor: colors.creamDark, color: colors.brown }
                }
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {moduleUsage.length > 0 ? (
            <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-4">
                <div className="grid grid-cols-4 gap-4 mb-3 px-2">
                  <span className="text-xs font-semibold uppercase" style={{ color: colors.brownLight }}>Module</span>
                  <span className="text-xs font-semibold uppercase text-center" style={{ color: colors.brownLight }}>Visits</span>
                  <span className="text-xs font-semibold uppercase text-center" style={{ color: colors.brownLight }}>Users</span>
                  <span className="text-xs font-semibold uppercase text-center" style={{ color: colors.brownLight }}>Tenants</span>
                </div>
                {moduleUsage.map((m: any) => {
                  const mod = modules.find((mod) => mod.id === m.module_id);
                  return (
                    <div key={m.module_id} className="grid grid-cols-4 gap-4 py-2 px-2 rounded-lg hover:bg-opacity-50" style={{ backgroundColor: colors.cream }}>
                      <div>
                        <p className="font-medium text-sm" style={{ color: colors.brown }}>{mod?.name || m.module_id}</p>
                        <p className="text-xs" style={{ color: colors.brownLight }}>{m.module_id}</p>
                      </div>
                      <p className="text-center font-semibold" style={{ color: colors.brown }}>{m.visit_count}</p>
                      <p className="text-center font-semibold" style={{ color: colors.brown }}>{m.unique_users}</p>
                      <p className="text-center font-semibold" style={{ color: colors.brown }}>{m.tenant_count}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
              <CardContent className="py-8 text-center" style={{ color: colors.brownLight }}>
                No module usage data for the last {analyticsDays} days.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Unified Tenant Management Dialog */}
        <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl" style={{ color: colors.brown }}>Manage Business</DialogTitle>
              <DialogDescription style={{ color: colors.brownLight }}>
                Configure settings, vertical, plan, and modules
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Business Name */}
              <div>
                <Label className="mb-2 block" style={{ color: colors.brown }} htmlFor="edit-tenant-name">Business Name</Label>
                <Input
                  id="edit-tenant-name"
                  value={editTenantName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Business name"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-edit-tenant-name"
                />
              </div>

              {/* Vertical Assignment */}
              <div>
                <Label className="mb-2 block" style={{ color: colors.brown }}>Business Vertical</Label>
                <Select
                  value={selectedVerticalId || 'none'}
                  onValueChange={(value) => {
                    setSelectedVerticalId(value === 'none' ? '' : value);
                    setVerticalPrompt(false);
                  }}
                >
                  <SelectTrigger
                    className="w-full"
                    style={{
                      borderColor: verticalPrompt && !selectedVerticalId ? colors.gold : colors.creamDark,
                      color: colors.brown,
                      boxShadow: verticalPrompt && !selectedVerticalId ? `0 0 0 2px ${colors.gold}40` : undefined,
                    }}
                    data-testid="select-tenant-vertical"
                  >
                    <SelectValue placeholder="No vertical assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No vertical assigned</SelectItem>
                    {verticals.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {verticalPrompt && !selectedVerticalId ? (
                  <p className="text-xs mt-1 font-medium" style={{ color: colors.gold }}>
                    No vertical matched this name. Please choose one above or create a new one.
                  </p>
                ) : (
                  <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                    Controls theme, terminology, and starter templates for this tenant.
                  </p>
                )}

                {/* Create New Vertical */}
                {!showCreateVertical ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-0"
                    style={{ color: colors.gold }}
                    onClick={() => setShowCreateVertical(true)}
                    data-testid="button-create-vertical"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Create new vertical
                  </Button>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={newVerticalName}
                      onChange={(e) => setNewVerticalName(e.target.value)}
                      placeholder="e.g. Bakery, Juice Bar..."
                      className="flex-1"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-new-vertical-name"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateVertical()}
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateVertical}
                      disabled={creatingVertical || !newVerticalName.trim()}
                      style={{ backgroundColor: colors.gold, color: colors.white }}
                      data-testid="button-confirm-create-vertical"
                    >
                      {creatingVertical ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowCreateVertical(false); setNewVerticalName(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

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

              {/* Beta Plan Option */}
              <div
                className="p-4 rounded-xl border-2 cursor-pointer transition-colors"
                style={{
                  borderColor: selectedPlan === 'beta' ? '#3b82f6' : colors.creamDark,
                  backgroundColor: selectedPlan === 'beta' ? '#eff6ff' : colors.white,
                }}
                onClick={() => setSelectedPlan(selectedPlan === 'beta' ? 'alacarte' : 'beta')}
                data-testid="toggle-beta"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg" style={{ color: colors.brown }}>Beta</p>
                    <p className="text-sm" style={{ color: colors.brownLight }}>Full access for beta testing</p>
                    <Badge variant="outline" style={{ borderColor: '#3b82f6', color: '#2563eb' }} className="text-xs mt-1">
                      Beta Plan
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold" style={{ color: colors.green }}>FREE</p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>unpublished</p>
                  </div>
                </div>
                <Switch
                  checked={selectedPlan === 'beta'}
                  onCheckedChange={(checked) => setSelectedPlan(checked ? 'beta' : 'alacarte')}
                  className="mt-3"
                  data-testid="switch-beta"
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
              {selectedPlan !== 'premium' && selectedPlan !== 'beta' && selectedPlan !== 'free' && (
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
              {(selectedPlan === 'premium' || selectedPlan === 'beta') && (
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
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-save-subscription"
              >
                {savingSubscription ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>

              {/* Activate / Deactivate */}
              {selectedTenant && (
                <Button
                  variant="outline"
                  className="w-full"
                  style={selectedTenant.is_active
                    ? { borderColor: colors.red, color: colors.red }
                    : { borderColor: colors.green, color: colors.green }
                  }
                  onClick={async () => {
                    await toggleTenantActive(selectedTenant.id, selectedTenant.is_active);
                    setShowSubscriptionDialog(false);
                  }}
                  data-testid={`button-toggle-tenant-${selectedTenant.id}`}
                >
                  {selectedTenant.is_active ? (
                    <><XCircle className="w-4 h-4 mr-1" /> Deactivate Business</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-1" /> Activate Business</>
                  )}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
