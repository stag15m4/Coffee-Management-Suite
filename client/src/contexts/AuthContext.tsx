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

export type ModuleId = 'recipe-costing' | 'tip-payout' | 'cash-deposit' | 'bulk-ordering' | 'equipment-maintenance' | 'admin-tasks';

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
    const TIMEOUT_MS = 8000; // Reduced from 15s to fail faster and allow app to proceed
    
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
      // Add timeout wrapper for network resilience - returns null on timeout instead of throwing
      const withTimeout = async <T,>(thenable: PromiseLike<T>, label: string): Promise<T | null> => {
        try {
          return await Promise.race([
            Promise.resolve(thenable),
            new Promise<T>((_, reject) => 
              setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
            )
          ]);
        } catch (e) {
          console.error(`Error fetching user data: ${e instanceof Error ? e.message : 'Unknown error'}`);
          return null;
        }
      };
      
      // Fetch platform admin AND user profile in parallel - use allSettled so one failure doesn't block the other
      const [adminSettled, profileSettled] = await Promise.allSettled([
        withTimeout(supabase.from('platform_admins').select('*').eq('id', userId).maybeSingle(), 'Admin query'),
        withTimeout(supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(), 'Profile query')
      ]);
      
      // Extract results safely
      const adminResult = adminSettled.status === 'fulfilled' ? adminSettled.value : null;
      const profileResult = profileSettled.status === 'fulfilled' ? profileSettled.value : null;

      // Check if platform admin
      if (adminResult && (adminResult as any).data && !(adminResult as any).error) {
        setPlatformAdmin((adminResult as any).data);
        setProfile(null);
        setTenant(null);
        setBranding(null);
        setEnabledModules([]);
        setLastFetchedUserId(userId);
        setFetchInProgress(null);
        return true;
      }

      // Check for regular user profile - handle null/error cases
      const profileError = profileResult ? (profileResult as any).error : null;
      if (profileError) {
        console.error('Profile query error:', profileError.message);
        // Retry on network errors
        if (profileError.message?.includes('Load failed') || 
            profileError.message?.includes('fetch') ||
            profileError.message?.includes('network')) {
          if (retryCount < MAX_RETRIES) {
            console.log(`Retrying profile fetch (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return fetchUserData(userId, retryCount + 1);
          }
        }
      }
      const profileData = profileResult ? (profileResult as any).data : null;
      if (!profileData) {
        console.error('No profile found for user:', userId);
        setProfile(null);
        setPlatformAdmin(null);
        return false;
      }

      setProfile(profileData);
      setPlatformAdmin(null);

      // Fetch tenant, branding, and modules ALL in parallel with timeouts - use allSettled for resilience
      const [tenantSettled, brandingSettled, modulesSettled] = await Promise.allSettled([
        withTimeout(supabase.from('tenants').select('*').eq('id', profileData.tenant_id).single(), 'Tenant query'),
        withTimeout(supabase.from('tenant_branding').select('*').eq('tenant_id', profileData.tenant_id).maybeSingle(), 'Branding query'),
        withTimeout(supabase.rpc('get_tenant_enabled_modules', { p_tenant_id: profileData.tenant_id }), 'Modules query')
      ]);
      
      const tenantResult = tenantSettled.status === 'fulfilled' ? tenantSettled.value : null;
      const brandingResult = brandingSettled.status === 'fulfilled' ? brandingSettled.value : null;
      const modulesResult = modulesSettled.status === 'fulfilled' ? modulesSettled.value : null;

      if (tenantResult && !(tenantResult as any).error && (tenantResult as any).data) {
        setTenant((tenantResult as any).data);
      }
      if (brandingResult && !(brandingResult as any).error && (brandingResult as any).data) {
        setBranding((brandingResult as any).data);
      }

      // Handle modules - log results for debugging
      console.log('DEBUG: Modules RPC result:', JSON.stringify(modulesResult));
      
      if (!modulesResult || (modulesResult as any).error) {
        const errorMsg = modulesResult ? (modulesResult as any).error?.message : 'Query failed';
        console.warn('Module access RPC failed:', errorMsg);
        // Security: Any error defaults to no modules - do not grant access on failure
        setEnabledModules([]);
      } else {
        // RPC succeeded - use the result (empty array is legitimate)
        console.log('DEBUG: Modules loaded:', (modulesResult as any).data || []);
        setEnabledModules(((modulesResult as any).data || []) as ModuleId[]);
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

  // Handle visibility change (iPad app switching, tab switching)
  // Refresh session and notify pages when app returns to foreground
  useEffect(() => {
    let isMounted = true;
    let lastVisibilityTime = Date.now();
    
    const handleVisibilityChange = async () => {
      // Check visibility and that we have a user and component is still mounted
      if (document.visibilityState === 'visible' && user && isMounted) {
        const timeSinceHidden = Date.now() - lastVisibilityTime;
        console.log(`[Session] App returned to foreground after ${Math.round(timeSinceHidden / 1000)}s, refreshing session...`);
        
        try {
          // Refresh the Supabase session
          const { data, error } = await supabase.auth.refreshSession();
          
          // Guard against state updates after unmount
          if (!isMounted) return;
          
          if (error) {
            console.warn('[Session] Session refresh failed:', error.message);
            // If refresh fails, try to get current session
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session && isMounted) {
              setSession(sessionData.session);
              setUser(sessionData.session.user);
            }
          } else if (data.session) {
            console.log('[Session] Session refreshed successfully');
            setSession(data.session);
            setUser(data.session.user);
          }
          
          // Dispatch custom event to notify pages to refresh their data
          // Only refresh if app was hidden for more than 30 seconds
          if (timeSinceHidden > 30000) {
            console.log('[Session] Dispatching app-resumed event to refresh page data');
            window.dispatchEvent(new CustomEvent('app-resumed'));
          }
        } catch (err) {
          console.error('[Session] Error during visibility refresh:', err);
        }
      } else if (document.visibilityState === 'hidden') {
        lastVisibilityTime = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

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
    // Navigate to login page
    window.location.href = '/login';
  };

  const refreshEnabledModules = useCallback(async () => {
    if (!profile?.tenant_id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_tenant_enabled_modules', {
        p_tenant_id: profile.tenant_id
      });
      
      console.log('DEBUG: Refresh modules result:', JSON.stringify({ data, error }));
      
      if (error) {
        console.warn('Module refresh RPC failed:', error.message);
        // Security: Any error defaults to no modules
        setEnabledModules([]);
      } else {
        // Accept empty array as legitimate response
        setEnabledModules((data || []) as ModuleId[]);
      }
    } catch (err: any) {
      console.error('Error refreshing modules:', err);
      // Security: Any error defaults to no modules
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
      'admin-tasks': 'manager',              // Managers and Owners
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
