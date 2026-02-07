import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  avatar_url: string | null;
  start_date: string | null;
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
  parent_tenant_id?: string | null;
}

export type ModuleId = 'recipe-costing' | 'tip-payout' | 'cash-deposit' | 'bulk-ordering' | 'equipment-maintenance' | 'admin-tasks';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  platformAdmin: PlatformAdmin | null;
  isPlatformAdmin: boolean;
  tenant: Tenant | null;
  primaryTenant: Tenant | null;
  accessibleLocations: Tenant[];
  activeLocationId: string | null;
  branding: TenantBranding | null;
  enabledModules: ModuleId[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, tenantId: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (requiredRole: UserRole) => boolean;
  canAccessModule: (module: ModuleId) => boolean;
  refreshEnabledModules: () => Promise<void>;
  switchLocation: (locationId: string) => Promise<void>;
  retryProfileFetch: () => Promise<boolean>;
  isParentTenant: boolean;
  adminViewingTenant: boolean;
  enterTenantView: (tenantId: string) => Promise<void>;
  exitTenantView: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Check if running in dev mode
  const isDevMode = import.meta.env.VITE_USE_MOCK_DATA === 'true' &&
                    typeof localStorage !== 'undefined' &&
                    localStorage.getItem('dev_mode') === 'true';

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [platformAdmin, setPlatformAdmin] = useState<PlatformAdmin | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [primaryTenant, setPrimaryTenant] = useState<Tenant | null>(null);
  const [accessibleLocations, setAccessibleLocations] = useState<Tenant[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [enabledModules, setEnabledModules] = useState<ModuleId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isParentTenant, setIsParentTenant] = useState(false);
  const [adminViewingTenant, setAdminViewingTenant] = useState(false);
  const fetchInProgressRef = useRef<string | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchUserData = useCallback(async (userId: string, retryCount = 0, force = false): Promise<boolean> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 30000; // Allow up to 30s for Supabase cold starts

    // Skip if already fetching for this user (deduplication)
    if (fetchInProgressRef.current === userId && !force) {
      return true;
    }

    // Skip if we already have data for this user (caching)
    if (lastFetchedUserIdRef.current === userId && !force) {
      return true;
    }

    fetchInProgressRef.current = userId;
    
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
      const isPlatAdmin = adminResult && (adminResult as any).data && !(adminResult as any).error;
      if (isPlatAdmin) {
        setPlatformAdmin((adminResult as any).data);
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
        if (isPlatAdmin) {
          // Platform admin with no tenant profile — that's fine
          setProfile(null);
          setTenant(null);
          setBranding(null);
          setEnabledModules([]);
          lastFetchedUserIdRef.current = userId;
          fetchInProgressRef.current = null;
          return true;
        }
        console.error('No profile found for user:', userId);
        setProfile(null);
        setPlatformAdmin(null);
        return false;
      }

      setProfile(profileData);

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
        const tenantData = (tenantResult as any).data as Tenant;
        setTenant(tenantData);
        setPrimaryTenant(tenantData);
        
        // Load all accessible locations (parent/child for owners, plus any user_tenant_assignments)
        let allLocations: Tenant[] = [tenantData];

        try {
          if (profileData.role === 'owner') {
            // Owners get child locations of their primary tenant (with timeout)
            const childLocationsResult = await withTimeout(
              supabase
                .from('tenants')
                .select('*')
                .eq('parent_tenant_id', tenantData.id)
                .eq('is_active', true)
                .order('name'),
              'Child locations query'
            );

            const childLocations = childLocationsResult && !(childLocationsResult as any).error
              ? (childLocationsResult as any).data
              : null;

            allLocations = [tenantData, ...(childLocations || [])];
            setIsParentTenant((childLocations?.length || 0) > 0);
          } else {
            setIsParentTenant(false);
          }

          // Also load any additional locations from user_tenant_assignments for all users (with timeout)
          const assignmentsResult = await withTimeout(
            supabase
              .from('user_tenant_assignments')
              .select('tenant:tenants!inner(*)')
              .eq('user_id', userId)
              .eq('is_active', true),
            'User assignments query'
          );

          const assignments = assignmentsResult && !(assignmentsResult as any).error
            ? (assignmentsResult as any).data
            : null;

          if (assignments && assignments.length > 0) {
            const assignedTenants = assignments
              .map((a: any) => a.tenant as Tenant)
              .filter((t: Tenant) => t.is_active && !allLocations.find(l => l.id === t.id));
            allLocations = [...allLocations, ...assignedTenants];
          }
        } catch (err) {
          console.warn('[AuthContext] Failed to load additional locations:', err);
          // Continue with just the primary tenant
        }

        setAccessibleLocations(allLocations);
        
        // Check if there's a saved active location in session storage
        const savedLocationId = sessionStorage.getItem('selected_location_id');
        if (savedLocationId && savedLocationId !== tenantData.id) {
          // Validate the saved location is in accessible locations list
          const savedLocation = allLocations.find(loc => loc.id === savedLocationId);
          
          if (savedLocation) {
            setTenant(savedLocation);
            setActiveLocationId(savedLocationId);
          } else {
            sessionStorage.removeItem('selected_location_id');
            setActiveLocationId(tenantData.id);
          }
        } else {
          setActiveLocationId(tenantData.id);
        }
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

      lastFetchedUserIdRef.current = userId;
      fetchInProgressRef.current = null;
      return true;
    } catch (error: any) {
      console.error('Error fetching user data:', error?.message || error);
      fetchInProgressRef.current = null;
      // Don't clear profile/admin on timeout - keep trying
      if (!error?.message?.includes('timed out')) {
        setProfile(null);
        setPlatformAdmin(null);
        setEnabledModules([]);
      }
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // If in dev mode, use mock data
    if (isDevMode) {
      console.log('[AuthContext] Running in dev mode with mock data');

      // Create mock user
      const mockUser = {
        id: 'dev-user-123',
        email: 'dev@example.com',
        created_at: new Date().toISOString(),
      } as User;

      // Create mock profile
      const mockProfile: UserProfile = {
        id: 'dev-user-123',
        tenant_id: 'dev-tenant-123',
        email: 'dev@example.com',
        full_name: 'Dev User',
        role: 'owner',
        is_active: true,
        avatar_url: null,
        start_date: null,
      };

      // Create mock tenant
      const mockTenant: Tenant = {
        id: 'dev-tenant-123',
        name: 'Dev Coffee Shop',
        slug: 'dev-coffee-shop',
        subscription_status: 'active',
        subscription_plan: 'pro',
        is_active: true,
        parent_tenant_id: null,
      };

      // Create mock branding
      const mockBranding: TenantBranding = {
        id: 'dev-branding-123',
        tenant_id: 'dev-tenant-123',
        logo_url: null,
        primary_color: '#C9A227',
        secondary_color: '#4A3728',
        accent_color: '#6B5344',
        background_color: '#FFFDF7',
        company_name: 'Dev Coffee Shop',
        tagline: 'Development Mode',
      };

      // Enable all modules in dev mode
      const allModules: ModuleId[] = [
        'recipe-costing',
        'tip-payout',
        'cash-deposit',
        'bulk-ordering',
        'equipment-maintenance',
        'admin-tasks',
      ];

      setUser(mockUser);
      setProfile(mockProfile);
      setTenant(mockTenant);
      setPrimaryTenant(mockTenant);
      setAccessibleLocations([mockTenant]);
      setActiveLocationId(mockTenant.id);
      setBranding(mockBranding);
      setEnabledModules(allModules);
      setIsParentTenant(false);
      setLoading(false);

      return;
    }

    // Get initial session - refresh if token is expired or about to expire
    const initSession = async () => {
      let { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Check if token is expired or expires within 60 seconds
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const isExpired = expiresAt < Date.now() + 60000;

        if (isExpired) {
          console.log('[Session] Token expired or expiring soon, refreshing...');
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.warn('[Session] Refresh failed, signing out:', error.message);
            // Token is expired and can't be refreshed - clear stale session
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          session = data.session;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const success = await fetchUserData(session.user.id);
        // If profile fetch failed, the token may be invalid despite not looking expired
        if (!success && session) {
          console.log('[Session] Profile fetch failed, attempting session refresh...');
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            await fetchUserData(data.session.user.id, 0, true);
          }
        }
      }
      setLoading(false);
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // On TOKEN_REFRESHED, force re-fetch profile data with fresh token
          const force = event === 'TOKEN_REFRESHED';
          await fetchUserData(session.user.id, 0, force);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevMode]);

  // Handle visibility change (iPad app switching, tab switching)
  // Refresh session and notify pages when app returns to foreground
  useEffect(() => {
    let isMounted = true;
    let lastVisibilityTime = Date.now();
    let resumeInProgress = false;

    const handleVisibilityChange = async () => {
      // Check visibility and that we have a user and component is still mounted
      if (document.visibilityState === 'visible' && user && isMounted) {
        // Prevent multiple simultaneous resume operations
        if (resumeInProgress) {
          console.log('[Session] Resume already in progress, skipping duplicate event');
          return;
        }

        const timeSinceHidden = Date.now() - lastVisibilityTime;
        console.log(`[Session] App returned to foreground after ${Math.round(timeSinceHidden / 1000)}s`);

        // Only refresh if app was hidden for a meaningful amount of time
        if (timeSinceHidden < 5000) {
          console.log('[Session] App was only hidden briefly, skipping refresh');
          return;
        }

        resumeInProgress = true;

        try {
          // Add timeout to session refresh to prevent hanging
          const sessionRefreshPromise = supabase.auth.refreshSession();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session refresh timeout')), 5000)
          );

          const { data, error } = await Promise.race([
            sessionRefreshPromise,
            timeoutPromise
          ]) as any;

          // Guard against state updates after unmount
          if (!isMounted) return;

          if (error) {
            console.warn('[Session] Session refresh failed:', error.message);
            // If refresh fails, try to get current session (with timeout)
            try {
              const sessionPromise = supabase.auth.getSession();
              const { data: sessionData } = await Promise.race([
                sessionPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Get session timeout')), 3000))
              ]) as any;

              if (sessionData?.session && isMounted) {
                console.log('[Session] Retrieved existing session');
                setSession(sessionData.session);
                setUser(sessionData.session.user);
                // Re-fetch user data to ensure profile, tenant, and modules are fresh
                await fetchUserData(sessionData.session.user.id, 0, true);
              } else {
                console.warn('[Session] No valid session found, user may need to re-login');
              }
            } catch (sessionErr) {
              console.error('[Session] Failed to get session:', sessionErr);
              // Don't force logout, let existing session continue
            }
          } else if (data?.session) {
            console.log('[Session] Session refreshed successfully');
            // Update session state so modules have fresh auth data
            if (isMounted) {
              setSession(data.session);
              setUser(data.session.user);
              // Re-fetch user data to ensure profile, tenant, and modules are fresh
              await fetchUserData(data.session.user.id, 0, true);
            }
          }

          // Dispatch custom event to notify pages to refresh their data
          // Only refresh if app was hidden for more than 30 seconds
          if (timeSinceHidden > 30000 && isMounted) {
            console.log('[Session] Dispatching app-resumed event to refresh page data');
            // Use setTimeout to ensure event happens after state updates complete
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('app-resumed'));
            }, 100);
          }
        } catch (err) {
          console.error('[Session] Error during visibility refresh:', err);
          // Don't crash, just log and continue
        } finally {
          resumeInProgress = false;
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
    // Clear dev mode flag
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('dev_mode');
    }

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

  const retryProfileFetch = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    lastFetchedUserIdRef.current = null; // Clear cache so fetch actually runs
    fetchInProgressRef.current = null;
    const success = await fetchUserData(user.id, 0, true);
    if (!success) {
      // Try refreshing the session first, then re-fetch
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        setSession(data.session);
        setUser(data.session.user);
        return await fetchUserData(data.session.user.id, 0, true);
      }
    }
    return success;
  }, [user, fetchUserData]);

  const switchLocation = useCallback(async (locationId: string) => {
    // Validate the location is in accessible locations
    const targetLocation = accessibleLocations.find(loc => loc.id === locationId);
    if (!targetLocation) {
      console.error('Cannot switch to inaccessible location:', locationId);
      return;
    }

    // Update tenant context
    setTenant(targetLocation);
    setActiveLocationId(locationId);
    sessionStorage.setItem('selected_location_id', locationId);

    // Load branding for the new location
    const { data: newBranding } = await supabase
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', locationId)
      .maybeSingle();

    // Always update branding state - if location has no branding, set to null
    // This prevents the previous location's branding from persisting
    setBranding(newBranding || null);

    // Refresh enabled modules for the new location
    const { data: modules } = await supabase.rpc('get_tenant_enabled_modules', {
      p_tenant_id: locationId
    });
    if (modules) {
      setEnabledModules(modules as ModuleId[]);
    }

    // Dispatch location-changed event so pages can refresh their data
    console.log('[AuthContext] Dispatching location-changed event for', locationId);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { locationId } }));
  }, [accessibleLocations]);

  // Platform admin: enter a tenant's dashboard view (requires profile or assignment)
  const enterTenantView = useCallback(async (tenantId: string) => {
    if (!user || !platformAdmin) return;

    // Load profile, assignment, and tenant data in parallel
    const [profileResult, assignmentResult, tenantResult, brandingResult, modulesResult] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('user_tenant_assignments').select('role').eq('user_id', user.id).eq('tenant_id', tenantId).eq('is_active', true).maybeSingle(),
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
      supabase.from('tenant_branding').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.rpc('get_tenant_enabled_modules', { p_tenant_id: tenantId }),
    ]);

    if (!tenantResult.data) return;

    // Use direct profile if available, otherwise build one from the assignment
    const effectiveProfile: UserProfile = profileResult.data || (assignmentResult.data ? {
      id: user.id,
      tenant_id: tenantId,
      email: platformAdmin.email,
      full_name: platformAdmin.full_name,
      role: (assignmentResult.data.role || 'owner') as UserRole,
      is_active: true,
      avatar_url: null,
      start_date: null,
    } : null as any);

    if (!effectiveProfile) return;

    setProfile(effectiveProfile);
    setTenant(tenantResult.data);
    setPrimaryTenant(tenantResult.data);
    setAccessibleLocations([tenantResult.data]);
    setActiveLocationId(tenantResult.data.id);
    setBranding(brandingResult.data || null);
    setEnabledModules((modulesResult.data || []) as ModuleId[]);
    setAdminViewingTenant(true);
    sessionStorage.setItem('admin_view_tenant_id', tenantId);
  }, [user, platformAdmin]);

  // Platform admin: exit tenant view and return to admin panel
  const exitTenantView = useCallback(() => {
    sessionStorage.removeItem('admin_view_tenant_id');
    sessionStorage.removeItem('selected_location_id');
    setAdminViewingTenant(false);
    setProfile(null);
    setTenant(null);
    setPrimaryTenant(null);
    setAccessibleLocations([]);
    setActiveLocationId(null);
    setBranding(null);
    setEnabledModules([]);
  }, []);

  // On load, check if platform admin was viewing a tenant
  useEffect(() => {
    if (platformAdmin && !adminViewingTenant && !profile) {
      const savedTenantId = sessionStorage.getItem('admin_view_tenant_id');
      if (savedTenantId) {
        enterTenantView(savedTenantId);
      }
    }
  }, [platformAdmin, adminViewingTenant, profile, enterTenantView]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        platformAdmin,
        isPlatformAdmin: !!platformAdmin,
        tenant,
        primaryTenant,
        accessibleLocations,
        activeLocationId,
        branding,
        enabledModules,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        canAccessModule,
        refreshEnabledModules,
        switchLocation,
        retryProfileFetch,
        isParentTenant,
        adminViewingTenant,
        enterTenantView,
        exitTenantView,
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
