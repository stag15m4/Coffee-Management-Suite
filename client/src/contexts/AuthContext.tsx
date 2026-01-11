import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-queries';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'manager' | 'lead' | 'employee';

export interface UserProfile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface TenantBranding {
  id: string;
  tenant_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  company_name: string | null;
  tagline: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscription_status?: string;
  subscription_plan?: string;
  is_active?: boolean;
}

export type ModuleId = 'recipe-costing' | 'tip-payout' | 'cash-deposit' | 'bulk-ordering' | 'equipment-maintenance';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  platformAdmin: PlatformAdmin | null;
  isPlatformAdmin: boolean;
  tenant: Tenant | null;
  branding: TenantBranding | null;
  enabledModules: ModuleId[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, tenantId: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (requiredRole: UserRole) => boolean;
  canAccessModule: (module: ModuleId) => boolean;
  refreshEnabledModules: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState<PlatformAdmin | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [enabledModules, setEnabledModules] = useState<ModuleId[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Fetch platform admin AND user profile in parallel - only one will succeed
      const [adminResult, profileResult] = await Promise.all([
        supabase.from('platform_admins').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle()
      ]);

      // Check if platform admin
      if (adminResult.data && !adminResult.error) {
        setPlatformAdmin(adminResult.data);
        setProfile(null);
        setTenant(null);
        setBranding(null);
        setEnabledModules([]);
        return true;
      }

      // Check for regular user profile
      const profileData = profileResult.data;
      if (!profileData) {
        console.error('No profile found for user');
        setProfile(null);
        setPlatformAdmin(null);
        return false;
      }

      setProfile(profileData);
      setPlatformAdmin(null);

      // Fetch tenant, branding, and modules ALL in parallel
      const [tenantResult, brandingResult, modulesResult] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', profileData.tenant_id).single(),
        supabase.from('tenant_branding').select('*').eq('tenant_id', profileData.tenant_id).maybeSingle(),
        supabase.rpc('get_tenant_enabled_modules', { p_tenant_id: profileData.tenant_id })
      ]);

      if (!tenantResult.error && tenantResult.data) {
        setTenant(tenantResult.data);
      }
      if (!brandingResult.error && brandingResult.data) {
        setBranding(brandingResult.data);
      }

      // Handle modules - default to all if RPC fails (e.g., function not created yet)
      if (modulesResult.error || !modulesResult.data?.length) {
        setEnabledModules(['recipe-costing', 'tip-payout', 'cash-deposit', 'bulk-ordering', 'equipment-maintenance']);
      } else {
        setEnabledModules(modulesResult.data as ModuleId[]);
      }

      return true;
    } catch (error: any) {
      console.error('Error fetching user data:', error?.message || error);
      setProfile(null);
      setPlatformAdmin(null);
      // Default to all modules on error so users aren't locked out
      setEnabledModules(['recipe-costing', 'tip-payout', 'cash-deposit', 'bulk-ordering', 'equipment-maintenance']);
      return false;
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setProfile(null);
          setPlatformAdmin(null);
          setTenant(null);
          setBranding(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, tenantId: string, role: UserRole = 'employee') => {
    // First, create the auth user
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      return { error: error as Error };
    }

    if (data.user) {
      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          tenant_id: tenantId,
          email: email,
          full_name: fullName,
          role: role,
          is_active: true,
        });

      if (profileError) {
        return { error: profileError as Error };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPlatformAdmin(null);
    setTenant(null);
    setBranding(null);
    setEnabledModules([]);
  };

  const refreshEnabledModules = useCallback(async () => {
    if (!profile?.tenant_id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_tenant_enabled_modules', {
        p_tenant_id: profile.tenant_id
      });
      
      if (error || !data?.length) {
        setEnabledModules(['recipe-costing', 'tip-payout', 'cash-deposit', 'bulk-ordering', 'equipment-maintenance']);
      } else {
        setEnabledModules(data as ModuleId[]);
      }
    } catch (err) {
      console.error('Error refreshing modules:', err);
    }
  }, [profile?.tenant_id]);

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!profile) return false;
    
    const roleHierarchy: Record<UserRole, number> = {
      owner: 4,
      manager: 3,
      lead: 2,
      employee: 1,
    };

    return roleHierarchy[profile.role] >= roleHierarchy[requiredRole];
  };

  const canAccessModule = (module: ModuleId): boolean => {
    if (!profile) return false;

    // First check if the module is enabled for this tenant's subscription
    if (!enabledModules.includes(module)) {
      return false;
    }

    // Then check if the user's role has access to this module type
    const moduleAccess: Record<string, UserRole> = {
      'recipe-costing': 'manager',           // Managers and Owners
      'tip-payout': 'lead',                  // Leads, Managers, Owners
      'cash-deposit': 'manager',             // Managers and Owners
      'bulk-ordering': 'lead',               // Leads, Managers, Owners
      'equipment-maintenance': 'employee',   // All team members
    };

    return hasRole(moduleAccess[module]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        platformAdmin,
        isPlatformAdmin: !!platformAdmin,
        tenant,
        branding,
        enabledModules,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        canAccessModule,
        refreshEnabledModules,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
