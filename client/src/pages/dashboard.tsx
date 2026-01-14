import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, DollarSign, Coffee, Receipt, Wrench, RefreshCw } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
};

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  disabled?: boolean;
}

function ModuleCard({ title, description, icon, href, disabled }: ModuleCardProps) {
  const content = (
    <Card 
      className={`h-full transition-transform ${disabled ? 'opacity-50' : 'hover-elevate cursor-pointer'}`}
      style={{ backgroundColor: colors.white }}
    >
      <CardHeader>
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
          style={{ backgroundColor: disabled ? colors.creamDark : colors.gold }}
        >
          {icon}
        </div>
        <CardTitle style={{ color: colors.brown }}>{title}</CardTitle>
        <CardDescription style={{ color: colors.brownLight }}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {disabled ? (
          <span className="text-sm" style={{ color: colors.brownLight }}>Coming Soon</span>
        ) : (
          <span className="text-sm font-medium" style={{ color: colors.gold }}>Open Module</span>
        )}
      </CardContent>
    </Card>
  );

  if (disabled) {
    return content;
  }

  return (
    <Link href={href} data-testid={`link-module-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {content}
    </Link>
  );
}

export default function Dashboard() {
  const { profile, tenant, branding, signOut, canAccessModule, refreshEnabledModules, enabledModules } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const companyName = branding?.company_name || tenant?.name || 'Management Suite';
  
  const handleRefreshModules = async () => {
    setRefreshing(true);
    try {
      await refreshEnabledModules();
      toast({ title: 'Modules refreshed' });
    } catch (error) {
      toast({ title: 'Failed to refresh modules', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };
  
  const hasAnyModules = enabledModules.length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt={companyName} className="h-10 w-auto" />
            ) : (
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: branding?.primary_color || colors.gold }}
              >
                <span className="font-bold" style={{ color: colors.brown }}>
                  {companyName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-bold" style={{ color: colors.brown }}>{companyName}</h1>
              {branding?.tagline && (
                <p className="text-sm" style={{ color: colors.brownLight }}>{branding.tagline}</p>
              )}
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
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: colors.brown }}>
              Welcome, {profile?.full_name?.split(' ')[0] || 'User'}
            </h2>
            <p style={{ color: colors.brownLight }}>
              Select a module to get started
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshModules}
            disabled={refreshing}
            style={{ borderColor: colors.creamDark, color: colors.brown }}
            data-testid="button-refresh-modules"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {!hasAnyModules && profile?.role === 'owner' && (
          <Card className="mb-6" style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
            <CardContent className="py-4">
              <p style={{ color: colors.brown }}>
                No modules are currently loaded. Try clicking the Refresh button above.
                If this persists, please sign out and sign back in.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {canAccessModule('recipe-costing') && (
            <ModuleCard
              title="Recipe Costing"
              description="Track ingredients, create recipes, and calculate costs"
              icon={<Calculator className="w-6 h-6" style={{ color: colors.brown }} />}
              href="/recipe-costing"
            />
          )}
          
          {canAccessModule('tip-payout') && (
            <ModuleCard
              title="Tip Payout"
              description="Calculate and distribute employee tips"
              icon={<DollarSign className="w-6 h-6" style={{ color: colors.brown }} />}
              href="/tip-payout"
            />
          )}
          
          {canAccessModule('cash-deposit') && (
            <ModuleCard
              title="Cash Deposit"
              description="Track cash deposits and reconciliation"
              icon={<Receipt className="w-6 h-6" style={{ color: colors.brown }} />}
              href="/cash-deposit"
            />
          )}
          
          {canAccessModule('bulk-ordering') && (
            <ModuleCard
              title="Coffee Orders"
              description="Manage wholesale coffee orders"
              icon={<Coffee className="w-6 h-6" style={{ color: colors.brown }} />}
              href="/coffee-order"
            />
          )}
          
          {canAccessModule('equipment-maintenance') && (
            <ModuleCard
              title="Equipment Maintenance"
              description="Track and manage equipment upkeep"
              icon={<Wrench className="w-6 h-6" style={{ color: colors.brown }} />}
              href="/equipment-maintenance"
            />
          )}
        </div>

        {/* Admin Section for Owners and Managers */}
        {(profile?.role === 'owner' || profile?.role === 'manager') && (
          <div className="mt-12">
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.brown }}>
              Admin Tools
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/admin/users" data-testid="link-admin-users">
                <Card className="hover-elevate cursor-pointer" style={{ backgroundColor: colors.white }}>
                  <CardHeader>
                    <CardTitle className="text-base" style={{ color: colors.brown }}>
                      Manage Users
                    </CardTitle>
                    <CardDescription style={{ color: colors.brownLight }}>
                      Add, edit, or remove team members
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              {profile?.role === 'owner' && (
                <Link href="/admin/branding" data-testid="link-admin-branding">
                  <Card className="hover-elevate cursor-pointer" style={{ backgroundColor: colors.white }}>
                    <CardHeader>
                      <CardTitle className="text-base" style={{ color: colors.brown }}>
                        Branding Settings
                      </CardTitle>
                      <CardDescription style={{ color: colors.brownLight }}>
                        Customize logo and colors
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
