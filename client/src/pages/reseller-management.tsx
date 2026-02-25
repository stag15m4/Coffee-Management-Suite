import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Plus,
  LogOut,
  Key,
  Loader2,
  Copy,
  Trash2,
  Edit,
  ChevronLeft,
  Users,
  Package,
  RefreshCw,
  LayoutDashboard,
  Percent,
  Store,
  Globe,
  TrendingUp
} from 'lucide-react';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { colors } from '@/lib/colors';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { showDeleteUndoToast } from '@/hooks/use-delete-with-undo';

interface Reseller {
  id: string;
  name: string;
  contact_email: string;
  contact_name: string | null;
  phone: string | null;
  company_address: string | null;
  seats_total: number;
  seats_used: number;
  stripe_customer_id: string | null;
  notes: string | null;
  is_active: boolean;
  revenue_share_percent: number;
  tier: 'authorized' | 'silver' | 'gold';
  discount_percent: number;
  minimum_seats: number;
  billing_cycle: string;
  annual_commitment: number;
  created_at: string;
  updated_at: string;
}

interface LicenseCode {
  id: string;
  code: string;
  reseller_id: string;
  tenant_id: string | null;
  vertical_id: string | null;
  subscription_plan: string;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
  tenant_name?: string;
  reseller_name?: string;
  vertical_name?: string;
}

interface ResellerVertical {
  id: string;
  slug: string;
  product_name: string;
  display_name: string;
  is_published: boolean;
  tenant_count: number;
  created_at: string;
}

interface ReferredTenant {
  id: string;
  name: string;
  created_at: string;
  vertical_name: string | null;
}

export default function ResellerManagement() {
  const { user, isPlatformAdmin, loading: authLoading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [licenseCodes, setLicenseCodes] = useState<LicenseCode[]>([]);
  const [resellerVerticals, setResellerVerticals] = useState<ResellerVertical[]>([]);
  const [referredTenants, setReferredTenants] = useState<ReferredTenant[]>([]);
  const [allVerticals, setAllVerticals] = useState<ResellerVertical[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'detail'>('list');

  const [showNewResellerDialog, setShowNewResellerDialog] = useState(false);
  const [showEditResellerDialog, setShowEditResellerDialog] = useState(false);
  const [showGenerateCodesDialog, setShowGenerateCodesDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [resellerForm, setResellerForm] = useState({
    name: '',
    contactEmail: '',
    contactName: '',
    phone: '',
    companyAddress: '',
    seatsTotal: 0,
    revenueSharePercent: 0,
    tier: 'authorized' as 'authorized' | 'silver' | 'gold',
    discountPercent: 20,
    minimumSeats: 0,
    billingCycle: 'monthly',
    annualCommitment: 0,
    notes: '',
    isActive: true,
  });

  const [generateForm, setGenerateForm] = useState({
    count: 1,
    subscriptionPlan: 'professional',
    expiresAt: '',
    verticalId: '',
  });

  useEffect(() => {
    if (!authLoading && !isPlatformAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You must be a platform admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/');
    } else if (!authLoading && isPlatformAdmin) {
      loadResellers();
    }
  }, [authLoading, isPlatformAdmin]);

  const getAuthHeaders = async () => {
    const { getAuthHeaders: getHeaders } = await import('@/lib/api-helpers');
    return getHeaders();
  };

  const loadResellers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/resellers', {
        headers: await getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setResellers(data);
      }
    } catch (error) {
      console.error('Failed to load resellers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load resellers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllVerticals = async () => {
    try {
      const response = await fetch('/api/verticals', { headers: await getAuthHeaders() });
      if (response.ok) {
        setAllVerticals(await response.json());
      }
    } catch {
      // Non-critical — vertical picker just won't have options
    }
  };

  const loadResellerDetail = async (id: string) => {
    try {
      setLoading(true);
      const [resellerRes] = await Promise.all([
        fetch(`/api/resellers/${id}`, { headers: await getAuthHeaders() }),
        loadAllVerticals(),
      ]);
      if (resellerRes.ok) {
        const data = await resellerRes.json();
        setSelectedReseller(data);
        setLicenseCodes(data.licenseCodes || []);
        setResellerVerticals(data.verticals || []);
        setReferredTenants(data.referredTenants || []);
        setView('detail');
      }
    } catch (error) {
      console.error('Failed to load reseller:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReseller = async () => {
    try {
      setProcessing(true);
      const response = await fetch('/api/resellers', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(resellerForm),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Reseller created successfully' });
        setShowNewResellerDialog(false);
        resetResellerForm();
        loadResellers();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create reseller');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateReseller = async () => {
    if (!selectedReseller) return;
    
    try {
      setProcessing(true);
      const response = await fetch(`/api/resellers/${selectedReseller.id}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(resellerForm),
      });

      if (response.ok) {
        const updated = await response.json();
        setSelectedReseller(updated);
        toast({ title: 'Success', description: 'Reseller updated successfully' });
        setShowEditResellerDialog(false);
        loadResellers();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update reseller');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteReseller = async (id: string) => {
    const name = resellers.find(r => r.id === id)?.name || 'this reseller';
    if (!await confirm({ title: `Delete ${name}?`, description: 'This will also delete all their license codes.', confirmLabel: 'Delete', variant: 'destructive' })) {
      return;
    }

    try {
      const response = await fetch(`/api/resellers/${id}`, { 
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (response.ok) {
        if (view === 'detail') {
          setView('list');
          setSelectedReseller(null);
        }
        loadResellers();
        showDeleteUndoToast({ itemName: name, undo: { type: 'none' } });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete reseller',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateCodes = async () => {
    if (!selectedReseller) return;

    try {
      setProcessing(true);
      const response = await fetch(`/api/resellers/${selectedReseller.id}/generate-codes`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          count: generateForm.count,
          subscriptionPlan: generateForm.subscriptionPlan,
          expiresAt: generateForm.expiresAt || null,
          verticalId: generateForm.verticalId || null,
        }),
      });

      if (response.ok) {
        const codes = await response.json();
        toast({ 
          title: 'Success', 
          description: `Generated ${codes.length} license code(s)` 
        });
        setShowGenerateCodesDialog(false);
        setGenerateForm({ count: 1, subscriptionPlan: 'premium', expiresAt: '', verticalId: '' });
        loadResellerDetail(selectedReseller.id);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate codes');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteLicenseCode = async (id: string) => {
    try {
      const response = await fetch(`/api/license-codes/${id}`, { 
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (response.ok) {
        toast({ title: 'Success', description: 'License code deleted' });
        if (selectedReseller) {
          loadResellerDetail(selectedReseller.id);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Cannot delete redeemed code');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'License code copied to clipboard' });
  };

  const resetResellerForm = () => {
    setResellerForm({
      name: '',
      contactEmail: '',
      contactName: '',
      phone: '',
      companyAddress: '',
      seatsTotal: 0,
      revenueSharePercent: 0,
      tier: 'authorized',
      discountPercent: 20,
      minimumSeats: 0,
      billingCycle: 'monthly',
      annualCommitment: 0,
      notes: '',
      isActive: true,
    });
  };

  const tierDefaults: Record<string, number> = { authorized: 20, silver: 30, gold: 40 };

  const openEditDialog = (reseller: Reseller) => {
    setResellerForm({
      name: reseller.name,
      contactEmail: reseller.contact_email,
      contactName: reseller.contact_name || '',
      phone: reseller.phone || '',
      companyAddress: reseller.company_address || '',
      seatsTotal: reseller.seats_total,
      revenueSharePercent: reseller.revenue_share_percent || 0,
      tier: reseller.tier || 'authorized',
      discountPercent: reseller.discount_percent || 20,
      minimumSeats: reseller.minimum_seats || 0,
      billingCycle: reseller.billing_cycle || 'monthly',
      annualCommitment: reseller.annual_commitment || 0,
      notes: reseller.notes || '',
      isActive: reseller.is_active,
    });
    setShowEditResellerDialog(true);
  };

  if (authLoading || loading) {
    return <CoffeeLoader fullScreen />;
  }

  if (!isPlatformAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {view === 'detail' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setView('list'); setSelectedReseller(null); }}
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              Wholesale Partners
            </h1>
            <p className="text-sm text-muted-foreground">
              {view === 'list' ? 'Manage resellers and license codes' : selectedReseller?.name}
            </p>
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
            onClick={() => setLocation('/platform-admin')}
            data-testid="button-platform-admin"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Admin Dashboard
          </Button>
          <Button variant="outline" onClick={() => signOut()} data-testid="button-signout">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {view === 'list' ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  <Users className="w-4 h-4 mr-2" />
                  {resellers.length} Partners
                </Badge>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  <Package className="w-4 h-4 mr-2" />
                  {resellers.reduce((sum, r) => sum + r.seats_total, 0)} Total Seats
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadResellers} data-testid="button-refresh">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  onClick={() => { resetResellerForm(); setShowNewResellerDialog(true); }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-6 rounded-xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
                  data-testid="button-add-reseller"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reseller
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {resellers.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No resellers yet. Add your first wholesale partner.</p>
                  </CardContent>
                </Card>
              ) : (
                resellers.map((reseller) => (
                  <Card 
                    key={reseller.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => loadResellerDetail(reseller.id)}
                    data-testid={`card-reseller-${reseller.id}`}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{reseller.name}</h3>
                          <p className="text-sm text-muted-foreground">{reseller.contact_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">{reseller.seats_used} / {reseller.seats_total}</p>
                          <p className="text-sm text-muted-foreground">Seats Used</p>
                        </div>
                        <Badge variant={reseller.is_active ? 'default' : 'secondary'}>
                          {reseller.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        ) : selectedReseller && (
          <>
            <div className="grid md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tier</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    className="text-base px-3 py-1"
                    style={{
                      backgroundColor: selectedReseller.tier === 'gold' ? '#EAB308' :
                        selectedReseller.tier === 'silver' ? '#9CA3AF' : colors.gold,
                      color: 'white',
                    }}
                  >
                    {(selectedReseller.tier || 'authorized').charAt(0).toUpperCase() + (selectedReseller.tier || 'authorized').slice(1)}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedReseller.discount_percent || 20}% discount
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Seats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{selectedReseller.seats_total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Seats Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{selectedReseller.seats_used}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {selectedReseller.seats_total - selectedReseller.seats_used}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Share</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" style={{ color: colors.gold }}>
                    {selectedReseller.revenue_share_percent || 0}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Partner Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Contact Email</Label>
                    <p>{selectedReseller.contact_email}</p>
                  </div>
                  {selectedReseller.contact_name && (
                    <div>
                      <Label className="text-muted-foreground">Contact Name</Label>
                      <p>{selectedReseller.contact_name}</p>
                    </div>
                  )}
                  {selectedReseller.phone && (
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p>{selectedReseller.phone}</p>
                    </div>
                  )}
                  {selectedReseller.company_address && (
                    <div>
                      <Label className="text-muted-foreground">Address</Label>
                      <p>{selectedReseller.company_address}</p>
                    </div>
                  )}
                  {selectedReseller.notes && (
                    <div>
                      <Label className="text-muted-foreground">Notes</Label>
                      <p>{selectedReseller.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => openEditDialog(selectedReseller)}
                      data-testid="button-edit-reseller"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleDeleteReseller(selectedReseller.id)}
                      data-testid="button-delete-reseller"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle>License Codes</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowGenerateCodesDialog(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="button-generate-codes"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Generate Codes
                  </Button>
                </CardHeader>
                <CardContent>
                  {licenseCodes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No license codes yet</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {licenseCodes.map((code) => (
                        <div 
                          key={code.id} 
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                          data-testid={`license-code-${code.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm">{code.code}</code>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(code.code)}
                              data-testid={`button-copy-code-${code.id}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            {code.vertical_name && (
                              <Badge variant="outline" className="text-xs">
                                <Store className="w-3 h-3 mr-1" />
                                {code.vertical_name}
                              </Badge>
                            )}
                            {code.redeemed_at ? (
                              <Badge variant="secondary">
                                Redeemed: {code.tenant_name || 'Unknown'}
                              </Badge>
                            ) : (
                              <>
                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                  Available
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleDeleteLicenseCode(code.id)}
                                  data-testid={`button-delete-code-${code.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
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
            </div>

            {/* Custom Verticals */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Custom Verticals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {resellerVerticals.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No custom verticals yet. Verticals created for this reseller will appear here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {resellerVerticals.map((v) => (
                        <div key={v.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div>
                            <p className="font-medium">{v.display_name}</p>
                            <p className="text-xs text-muted-foreground">{v.product_name} &middot; /{v.slug}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              {v.tenant_count} tenants
                            </Badge>
                            <Badge variant={v.is_published ? 'default' : 'secondary'}>
                              {v.is_published ? 'Published' : 'Draft'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Referred Tenants */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Referred Tenants
                  </CardTitle>
                  <Badge variant="outline">{referredTenants.length} total</Badge>
                </CardHeader>
                <CardContent>
                  {referredTenants.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No tenants have redeemed codes from this reseller yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {referredTenants.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div>
                            <p className="font-medium text-sm">{t.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Joined {new Date(t.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {t.vertical_name && (
                            <Badge variant="outline" className="text-xs">
                              {t.vertical_name}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      <Dialog open={showNewResellerDialog} onOpenChange={setShowNewResellerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Reseller</DialogTitle>
            <DialogDescription>
              Create a new wholesale partner account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={resellerForm.name}
                onChange={(e) => setResellerForm({ ...resellerForm, name: e.target.value })}
                placeholder="Fortuna Enterprises"
                data-testid="input-reseller-name"
              />
            </div>
            <div>
              <Label htmlFor="email">Contact Email *</Label>
              <Input
                id="email"
                type="email"
                value={resellerForm.contactEmail}
                onChange={(e) => setResellerForm({ ...resellerForm, contactEmail: e.target.value })}
                placeholder="contact@fortuna.com"
                data-testid="input-reseller-email"
              />
            </div>
            <div>
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={resellerForm.contactName}
                onChange={(e) => setResellerForm({ ...resellerForm, contactName: e.target.value })}
                placeholder="John Smith"
                data-testid="input-reseller-contact-name"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={resellerForm.phone}
                onChange={(e) => setResellerForm({ ...resellerForm, phone: e.target.value })}
                placeholder="(555) 123-4567"
                data-testid="input-reseller-phone"
              />
            </div>
            <div>
              <Label htmlFor="seats">Total Seats *</Label>
              <Input
                id="seats"
                type="number"
                min="0"
                value={resellerForm.seatsTotal}
                onChange={(e) => setResellerForm({ ...resellerForm, seatsTotal: parseInt(e.target.value) || 0 })}
                data-testid="input-reseller-seats"
              />
            </div>
            <div>
              <Label htmlFor="tier">Partner Tier</Label>
              <Select
                value={resellerForm.tier}
                onValueChange={(value: 'authorized' | 'silver' | 'gold') => setResellerForm({
                  ...resellerForm,
                  tier: value,
                  discountPercent: tierDefaults[value] || 20,
                })}
              >
                <SelectTrigger data-testid="select-reseller-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="authorized">Authorized (20% discount)</SelectItem>
                  <SelectItem value="silver">Silver (30% discount)</SelectItem>
                  <SelectItem value="gold">Gold (40% discount)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="discountPercent">Wholesale Discount %</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={resellerForm.discountPercent}
                  onChange={(e) => setResellerForm({ ...resellerForm, discountPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="minimumSeats">Minimum Seats</Label>
                <Input
                  id="minimumSeats"
                  type="number"
                  min="0"
                  value={resellerForm.minimumSeats}
                  onChange={(e) => setResellerForm({ ...resellerForm, minimumSeats: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="billingCycle">Billing Cycle</Label>
                <Select
                  value={resellerForm.billingCycle}
                  onValueChange={(value) => setResellerForm({ ...resellerForm, billingCycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="revenueShare">Revenue Share %</Label>
                <Input
                  id="revenueShare"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={resellerForm.revenueSharePercent}
                  onChange={(e) => setResellerForm({ ...resellerForm, revenueSharePercent: parseFloat(e.target.value) || 0 })}
                  data-testid="input-reseller-revenue-share"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={resellerForm.notes}
                onChange={(e) => setResellerForm({ ...resellerForm, notes: e.target.value })}
                placeholder="Internal notes about this partner..."
                data-testid="input-reseller-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewResellerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateReseller}
              disabled={processing || !resellerForm.name || !resellerForm.contactEmail}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-submit-reseller"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Reseller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditResellerDialog} onOpenChange={setShowEditResellerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reseller</DialogTitle>
            <DialogDescription>
              Update wholesale partner details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Company Name *</Label>
              <Input
                id="edit-name"
                value={resellerForm.name}
                onChange={(e) => setResellerForm({ ...resellerForm, name: e.target.value })}
                data-testid="input-edit-reseller-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Contact Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={resellerForm.contactEmail}
                onChange={(e) => setResellerForm({ ...resellerForm, contactEmail: e.target.value })}
                data-testid="input-edit-reseller-email"
              />
            </div>
            <div>
              <Label htmlFor="edit-contactName">Contact Name</Label>
              <Input
                id="edit-contactName"
                value={resellerForm.contactName}
                onChange={(e) => setResellerForm({ ...resellerForm, contactName: e.target.value })}
                data-testid="input-edit-reseller-contact-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={resellerForm.phone}
                onChange={(e) => setResellerForm({ ...resellerForm, phone: e.target.value })}
                data-testid="input-edit-reseller-phone"
              />
            </div>
            <div>
              <Label htmlFor="edit-seats">Total Seats *</Label>
              <Input
                id="edit-seats"
                type="number"
                min="0"
                value={resellerForm.seatsTotal}
                onChange={(e) => setResellerForm({ ...resellerForm, seatsTotal: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-reseller-seats"
              />
            </div>
            <div>
              <Label htmlFor="edit-tier">Partner Tier</Label>
              <Select
                value={resellerForm.tier}
                onValueChange={(value: 'authorized' | 'silver' | 'gold') => setResellerForm({
                  ...resellerForm,
                  tier: value,
                  discountPercent: tierDefaults[value] || 20,
                })}
              >
                <SelectTrigger data-testid="select-edit-reseller-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="authorized">Authorized (20% discount)</SelectItem>
                  <SelectItem value="silver">Silver (30% discount)</SelectItem>
                  <SelectItem value="gold">Gold (40% discount)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-discountPercent">Wholesale Discount %</Label>
                <Input
                  id="edit-discountPercent"
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={resellerForm.discountPercent}
                  onChange={(e) => setResellerForm({ ...resellerForm, discountPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="edit-minimumSeats">Minimum Seats</Label>
                <Input
                  id="edit-minimumSeats"
                  type="number"
                  min="0"
                  value={resellerForm.minimumSeats}
                  onChange={(e) => setResellerForm({ ...resellerForm, minimumSeats: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-billingCycle">Billing Cycle</Label>
                <Select
                  value={resellerForm.billingCycle}
                  onValueChange={(value) => setResellerForm({ ...resellerForm, billingCycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-revenueShare">Revenue Share %</Label>
                <Input
                  id="edit-revenueShare"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={resellerForm.revenueSharePercent}
                  onChange={(e) => setResellerForm({ ...resellerForm, revenueSharePercent: parseFloat(e.target.value) || 0 })}
                  data-testid="input-edit-reseller-revenue-share"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={resellerForm.notes}
                onChange={(e) => setResellerForm({ ...resellerForm, notes: e.target.value })}
                data-testid="input-edit-reseller-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditResellerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateReseller}
              disabled={processing || !resellerForm.name || !resellerForm.contactEmail}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-update-reseller"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateCodesDialog} onOpenChange={setShowGenerateCodesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate License Codes</DialogTitle>
            <DialogDescription>
              Create new license codes for {selectedReseller?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="count">Number of Codes</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="100"
                value={generateForm.count}
                onChange={(e) => setGenerateForm({ ...generateForm, count: parseInt(e.target.value) || 1 })}
                data-testid="input-generate-count"
              />
            </div>
            <div>
              <Label htmlFor="plan">Subscription Plan</Label>
              <Select 
                value={generateForm.subscriptionPlan}
                onValueChange={(value) => setGenerateForm({ ...generateForm, subscriptionPlan: value })}
              >
                <SelectTrigger data-testid="select-subscription-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional ($99/mo per location)</SelectItem>
                  <SelectItem value="essential">Essential ($49/mo per location)</SelectItem>
                  <SelectItem value="alacarte">À La Carte ($29/mo per module)</SelectItem>
                  <SelectItem value="premium">Premium Suite (Legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="vertical">Vertical (Optional)</Label>
              <Select
                value={generateForm.verticalId}
                onValueChange={(value) => setGenerateForm({ ...generateForm, verticalId: value === 'none' ? '' : value })}
              >
                <SelectTrigger data-testid="select-vertical">
                  <SelectValue placeholder="Any vertical" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any vertical</SelectItem>
                  {allVerticals.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                If set, redeemed tenants will auto-assign to this vertical.
              </p>
            </div>
            <div>
              <Label htmlFor="expires">Expiration Date (Optional)</Label>
              <Input
                id="expires"
                type="date"
                value={generateForm.expiresAt}
                onChange={(e) => setGenerateForm({ ...generateForm, expiresAt: e.target.value })}
                data-testid="input-generate-expires"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            {selectedReseller && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Available seats: {selectedReseller.seats_total - selectedReseller.seats_used - 
                    licenseCodes.filter(c => !c.redeemed_at).length}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateCodesDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateCodes}
              disabled={processing || generateForm.count < 1}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-submit-generate"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate {generateForm.count} Code(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
