import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useAppResume } from '@/hooks/use-app-resume';
import { Link } from 'wouter';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Building2, 
  Plus, 
  Edit2, 
  Trash2, 
  Users,
  MapPin
} from 'lucide-react';
import { Footer } from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';

interface Location {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  parent_tenant_id: string | null;
  starting_drawer_default: number | null;
}

interface LocationUsage {
  current_count: number;
  max_allowed: number;
  can_add: boolean;
  remaining: number;
}

export default function AdminLocations() {
  const { profile, tenant, branding } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [locationUsage, setLocationUsage] = useState<LocationUsage | null>(null);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    starting_drawer_default: '200.00'
  });

  const companyName = branding?.company_name || tenant?.name || 'Organization';

  const loadData = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);

    try {
      // Fetch child locations
      const { data: childLocations, error: locError } = await supabase
        .from('tenants')
        .select('*')
        .eq('parent_tenant_id', tenant.id)
        .order('name');

      if (locError) throw locError;
      setLocations(childLocations || []);

      // Get user counts for each location
      const counts: Record<string, number> = {};
      for (const loc of (childLocations || [])) {
        const { count } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', loc.id);
        counts[loc.id] = count || 0;
      }
      setUserCounts(counts);

      // Fetch location usage limits
      const { data: usageData, error: usageError } = await supabase
        .rpc('get_tenant_location_usage', { p_tenant_id: tenant.id });
      
      if (usageError) {
        console.warn('Could not fetch location usage:', usageError.message);
        // Default to disabling adds if function doesn't exist - fail safe
        const currentCount = (childLocations?.filter(l => l.is_active)?.length || 0) + 1;
        setLocationUsage({ current_count: currentCount, max_allowed: currentCount, can_add: false, remaining: 0 });
      } else {
        setLocationUsage(usageData);
      }
    } catch (error: any) {
      console.error('Error loading locations:', error);
      toast({ title: 'Error loading locations', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, toast]);

  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
  }, [tenant?.id, loadData]);

  useAppResume(() => {
    if (tenant?.id) {
      console.log('[AdminLocations] Refreshing data after app resume');
      loadData();
    }
  }, [tenant?.id, loadData]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingLocation ? prev.slug : generateSlug(name)
    }));
  };

  const handleSave = async () => {
    if (!tenant?.id || !formData.name.trim() || !formData.slug.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('tenants')
          .update({
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            starting_drawer_default: parseFloat(formData.starting_drawer_default) || 200,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingLocation.id);

        if (error) throw error;
        toast({ title: 'Location updated successfully' });
      } else {
        // Create new location
        const { error } = await supabase
          .from('tenants')
          .insert({
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            starting_drawer_default: parseFloat(formData.starting_drawer_default) || 200,
            parent_tenant_id: tenant.id,
            is_active: true
          });

        if (error) throw error;
        toast({ title: 'Location created successfully' });
      }

      setShowAddDialog(false);
      setEditingLocation(null);
      setFormData({ name: '', slug: '', starting_drawer_default: '200.00' });
      loadData();
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast({ title: 'Error saving location', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!locationToDelete) return;

    setSaving(true);
    try {
      // Soft delete - just set is_active to false
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', locationToDelete.id);

      if (error) throw error;
      toast({ title: 'Location deactivated successfully' });
      setLocationToDelete(null);
      loadData();
    } catch (error: any) {
      console.error('Error deleting location:', error);
      toast({ title: 'Error deleting location', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleLocationActive = async (location: Location) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: !location.is_active, updated_at: new Date().toISOString() })
        .eq('id', location.id);

      if (error) throw error;
      toast({ title: location.is_active ? 'Location deactivated' : 'Location activated' });
      loadData();
    } catch (error: any) {
      console.error('Error toggling location:', error);
      toast({ title: 'Error updating location', description: error.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      slug: location.slug,
      starting_drawer_default: (location.starting_drawer_default ?? 200).toString()
    });
    setShowAddDialog(true);
  };

  if (profile?.role !== 'owner') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="py-8 text-center">
            <p style={{ color: colors.brown }}>Only owners can manage locations.</p>
            <Link href="/dashboard">
              <Button className="mt-4" style={{ backgroundColor: colors.gold, color: colors.brown }}>
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/organization">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" style={{ color: colors.brown }} />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold" style={{ color: colors.brown }}>Manage Locations</h1>
              <p className="text-sm" style={{ color: colors.brownLight }}>{companyName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold" style={{ color: colors.brown }}>
              Your Locations
            </h2>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Add and manage locations for your organization
            </p>
          </div>
          <div className="flex items-center gap-4">
            {locationUsage && (
              <div className="text-right">
                <p className="text-sm font-medium" style={{ color: colors.brown }}>
                  {locationUsage.current_count} of {locationUsage.max_allowed} locations
                </p>
                {!locationUsage.can_add && (
                  <p className="text-xs text-orange-600">
                    Upgrade your plan for more locations
                  </p>
                )}
              </div>
            )}
            <Button
              onClick={() => {
                setEditingLocation(null);
                setFormData({ name: '', slug: '', starting_drawer_default: '200.00' });
                setShowAddDialog(true);
              }}
              disabled={locationUsage !== null && !locationUsage.can_add}
              style={{ 
                backgroundColor: locationUsage?.can_add !== false ? colors.gold : colors.creamDark, 
                color: colors.brown 
              }}
              data-testid="button-add-location"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12">
            <CoffeeLoader text="Brewing..." />
          </div>
        ) : locations.length === 0 ? (
          <Card style={{ backgroundColor: colors.white, borderStyle: 'dashed' }}>
            <CardContent className="py-12 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4" style={{ color: colors.creamDark }} />
              <h3 className="font-bold mb-2" style={{ color: colors.brown }}>
                No Additional Locations
              </h3>
              <p className="mb-4" style={{ color: colors.brownLight }}>
                You haven't added any additional locations yet. Add your first location to start managing multiple sites.
              </p>
              <Button
                onClick={() => {
                  setEditingLocation(null);
                  setFormData({ name: '', slug: '', starting_drawer_default: '200.00' });
                  setShowAddDialog(true);
                }}
                disabled={locationUsage !== null && !locationUsage.can_add}
                style={{ 
                  backgroundColor: locationUsage?.can_add !== false ? colors.gold : colors.creamDark, 
                  color: colors.brown 
                }}
                data-testid="button-add-first-location"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Location
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <Card 
                key={location.id}
                style={{ 
                  backgroundColor: colors.white,
                  opacity: location.is_active ? 1 : 0.6
                }}
                data-testid={`card-location-${location.slug}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: colors.cream }}
                      >
                        <Building2 className="w-6 h-6" style={{ color: colors.gold }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold" style={{ color: colors.brown }}>
                            {location.name}
                          </h3>
                          {!location.is_active && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm" style={{ color: colors.brownLight }}>
                          {location.slug} • {userCounts[location.id] || 0} team members • Drawer: ${(location.starting_drawer_default ?? 200).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-4">
                        <Switch
                          checked={location.is_active}
                          onCheckedChange={() => toggleLocationActive(location)}
                          data-testid={`switch-active-${location.slug}`}
                        />
                        <span className="text-sm" style={{ color: colors.brownLight }}>
                          Active
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(location)}
                        data-testid={`button-edit-${location.slug}`}
                      >
                        <Edit2 className="w-4 h-4" style={{ color: colors.brownLight }} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLocationToDelete(location)}
                        data-testid={`button-delete-${location.slug}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Location Info */}
        <Card className="mt-8" style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle style={{ color: colors.brown }}>Main Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: colors.gold }}
              >
                <Building2 className="w-6 h-6" style={{ color: colors.brown }} />
              </div>
              <div>
                <h3 className="font-bold" style={{ color: colors.brown }}>
                  {tenant?.name}
                </h3>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  This is your primary location. Child locations roll up to this main account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </DialogTitle>
            <DialogDescription style={{ color: colors.brownLight }}>
              {editingLocation 
                ? 'Update the location details below.'
                : 'Enter the details for your new location.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: colors.brown }}>Location Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Downtown Branch"
                style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
                data-testid="input-location-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" style={{ color: colors.brown }}>URL Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: generateSlug(e.target.value) })}
                placeholder="e.g., downtown-branch"
                style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
                data-testid="input-location-slug"
              />
              <p className="text-xs" style={{ color: colors.brownLight }}>
                This will be used in URLs and must be unique.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="starting-drawer" style={{ color: colors.brown }}>Starting Drawer</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="starting-drawer"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={formData.starting_drawer_default}
                  onChange={(e) => setFormData({ ...formData, starting_drawer_default: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  className="pl-7"
                  placeholder="200.00"
                  style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
                  data-testid="input-starting-drawer"
                />
              </div>
              <p className="text-xs" style={{ color: colors.brownLight }}>
                Default starting drawer amount for Cash Deposit entries.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingLocation(null);
                setFormData({ name: '', slug: '', starting_drawer_default: '200.00' });
              }}
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name.trim() || !formData.slug.trim()}
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-save-location"
            >
              {saving ? 'Saving...' : editingLocation ? 'Update' : 'Create Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!locationToDelete} onOpenChange={() => setLocationToDelete(null)}>
        <AlertDialogContent style={{ backgroundColor: colors.white }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: colors.brown }}>
              Deactivate Location?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: colors.brownLight }}>
              Are you sure you want to deactivate "{locationToDelete?.name}"? 
              The location will be hidden but all data will be preserved.
              You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              {saving ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
