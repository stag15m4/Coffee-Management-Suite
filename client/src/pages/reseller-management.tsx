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
    if (!confirm('Are you sure you want to delete this reseller? This will also delete all their license codes.')) {
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
    <div className="min-h-screen flex flex-col bg-slate-900 text-white">
      <header className="border-b border-slate-700 bg-slate-800">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {view === 'detail' && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setView('list'); setSelectedReseller(null); }}
                className="text-slate-300"
                data-testid="button-back"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <img src="/logo.png" alt="Platform Logo" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-amber-400" data-testid="text-wholesale-title">
                Wholesale Partners
              </h1>
              <p className="text-sm text-slate-400">
                {view === 'list' ? 'Manage resellers and license codes' : selectedReseller?.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/platform-admin')}
              className="border-slate-600 text-slate-300"
              data-testid="button-platform-admin"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={() => signOut()} 
              className="border-slate-600 text-slate-300"
              data-testid="button-signout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {view === 'list' ? (
          <>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="text-base px-3 py-1.5 border-slate-600 text-slate-300">
                  <Users className="w-4 h-4 mr-2" />
                  {resellers.length} Partners
                </Badge>
                <Badge variant="outline" className="text-base px-3 py-1.5 border-slate-600 text-slate-300">
                  <Package className="w-4 h-4 mr-2" />
                  {resellers.reduce((sum, r) => sum + r.seats_total, 0)} Total Seats
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={loadResellers} 
                  className="border-slate-600 text-slate-300"
                  data-testid="button-refresh"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button 
                  onClick={() => { resetResellerForm(); setShowNewResellerDialog(true); }}
                  className="bg-purple-600"
                  data-testid="button-add-reseller"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reseller
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {resellers.length === 0 ? (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Building2 className="w-12 h-12 text-slate-500 mb-4" />
                    <p className="text-slate-400">No resellers yet. Add your first wholesale partner.</p>
                  </CardContent>
                </Card>
              ) : (
                resellers.map((reseller) => (
                  <Card 
                    key={reseller.id} 
                    className="bg-slate-800 border-slate-700 cursor-pointer hover-elevate"
                    onClick={() => loadResellerDetail(reseller.id)}
                    data-testid={`card-reseller-${reseller.id}`}
                  >
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-purple-600">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white truncate">{reseller.name}</h3>
                          <p className="text-sm text-slate-400 truncate">{reseller.contact_email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-left sm:text-right">
                          <p className="font-semibold text-white">{reseller.seats_used} / {reseller.seats_total}</p>
                          <p className="text-sm text-slate-400">Seats Used</p>
                        </div>
                        <Badge 
                          variant={reseller.is_active ? 'default' : 'secondary'}
                          className={reseller.is_active ? 'bg-green-600' : 'bg-slate-600'}
                        >
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-400">Total Seats</CardDescription>
                  <CardTitle className="text-3xl text-white">{selectedReseller.seats_total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Package className="w-8 h-8 text-blue-400" />
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-400">Seats Used</CardDescription>
                  <CardTitle className="text-3xl text-white">{selectedReseller.seats_used}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Users className="w-8 h-8 text-purple-400" />
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardDescription className="text-slate-400">Available</CardDescription>
                  <CardTitle className="text-3xl text-green-400">
                    {selectedReseller.seats_total - selectedReseller.seats_used}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Key className="w-8 h-8 text-green-400" />
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Partner Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-slate-400">Contact Email</Label>
                    <p className="text-white">{selectedReseller.contact_email}</p>
                  </div>
                  {selectedReseller.contact_name && (
                    <div>
                      <Label className="text-slate-400">Contact Name</Label>
                      <p className="text-white">{selectedReseller.contact_name}</p>
                    </div>
                  )}
                  {selectedReseller.phone && (
                    <div>
                      <Label className="text-slate-400">Phone</Label>
                      <p className="text-white">{selectedReseller.phone}</p>
                    </div>
                  )}
                  {selectedReseller.company_address && (
                    <div>
                      <Label className="text-slate-400">Address</Label>
                      <p className="text-white">{selectedReseller.company_address}</p>
                    </div>
                  )}
                  {selectedReseller.notes && (
                    <div>
                      <Label className="text-slate-400">Notes</Label>
                      <p className="text-white">{selectedReseller.notes}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => openEditDialog(selectedReseller)}
                      className="border-slate-600 text-slate-300"
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

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-white">License Codes</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowGenerateCodesDialog(true)}
                    className="bg-purple-600"
                    data-testid="button-generate-codes"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Generate Codes
                  </Button>
                </CardHeader>
                <CardContent>
                  {licenseCodes.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No license codes yet</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {licenseCodes.map((code) => (
                        <div 
                          key={code.id} 
                          className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-700 rounded-md"
                          data-testid={`license-code-${code.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm text-white">{code.code}</code>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-slate-400"
                              onClick={() => copyToClipboard(code.code)}
                              data-testid={`button-copy-code-${code.id}`}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            {code.redeemed_at ? (
                              <Badge variant="secondary" className="bg-slate-600 text-slate-300">
                                Redeemed: {code.tenant_name || 'Unknown'}
                              </Badge>
                            ) : (
                              <>
                                <Badge className="bg-green-600 text-white">
                                  Available
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-slate-400"
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
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Reseller</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new wholesale partner account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-slate-200">Company Name *</Label>
              <Input
                id="name"
                value={resellerForm.name}
                onChange={(e) => setResellerForm({ ...resellerForm, name: e.target.value })}
                placeholder="Fortuna Enterprises"
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-reseller-name"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-slate-200">Contact Email *</Label>
              <Input
                id="email"
                type="email"
                value={resellerForm.contactEmail}
                onChange={(e) => setResellerForm({ ...resellerForm, contactEmail: e.target.value })}
                placeholder="contact@fortuna.com"
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-reseller-email"
              />
            </div>
            <div>
              <Label htmlFor="contactName" className="text-slate-200">Contact Name</Label>
              <Input
                id="contactName"
                value={resellerForm.contactName}
                onChange={(e) => setResellerForm({ ...resellerForm, contactName: e.target.value })}
                placeholder="John Smith"
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-reseller-contact-name"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-slate-200">Phone</Label>
              <Input
                id="phone"
                value={resellerForm.phone}
                onChange={(e) => setResellerForm({ ...resellerForm, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-reseller-phone"
              />
            </div>
            <div>
              <Label htmlFor="seats" className="text-slate-200">Total Seats *</Label>
              <Input
                id="seats"
                type="number"
                min="0"
                value={resellerForm.seatsTotal}
                onChange={(e) => setResellerForm({ ...resellerForm, seatsTotal: parseInt(e.target.value) || 0 })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-reseller-seats"
              />
            </div>
            <div>
              <Label htmlFor="notes" className="text-slate-200">Notes</Label>
              <Textarea
                id="notes"
                value={resellerForm.notes}
                onChange={(e) => setResellerForm({ ...resellerForm, notes: e.target.value })}
                placeholder="Internal notes about this partner..."
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-reseller-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewResellerDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateReseller} 
              disabled={processing || !resellerForm.name || !resellerForm.contactEmail}
              className="bg-purple-600"
              data-testid="button-submit-reseller"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Reseller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditResellerDialog} onOpenChange={setShowEditResellerDialog}>
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Reseller</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update wholesale partner details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-slate-200">Company Name *</Label>
              <Input
                id="edit-name"
                value={resellerForm.name}
                onChange={(e) => setResellerForm({ ...resellerForm, name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-edit-reseller-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email" className="text-slate-200">Contact Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={resellerForm.contactEmail}
                onChange={(e) => setResellerForm({ ...resellerForm, contactEmail: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-edit-reseller-email"
              />
            </div>
            <div>
              <Label htmlFor="edit-contactName" className="text-slate-200">Contact Name</Label>
              <Input
                id="edit-contactName"
                value={resellerForm.contactName}
                onChange={(e) => setResellerForm({ ...resellerForm, contactName: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-edit-reseller-contact-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone" className="text-slate-200">Phone</Label>
              <Input
                id="edit-phone"
                value={resellerForm.phone}
                onChange={(e) => setResellerForm({ ...resellerForm, phone: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-edit-reseller-phone"
              />
            </div>
            <div>
              <Label htmlFor="edit-seats" className="text-slate-200">Total Seats *</Label>
              <Input
                id="edit-seats"
                type="number"
                min="0"
                value={resellerForm.seatsTotal}
                onChange={(e) => setResellerForm({ ...resellerForm, seatsTotal: parseInt(e.target.value) || 0 })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-edit-reseller-seats"
              />
            </div>
            <div>
              <Label htmlFor="edit-notes" className="text-slate-200">Notes</Label>
              <Textarea
                id="edit-notes"
                value={resellerForm.notes}
                onChange={(e) => setResellerForm({ ...resellerForm, notes: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-edit-reseller-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditResellerDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateReseller} 
              disabled={processing || !resellerForm.name || !resellerForm.contactEmail}
              className="bg-purple-600"
              data-testid="button-update-reseller"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateCodesDialog} onOpenChange={setShowGenerateCodesDialog}>
        <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Generate License Codes</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create new license codes for {selectedReseller?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="count" className="text-slate-200">Number of Codes</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="100"
                value={generateForm.count}
                onChange={(e) => setGenerateForm({ ...generateForm, count: parseInt(e.target.value) || 1 })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-generate-count"
              />
            </div>
            <div>
              <Label htmlFor="plan" className="text-slate-200">Subscription Plan</Label>
              <Select 
                value={generateForm.subscriptionPlan}
                onValueChange={(value) => setGenerateForm({ ...generateForm, subscriptionPlan: value })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-subscription-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="premium">Premium Suite ($99.99/mo)</SelectItem>
                  <SelectItem value="alacarte">À La Carte (Individual Modules)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expires" className="text-slate-200">Expiration Date (Optional)</Label>
              <Input
                id="expires"
                type="date"
                value={generateForm.expiresAt}
                onChange={(e) => setGenerateForm({ ...generateForm, expiresAt: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-generate-expires"
              />
            </div>
            {selectedReseller && (
              <div className="p-3 bg-slate-700 rounded-md">
                <p className="text-sm text-slate-300">
                  Available seats: {selectedReseller.seats_total - selectedReseller.seats_used - 
                    licenseCodes.filter(c => !c.redeemed_at).length}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateCodesDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateCodes} 
              disabled={processing || generateForm.count < 1}
              className="bg-purple-600"
              data-testid="button-submit-generate"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate {generateForm.count} Code(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
