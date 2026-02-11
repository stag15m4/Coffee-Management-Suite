import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useAppResume } from '@/hooks/use-app-resume';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  MapPin, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  ArrowRight,
  Plus,
  Settings,
  ArrowLeft
} from 'lucide-react';
import { Footer } from '@/components/Footer';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';

interface Location {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  parent_tenant_id: string | null;
}

interface LocationMetrics {
  tenant_id: string;
  tip_total_this_week?: number;
  deposit_total_this_week?: number;
  overdue_maintenance?: number;
  pending_tasks?: number;
  active_employees?: number;
}

export default function OrganizationDashboard() {
  const { profile, tenant, branding, signOut, switchLocation: authSwitchLocation, primaryTenant } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [metrics, setMetrics] = useState<Record<string, LocationMetrics>>({});

  const companyName = branding?.company_name || primaryTenant?.name || tenant?.name || 'Organization';
  
  // Use primaryTenant for organization view (always the parent)
  const parentTenantId = primaryTenant?.id;

  const loadData = useCallback(async () => {
    if (!parentTenantId) return;
    setLoading(true);

    try {
      // Fetch child locations
      const { data: childLocations, error: locError } = await supabase
        .from('tenants')
        .select('*')
        .eq('parent_tenant_id', parentTenantId)
        .eq('is_active', true)
        .order('name');

      if (locError) throw locError;

      // Include parent tenant as a location too
      const allLocations = [
        { ...primaryTenant, parent_tenant_id: null } as Location,
        ...(childLocations || [])
      ];
      setLocations(allLocations);

      // Fetch metrics for each location
      const metricsData: Record<string, LocationMetrics> = {};
      
      for (const loc of allLocations) {
        const locMetrics: LocationMetrics = { tenant_id: loc.id };

        // Get active employee count (from profiles + location assignments)
        const { count: profileCount } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', loc.id)
          .eq('is_active', true);

        const { count: assignmentCount } = await supabase
          .from('user_tenant_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', loc.id)
          .eq('is_active', true);

        locMetrics.active_employees = Math.max(profileCount || 0, assignmentCount || 0) || (profileCount || 0);

        // Get pending admin tasks
        const { count: taskCount } = await supabase
          .from('admin_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', loc.id)
          .neq('status', 'completed');
        locMetrics.pending_tasks = taskCount || 0;

        // Get overdue maintenance count
        const { data: maintenanceTasks } = await supabase
          .from('maintenance_tasks')
          .select('*, equipment!inner(*)')
          .eq('equipment.tenant_id', loc.id);
        
        if (maintenanceTasks) {
          const now = new Date();
          let overdueCount = 0;
          for (const task of maintenanceTasks) {
            if (task.interval_type === 'time' && task.last_completed) {
              const lastDone = new Date(task.last_completed);
              const nextDue = new Date(lastDone.getTime() + (task.interval_value * 24 * 60 * 60 * 1000));
              if (nextDue < now) overdueCount++;
            }
          }
          locMetrics.overdue_maintenance = overdueCount;
        }

        metricsData[loc.id] = locMetrics;
      }

      setMetrics(metricsData);
    } catch (error: any) {
      console.error('Error loading organization data:', error);
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [parentTenantId, primaryTenant, toast]);

  useEffect(() => {
    if (parentTenantId) {
      loadData();
    }
  }, [parentTenantId, loadData]);

  useAppResume(() => {
    if (parentTenantId) {
      console.log('[OrganizationDashboard] Refreshing data after app resume');
      loadData();
    }
  }, [parentTenantId, loadData]);

  const switchToLocation = async (locationId: string) => {
    // Use the auth context to switch location
    await authSwitchLocation(locationId);
    setLocation('/');
  };

  // Handle case where primaryTenant is not loaded yet
  if (!parentTenantId) {
    return <CoffeeLoader fullScreen text="Brewing..." />;
  }

  if (loading) {
    return <CoffeeLoader fullScreen text="Brewing..." />;
  }

  const childLocations = locations.filter(l => l.parent_tenant_id === parentTenantId);
  const hasChildLocations = childLocations.length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                <ArrowLeft className="w-5 h-5" style={{ color: colors.brown }} />
              </Button>
            </Link>
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt={companyName} className="h-10 w-auto" />
            ) : (
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: branding?.primary_color || colors.gold }}
              >
                <Building2 className="w-5 h-5" style={{ color: colors.brown }} />
              </div>
            )}
            <div>
              <h1 className="font-bold" style={{ color: colors.brown }}>Organization Overview</h1>
              <p className="text-sm" style={{ color: colors.brownLight }}>{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: colors.brown }}>
                {profile?.full_name || profile?.email}
              </p>
              <p className="text-xs capitalize" style={{ color: colors.brownLight }}>
                {profile?.role}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-logout"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: colors.cream }}>
                  <MapPin className="w-5 h-5" style={{ color: colors.gold }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                    {locations.length}
                  </p>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Total Locations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: colors.cream }}>
                  <Users className="w-5 h-5" style={{ color: colors.gold }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                    {Object.values(metrics).reduce((sum, m) => sum + (m.active_employees || 0), 0)}
                  </p>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Total Team Members
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: colors.cream }}>
                  <DollarSign className="w-5 h-5" style={{ color: colors.gold }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                    {Object.values(metrics).reduce((sum, m) => sum + (m.pending_tasks || 0), 0)}
                  </p>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Pending Tasks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {Object.values(metrics).reduce((sum, m) => sum + (m.overdue_maintenance || 0), 0)}
                  </p>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Overdue Maintenance
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Location Management Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: colors.brown }}>
            Your Locations
          </h2>
          <Link href="/admin/locations">
            <Button
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-manage-locations"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </Link>
        </div>

        {/* Locations List */}
        <div className="space-y-4">
          {locations.map((location) => {
            const locMetrics = metrics[location.id] || {};
            const isParent = location.id === parentTenantId;

            return (
              <Card 
                key={location.id} 
                className="hover-elevate cursor-pointer"
                style={{ backgroundColor: colors.white }}
                onClick={() => switchToLocation(location.id)}
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
                          {isParent && (
                            <Badge variant="secondary" className="text-xs">
                              Main Location
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm" style={{ color: colors.brownLight }}>
                          {locMetrics.active_employees || 0} team members
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {(locMetrics.overdue_maintenance || 0) > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {locMetrics.overdue_maintenance} overdue
                          </span>
                        </div>
                      )}

                      {(locMetrics.pending_tasks || 0) > 0 && (
                        <div className="flex items-center gap-2" style={{ color: colors.brownLight }}>
                          <span className="text-sm">
                            {locMetrics.pending_tasks} pending tasks
                          </span>
                        </div>
                      )}

                      <ArrowRight className="w-5 h-5" style={{ color: colors.brownLight }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!hasChildLocations && (
          <Card className="mt-6" style={{ backgroundColor: colors.white, borderStyle: 'dashed' }}>
            <CardContent className="py-8 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: colors.creamDark }} />
              <h3 className="font-bold mb-2" style={{ color: colors.brown }}>
                Single Location Setup
              </h3>
              <p className="mb-4" style={{ color: colors.brownLight }}>
                You currently have one location. Add more locations to manage multiple sites from this dashboard.
              </p>
              <Link href="/admin/locations">
                <Button
                  variant="outline"
                  style={{ borderColor: colors.gold, color: colors.brown }}
                  data-testid="button-add-first-location"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Location
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
