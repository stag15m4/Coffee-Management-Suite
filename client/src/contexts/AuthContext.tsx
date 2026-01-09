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

export type ModuleId = 'recipe-costing' | 'tip-payout' | 'cash-deposit' | 'bulk-ordering';

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

  const fetchEnabledModules = useCallback(async (tenantId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_tenant_enabled_modules', {
        p_tenant_id: tenantId
      });
      
      if (error) {
        // If the function doesn't exist yet, query plan modules directly as fallback
        console.warn('Module access function not available, using plan-based fallback:', error.message);
        
        // Query the tenant's plan and get default modules
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('subscription_plan')
          .eq('id', tenantId)
          .single();
        
        const plan = tenantData?.subscription_plan || 'free';
        
        const { data: planModules } = await supabase
          .from('subscription_plan_modules')
          .select('module_id')
          .eq('plan_id', plan);
        
        if (planModules && planModules.length > 0) {
          setEnabledModules(planModules.map(pm => pm.module_id as ModuleId));
        } else {
          // Default to all modules only for free/trial plans
          if (plan === 'free' || !plan) {
            setEnabledModules(['recipe-costing', 'tip-payout', 'cash-deposit', 'bulk-ordering']);
          } else {
            setEnabledModules([]);
          }
        }
        return;
      }
      
      setEnabledModules((data || []) as ModuleId[]);
    } catch (err) {
      console.error('Error in fetchEnabledModules:', err);
      // On complete failure, set empty to be safe (no access)
      setEnabledModules([]);
    }
  }, []);

  const fetchUserData = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // First check if user is a platform admin
      const { data: adminData, error: adminError } = await supabase
        .from('platform_admins')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (adminData && !adminError) {
        // User is a platform admin - no need to fetch tenant/branding
        setPlatformAdmin(adminData);
        setProfile(null);
        setTenant(null);
        setBranding(null);
        return true;
      }

      // Not a platform admin, check for regular user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        console.error('Error fetching profile:', profileError?.message);
        setProfile(null);
        setPlatformAdmin(null);
        return false;
      }

      setProfile(profileData);
      setPlatformAdmin(null);

      // Fetch tenant, branding, and enabled modules in parallel (non-blocking for UI)
      Promise.all([
        supabase.from('tenants').select('*').eq('id', profileData.tenant_id).single(),
        supabase.from('tenant_branding').select('*').eq('tenant_id', profileData.tenant_id).single()
      ]).then(([tenantResult, brandingResult]) => {
        if (!tenantResult.error && tenantResult.data) {
          setTenant(tenantResult.data);
        }
        if (!brandingResult.error && brandingResult.data) {
          setBranding(brandingResult.data);
        }
      }).catch(err => {
        console.error('Error fetching tenant/branding:', err);
      });

      // Fetch enabled modules for this tenant
      fetchEnabledModules(profileData.tenant_id);

      return true;
    } catch (error: any) {
      console.error('Error fetching user data:', error?.message || error);
      setProfile(null);
      setPlatformAdmin(null);
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
    if (profile?.tenant_id) {
      await fetchEnabledModules(profile.tenant_id);
    }
  }, [profile?.tenant_id, fetchEnabledModules]);

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
      'recipe-costing': 'manager',    // Managers and Owners
      'tip-payout': 'lead',           // Leads, Managers, Owners
      'cash-deposit': 'manager',       // Managers and Owners
      'bulk-ordering': 'lead',         // Leads, Managers, Owners
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
