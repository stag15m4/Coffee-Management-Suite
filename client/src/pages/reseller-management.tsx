import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  RefreshCw
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Footer } from '@/components/Footer';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

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
  created_at: string;
  updated_at: string;
}

interface LicenseCode {
  id: string;
  code: string;
  reseller_id: string;
  tenant_id: string | null;
  subscription_plan: string;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
  tenant_name?: string;
  reseller_name?: string;
}

export default function ResellerManagement() {
  const { user, isPlatformAdmin, loading: authLoading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [licenseCodes, setLicenseCodes] = useState<LicenseCode[]>([]);
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
    notes: '',
    isActive: true,
  });

  const [generateForm, setGenerateForm] = useState({
    count: 1,
    subscriptionPlan: 'premium',
    expiresAt: '',
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

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.id || '',
  });

  const loadResellers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/resellers', {
        headers: getAuthHeaders(),
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

  const loadResellerDetail = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/resellers/${id}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedReseller(data);
        setLicenseCodes(data.licenseCodes || []);
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        toast({ title: 'Success', description: 'Reseller deleted' });
        if (view === 'detail') {
          setView('list');
          setSelectedReseller(null);
        }
        loadResellers();
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          count: generateForm.count,
          subscriptionPlan: generateForm.subscriptionPlan,
          expiresAt: generateForm.expiresAt || null,
        }),
      });

      if (response.ok) {
        const codes = await response.json();
        toast({ 
          title: 'Success', 
          description: `Generated ${codes.length} license code(s)` 
        });
        setShowGenerateCodesDialog(false);
        setGenerateForm({ count: 1, subscriptionPlan: 'premium', expiresAt: '' });
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
        headers: getAuthHeaders(),
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
      notes: '',
      isActive: true,
    });
  };

  const openEditDialog = (reseller: Reseller) => {
    setResellerForm({
      name: reseller.name,
      contactEmail: reseller.contact_email,
      contactName: reseller.contact_name || '',
      phone: reseller.phone || '',
      companyAddress: reseller.company_address || '',
      seatsTotal: reseller.seats_total,
      notes: reseller.notes || '',
      isActive: reseller.is_active,
    });
    setShowEditResellerDialog(true);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return null;
  }

  const colors = {
    cream: '#F5F0E1',
    gold: '#C9A227',
    brown: '#4A3728',
    charcoal: '#1A1A1A',
    inputBg: '#FFFFFF',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: colors.gold }}>
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
            <h1 className="text-2xl font-bold" style={{ color: colors.charcoal }}>
              Wholesale Partners
            </h1>
            <p className="text-sm text-muted-foreground">
              {view === 'list' ? 'Manage resellers and license codes' : selectedReseller?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
                  style={{ backgroundColor: colors.gold }}
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
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.gold }}>
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
            <div className="grid md:grid-cols-3 gap-6 mb-6">
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
                    style={{ backgroundColor: colors.gold }}
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
          </>
        )}
      </main>

      <Footer />

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
              style={{ backgroundColor: colors.gold }}
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
              style={{ backgroundColor: colors.gold }}
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
                  <SelectItem value="premium">Premium Suite ($99.99/mo)</SelectItem>
                  <SelectItem value="alacarte">À La Carte (Individual Modules)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expires">Expiration Date (Optional)</Label>
              <Input
                id="expires"
                type="date"
                value={generateForm.expiresAt}
                onChange={(e) => setGenerateForm({ ...generateForm, expiresAt: e.target.value })}
                data-testid="input-generate-expires"
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
              style={{ backgroundColor: colors.gold }}
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
