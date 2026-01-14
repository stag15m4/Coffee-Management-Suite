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
  const [fetchInProgress, setFetchInProgress] = useState<string | null>(null);
  const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);

  const fetchUserData = useCallback(async (userId: string, retryCount = 0, force = false): Promise<boolean> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 15000;
    
    // Skip if already fetching for this user (deduplication)
    if (fetchInProgress === userId && !force) {
      return true;
    }
    
    // Skip if we already have data for this user (caching) - but always refetch modules
    if (lastFetchedUserId === userId && (profile || platformAdmin) && !force) {
      // Even when using cache, always refresh modules to ensure they're current
      if (profile?.tenant_id) {
        const { data, error } = await supabase.rpc('get_tenant_enabled_modules', {
          p_tenant_id: profile.tenant_id
        });
        if (!error && data) {
          setEnabledModules(data as ModuleId[]);
        }
      }
      return true;
    }
    
    setFetchInProgress(userId);
    
    try {
      // Add timeout wrapper for network resilience
      const withTimeout = <T,>(thenable: PromiseLike<T>, label: string): Promise<T> => {
        return Promise.race([
          Promise.resolve(thenable),
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
          )
        ]);
      };
      
      // Fetch platform admin AND user profile in parallel - only one will succeed
      const [adminResult, profileResult] = await Promise.all([
        withTimeout(supabase.from('platform_admins').select('*').eq('id', userId).maybeSingle(), 'Admin query'),
        withTimeout(supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(), 'Profile query')
      ]) as [any, any];

      // Check if platform admin
      if (adminResult.data && !adminResult.error) {
        setPlatformAdmin(adminResult.data);
        setProfile(null);
        setTenant(null);
        setBranding(null);
        setEnabledModules([]);
        setLastFetchedUserId(userId);
        setFetchInProgress(null);
        return true;
      }

      // Check for regular user profile
      if (profileResult.error) {
        console.error('Profile query error:', profileResult.error.message);
        // Retry on network errors
        if (profileResult.error.message?.includes('Load failed') || 
            profileResult.error.message?.includes('fetch') ||
            profileResult.error.message?.includes('network')) {
          if (retryCount < MAX_RETRIES) {
            console.log(`Retrying profile fetch (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return fetchUserData(userId, retryCount + 1);
          }
        }
      }
      const profileData = profileResult.data;
      if (!profileData) {
        console.error('No profile found for user:', userId);
        setProfile(null);
        setPlatformAdmin(null);
        return false;
      }

      setProfile(profileData);
      setPlatformAdmin(null);

      // Fetch tenant, branding, and modules ALL in parallel with timeouts
      const [tenantResult, brandingResult, modulesResult] = await Promise.all([
        withTimeout(supabase.from('tenants').select('*').eq('id', profileData.tenant_id).single(), 'Tenant query'),
        withTimeout(supabase.from('tenant_branding').select('*').eq('tenant_id', profileData.tenant_id).maybeSingle(), 'Branding query'),
        withTimeout(supabase.rpc('get_tenant_enabled_modules', { p_tenant_id: profileData.tenant_id }), 'Modules query')
      ]) as [any, any, any];

      if (!tenantResult.error && tenantResult.data) {
        setTenant(tenantResult.data);
      }
      if (!brandingResult.error && brandingResult.data) {
        setBranding(brandingResult.data);
      }

      // Handle modules - on failure, default to NO access for security
      if (modulesResult.error) {
        console.warn('Module access RPC failed, defaulting to no modules:', modulesResult.error.message);
        setEnabledModules([]);
      } else {
        setEnabledModules((modulesResult.data || []) as ModuleId[]);
      }

      setLastFetchedUserId(userId);
      setFetchInProgress(null);
      return true;
    } catch (error: any) {
      console.error('Error fetching user data:', error?.message || error);
      setFetchInProgress(null);
      // Don't clear profile/admin on timeout - keep trying
      if (!error?.message?.includes('timed out')) {
        setProfile(null);
        setPlatformAdmin(null);
        setEnabledModules([]);
      }
      return false;
    }
  }, [fetchInProgress, lastFetchedUserId, profile, platformAdmin]);

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
      
      if (error) {
        console.warn('Module access RPC failed:', error.message);
        setEnabledModules([]);
      } else {
        setEnabledModules((data || []) as ModuleId[]);
      }
    } catch (err) {
      console.error('Error refreshing modules:', err);
      setEnabledModules([]);
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
