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
  Package
} from 'lucide-react';
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

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  subscription_status: string;
  subscription_plan: string;
  is_active: boolean;
  created_at: string;
  user_count?: number;
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

export default function PlatformAdmin() {
  const { user, platformAdmin, isPlatformAdmin, loading: authLoading, signOut } = useAuth();
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

  useEffect(() => {
    if (!authLoading && !isPlatformAdmin) {
      setLocation('/login');
    }
  }, [authLoading, isPlatformAdmin, setLocation]);

  useEffect(() => {
    if (isPlatformAdmin) {
      loadTenants();
      loadSubscriptionData();
    }
  }, [isPlatformAdmin]);

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
    if (selectedPlan === 'test_eval') return 49.99;
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

      if (selectedPlan === 'alacarte' && selectedModules.length > 0) {
        const subsToInsert = selectedModules.map(moduleId => ({
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
          const { count } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          return {
            ...tenant,
            user_count: count || 0,
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
    if (!newTenantName || !newTenantSlug || !ownerEmail || !ownerPassword) {
      toast({ title: 'All fields required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: newTenantName,
          slug: newTenantSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      const { data: brandingData, error: brandingError } = await supabase
        .from('tenant_branding')
        .insert({
          tenant_id: tenantData.id,
          primary_color: '#C4A052',
          secondary_color: '#3D2B1F',
          accent_color: '#8B7355',
          background_color: '#F5F0E1',
          company_name: newTenantName,
        });

      if (brandingError) {
        console.error('Branding error:', brandingError);
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: ownerEmail,
        password: ownerPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            tenant_id: tenantData.id,
            email: ownerEmail,
            full_name: ownerName || ownerEmail.split('@')[0],
            role: 'owner',
            is_active: true,
          });

        if (profileError) throw profileError;
      }

      toast({ title: 'Tenant created successfully!' });
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 bg-slate-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-xl font-bold" data-testid="text-platform-admin-title">Platform Admin</h1>
              <p className="text-sm text-slate-400">{platformAdmin?.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Total Businesses</CardDescription>
              <CardTitle className="text-3xl text-white" data-testid="text-total-tenants">{stats.totalTenants}</CardTitle>
            </CardHeader>
            <CardContent>
              <Building2 className="w-8 h-8 text-blue-400" />
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Active Businesses</CardDescription>
              <CardTitle className="text-3xl text-white" data-testid="text-active-tenants">{stats.activeTenants}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">Total Users</CardDescription>
              <CardTitle className="text-3xl text-white" data-testid="text-total-users">{stats.totalUsers}</CardTitle>
            </CardHeader>
            <CardContent>
              <Users className="w-8 h-8 text-purple-400" />
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-slate-400">On Trial</CardDescription>
              <CardTitle className="text-3xl text-white" data-testid="text-trial-tenants">{stats.trialTenants}</CardTitle>
            </CardHeader>
            <CardContent>
              <Activity className="w-8 h-8 text-yellow-400" />
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Businesses</h2>
          <Dialog open={showNewTenantDialog} onOpenChange={setShowNewTenantDialog}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-add-business">
                <Plus className="w-4 h-4 mr-2" />
                Add Business
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle>Create New Business</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Set up a new tenant with their owner account
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="tenant-name" className="text-slate-200">Business Name</Label>
                  <Input
                    id="tenant-name"
                    value={newTenantName}
                    onChange={(e) => {
                      setNewTenantName(e.target.value);
                      setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }}
                    placeholder="Acme Coffee Shop"
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-tenant-name"
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-slug" className="text-slate-200">URL Slug</Label>
                  <Input
                    id="tenant-slug"
                    value={newTenantSlug}
                    onChange={(e) => setNewTenantSlug(e.target.value)}
                    placeholder="acme-coffee"
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-tenant-slug"
                  />
                </div>
                <hr className="border-slate-600" />
                <div>
                  <Label htmlFor="owner-name" className="text-slate-200">Owner Name</Label>
                  <Input
                    id="owner-name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="John Smith"
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-owner-name"
                  />
                </div>
                <div>
                  <Label htmlFor="owner-email" className="text-slate-200">Owner Email</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@example.com"
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-owner-email"
                  />
                </div>
                <div>
                  <Label htmlFor="owner-password" className="text-slate-200">Temporary Password</Label>
                  <Input
                    id="owner-password"
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Temporary password"
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-owner-password"
                  />
                </div>
                <Button 
                  onClick={handleCreateTenant} 
                  disabled={creating}
                  className="w-full bg-purple-600 hover:bg-purple-700"
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
            <Card key={tenant.id} className="bg-slate-800 border-slate-700">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white" data-testid={`text-tenant-name-${tenant.id}`}>{tenant.name}</h3>
                      <p className="text-sm text-slate-400">{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-400">{tenant.user_count} users</p>
                      <div className="flex gap-2 mt-1">
                        <Badge 
                          variant={tenant.is_active ? 'default' : 'secondary'}
                          className={tenant.is_active ? 'bg-green-600' : 'bg-slate-600'}
                        >
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className="border-slate-500 text-slate-300"
                        >
                          {tenant.subscription_status || 'trial'}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSubscriptionDialog(tenant)}
                      className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
                      data-testid={`button-manage-subscription-${tenant.id}`}
                    >
                      <Package className="w-4 h-4 mr-1" /> Modules
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTenantActive(tenant.id, tenant.is_active)}
                      className={tenant.is_active 
                        ? "border-red-500 text-red-400 hover:bg-red-500/10" 
                        : "border-green-500 text-green-400 hover:bg-green-500/10"
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
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="py-8 text-center text-slate-400">
                No businesses yet. Click "Add Business" to create your first tenant.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Subscription Management Dialog */}
        <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Subscription</DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedTenant?.name} - Configure plan and modules
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Premium Suite Toggle */}
              <div 
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedPlan === 'premium' 
                    ? 'border-purple-500 bg-purple-900/30' 
                    : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                }`}
                onClick={() => setSelectedPlan(selectedPlan === 'premium' ? 'alacarte' : 'premium')}
                data-testid="toggle-premium-suite"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">Premium Suite</p>
                    <p className="text-sm text-slate-400">All 4 modules including Recipe Costing</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-purple-400">$99.99</p>
                    <p className="text-xs text-slate-400">/month</p>
                  </div>
                </div>
                <Switch
                  checked={selectedPlan === 'premium'}
                  onCheckedChange={(checked) => setSelectedPlan(checked ? 'premium' : 'alacarte')}
                  className="mt-3"
                  data-testid="switch-premium"
                />
              </div>

              {/* Test & Eval Option */}
              <div 
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedPlan === 'test_eval' 
                    ? 'border-blue-500 bg-blue-900/30' 
                    : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                }`}
                onClick={() => setSelectedPlan(selectedPlan === 'test_eval' ? 'alacarte' : 'test_eval')}
                data-testid="toggle-test-eval"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">Test & Eval</p>
                    <p className="text-sm text-slate-400">Full access for testing and evaluation</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-400">$49.99</p>
                    <p className="text-xs text-slate-400">/month</p>
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
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedPlan === 'free' 
                      ? 'border-green-500 bg-green-900/30' 
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  }`}
                  onClick={() => setSelectedPlan('free')}
                  data-testid="toggle-free-trial"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Free Trial</p>
                      <p className="text-sm text-slate-400">14-day trial with all features</p>
                    </div>
                    <Badge className="bg-green-600">FREE</Badge>
                  </div>
                </div>
              )}

              {/* À La Carte Modules */}
              {selectedPlan !== 'premium' && selectedPlan !== 'test_eval' && selectedPlan !== 'free' && (
                <div>
                  <Label className="text-slate-200 mb-3 block">À La Carte Modules ($19.99 each)</Label>
                  <div className="space-y-3">
                    {modules.map((module) => {
                      const isSelected = selectedModules.includes(module.id);
                      const isPremiumOnly = module.is_premium_only;
                      
                      return (
                        <div 
                          key={module.id} 
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            isPremiumOnly 
                              ? 'bg-slate-700/50 opacity-60' 
                              : 'bg-slate-700'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{module.name}</p>
                              {isPremiumOnly && (
                                <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
                                  Premium Only
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
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
                  <Label className="text-slate-200 mb-3 block">Included Modules</Label>
                  <div className="space-y-2">
                    {modules.map((module) => (
                      <div key={module.id} className="flex items-center gap-2 p-2 bg-slate-700 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm">{module.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly Total */}
              <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
                <span className="font-semibold">Monthly Total</span>
                <span className="text-2xl font-bold text-green-400">
                  ${calculateMonthlyTotal().toFixed(2)}
                </span>
              </div>

              <Button 
                onClick={saveSubscriptionSettings} 
                disabled={savingSubscription}
                className="w-full bg-purple-600 hover:bg-purple-700"
                data-testid="button-save-subscription"
              >
                {savingSubscription ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
