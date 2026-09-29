import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase-queries';
import type { User, Session } from '@supabase/supabase-js';
import type { PermissionKey, TenantRoleSetting } from '@/hooks/use-role-settings';
import { getAllModuleIds, MODULE_REGISTRY, type ModuleId } from '@/lib/module-registry';
import { createSessionResumeHandler } from '@/lib/session-resume';
import { getErrorMessage } from '@/lib/utils';

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
  is_exempt: boolean;
  kiosk_pin: string | null;
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
  trial_ends_at?: string | null;
  starting_drawer_default?: number | null;
  billable_locations?: number;
  billing_interval?: string;
  is_grandfathered?: boolean;
}

export type { ModuleId } from '@/lib/module-registry';

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
  roleSettings: TenantRoleSetting[] | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, tenantId: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (requiredRole: UserRole) => boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  getRoleDisplayName: (role: UserRole) => string;
  canAccessModule: (module: ModuleId) => boolean;
  refreshEnabledModules: () => Promise<void>;
  switchLocation: (locationId: string) => Promise<boolean>;
  retryProfileFetch: () => Promise<boolean>;
  isParentTenant: boolean;
  adminViewingTenant: boolean;
  enterTenantView: (tenantId: string) => Promise<void>;
  exitTenantView: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Check if running in dev mode
  const isDevMode =
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_MOCK_DATA === 'true' &&
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
  const [roleSettings, setRoleSettings] = useState<TenantRoleSetting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isParentTenant, setIsParentTenant] = useState(false);
  const [adminViewingTenant, setAdminViewingTenant] = useState(false);
  const fetchInProgressRef = useRef<string | null>(null);
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const bootstrapRequestIdRef = useRef(0);

  const fetchUserData = useCallback(
    async (
      userId: string,
      _retryCount = 0,
      force = false,
      accessToken?: string,
      locationId?: string
    ): Promise<boolean> => {
      if (fetchInProgressRef.current === userId && !force) return true;
      if (lastFetchedUserIdRef.current === userId && !force) return true;

      fetchInProgressRef.current = userId;
      const requestId = ++bootstrapRequestIdRef.current;
      const startedAt = performance.now();

      try {
        // Auth event callbacks already have the session. Calling getSession() from
        // inside one can wait on Supabase's auth lock and stall the callback.
        const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) {
          if (requestId === bootstrapRequestIdRef.current) fetchInProgressRef.current = null;
          return false;
        }

        const savedLocationId = locationId ?? sessionStorage.getItem('selected_location_id');
        const query = savedLocationId ? `?locationId=${encodeURIComponent(savedLocationId)}` : '';
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        let response: Response;
        try {
          response = await fetch(`/api/auth/bootstrap${query}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeout);
        }

        if (!response.ok) {
          console.error(`[AuthBootstrap] CMS bootstrap failed: ${response.status}`);
          if (requestId === bootstrapRequestIdRef.current) fetchInProgressRef.current = null;
          return false;
        }

        const data = (await response.json()) as {
          profile: UserProfile | null;
          platformAdmin: PlatformAdmin | null;
          primaryTenant?: Tenant;
          tenant?: Tenant;
          accessibleLocations?: Tenant[];
          activeLocationId?: string;
          isParentTenant?: boolean;
          branding?: TenantBranding | null;
          enabledModules?: ModuleId[];
          roleSettings?: TenantRoleSetting[] | null;
          durationMs?: number;
        };

        // A newer bootstrap (such as a location switch or token refresh) owns
        // the context. Never let an older response overwrite its state.
        if (requestId !== bootstrapRequestIdRef.current) return false;
        if (locationId && data.activeLocationId !== locationId) {
          console.error('[AuthBootstrap] Requested location is no longer accessible:', locationId);
          fetchInProgressRef.current = null;
          return false;
        }

        setProfile(data.profile);
        setPlatformAdmin(data.platformAdmin);

        if (data.profile) {
          const locations = data.accessibleLocations || [];
          setPrimaryTenant(data.primaryTenant || null);
          setTenant(data.tenant || data.primaryTenant || null);
          setAccessibleLocations(locations);
          setActiveLocationId(data.activeLocationId || data.primaryTenant?.id || null);
          setIsParentTenant(Boolean(data.isParentTenant));
          setBranding(data.branding || null);
          setEnabledModules(data.enabledModules || []);
          setRoleSettings(data.roleSettings || null);

          if (locationId) sessionStorage.setItem('selected_location_id', locationId);

          if (savedLocationId && !locations.some((location) => location.id === savedLocationId)) {
            sessionStorage.removeItem('selected_location_id');
          }
        } else {
          setPrimaryTenant(null);
          setTenant(null);
          setAccessibleLocations([]);
          setActiveLocationId(null);
          setBranding(null);
          setEnabledModules([]);
          setRoleSettings(null);
          setIsParentTenant(false);
        }

        setLoading(false);
        lastFetchedUserIdRef.current = userId;
        if (requestId === bootstrapRequestIdRef.current) fetchInProgressRef.current = null;
        console.info(
          `[AuthBootstrap] CMS request: ${Math.round(performance.now() - startedAt)}ms (server ${data.durationMs ?? 'n/a'}ms)`
        );
        return true;
      } catch (error: unknown) {
        console.error('[AuthBootstrap] CMS bootstrap error:', getErrorMessage(error));
        if (requestId === bootstrapRequestIdRef.current) fetchInProgressRef.current = null;
        return false;
      }
    },
    []
  );

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
        is_exempt: false,
        kiosk_pin: null,
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
        primary_color: '#334155',
        secondary_color: '#0F172A',
        accent_color: '#F1F5F9',
        background_color: '#FFFFFF',
        company_name: 'Dev Coffee Shop',
        tagline: 'Development Mode',
      };

      // Enable all modules in dev mode
      const allModules = getAllModuleIds();

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
      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // Check if token is expired or expires within 60 seconds
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        const isExpired = expiresAt < Date.now() + 60000;

        if (isExpired) {
          console.log('[Session] Token expired or expiring soon, refreshing...');
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.warn('[Session] Refresh failed, signing out:', getErrorMessage(error));
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
        const success = await fetchUserData(session.user.id, 0, false, session.access_token);
        // If profile fetch failed, the token may be invalid despite not looking expired
        if (!success && session) {
          console.log('[Session] Profile fetch failed, attempting session refresh...');
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            await fetchUserData(data.session.user.id, 0, true, data.session.access_token);
          }
        }
      }
      setLoading(false);
    };

    initSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // On TOKEN_REFRESHED, force re-fetch profile data with fresh token
        const force = event === 'TOKEN_REFRESHED';
        await fetchUserData(session.user.id, 0, force, session.access_token);

        // Record last login timestamp for engagement tracking
        if (event === 'SIGNED_IN') {
          Promise.resolve(
            supabase.from('user_profiles').update({ last_login_at: new Date().toISOString() }).eq('id', session.user.id)
          ).catch((err: unknown) => console.warn('[AuthContext] Failed to update last_login_at:', err));
        }

        if (event === 'PASSWORD_RECOVERY') {
          window.location.href = '/reset-password';
        }
      } else {
        bootstrapRequestIdRef.current += 1;
        fetchInProgressRef.current = null;
        lastFetchedUserIdRef.current = null;
        setProfile(null);
        setPlatformAdmin(null);
        setTenant(null);
        setPrimaryTenant(null);
        setAccessibleLocations([]);
        setActiveLocationId(null);
        setBranding(null);
        setEnabledModules([]);
        setRoleSettings(null);
        setIsParentTenant(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevMode]);

  // Resume without duplicating the TOKEN_REFRESHED bootstrap or blocking UI.
  useEffect(() => {
    let isMounted = true;
    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
    const resume = createSessionResumeHandler({
      getSession: () => supabase.auth.getSession(),
      refreshSession: () => supabase.auth.refreshSession(),
      isActive: () => isMounted && Boolean(user?.id),
      onLongResume: () => window.dispatchEvent(new CustomEvent('app-resumed')),
      onError: (error) => console.error('[Session] Error during visibility refresh:', error),
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
        const hiddenForMs = Date.now() - hiddenAt;
        hiddenAt = null;
        void resume(hiddenForMs);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, tenantId: string) => {
    // SECURITY: Role is hardcoded to 'employee' to prevent privilege escalation.
    // Role upgrades must be performed by an authorized admin via the server-side
    // /api/users/invite endpoint. Never accept role from client input.
    const role: UserRole = 'employee';

    // First, create the auth user
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return { error: error as Error };
    }

    if (data.user) {
      // Create user profile
      const { error: profileError } = await supabase.from('user_profiles').insert({
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
    setRoleSettings(null);
    // Navigate to login page
    window.location.href = '/login';
  };

  const refreshEnabledModules = useCallback(async () => {
    // Use the current tenant (which may differ from profile.tenant_id after location switch)
    const currentTenantId = tenant?.id || profile?.tenant_id;
    if (!currentTenantId) return;

    try {
      const { data, error } = await supabase.rpc('get_tenant_enabled_modules', {
        p_tenant_id: currentTenantId,
      });

      if (error) {
        console.warn('Module refresh RPC failed:', getErrorMessage(error));
        setEnabledModules([]);
      } else {
        setEnabledModules((data || []) as ModuleId[]);
      }
    } catch (err: unknown) {
      console.error('Error refreshing modules:', getErrorMessage(err));
      setEnabledModules([]);
    }
  }, [tenant?.id, profile?.tenant_id]);

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
    const def = MODULE_REGISTRY[module as ModuleId];
    return def ? hasRole(def.minRole) : false;
  };

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => {
      if (!profile) return false;
      // Owner always has everything
      if (profile.role === 'owner') return true;

      if (roleSettings) {
        const mySetting = roleSettings.find((s) => s.role === profile.role);
        if (mySetting) return mySetting[permission] === true;
      }

      // Fallback to hardcoded defaults if role settings aren't loaded
      const defaults: Record<UserRole, Set<PermissionKey>> = {
        owner: new Set<PermissionKey>([
          'approve_time_off',
          'approve_time_edits',
          'manage_shifts',
          'delete_shifts',
          'manage_recipes',
          'manage_users',
          'view_reports',
          'export_payroll',
          'manage_equipment',
          'manage_tasks',
          'manage_orders',
          'manage_branding',
          'manage_locations',
          'manage_cash_deposits',
          'approve_timesheets',
        ]),
        manager: new Set<PermissionKey>([
          'approve_time_off',
          'approve_time_edits',
          'manage_shifts',
          'delete_shifts',
          'manage_recipes',
          'manage_users',
          'view_reports',
          'export_payroll',
          'manage_equipment',
          'manage_tasks',
          'manage_orders',
          'manage_cash_deposits',
          'approve_timesheets',
        ]),
        lead: new Set<PermissionKey>(['approve_time_off', 'approve_time_edits', 'manage_shifts', 'view_reports']),
        employee: new Set<PermissionKey>([]),
      };
      return defaults[profile.role]?.has(permission) ?? false;
    },
    [profile, roleSettings]
  );

  const getRoleDisplayName = useCallback(
    (role: UserRole): string => {
      if (roleSettings) {
        const setting = roleSettings.find((s) => s.role === role);
        if (setting?.display_name) return setting.display_name;
      }
      return role.charAt(0).toUpperCase() + role.slice(1);
    },
    [roleSettings]
  );

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

  const switchLocation = useCallback(
    async (locationId: string) => {
      const targetLocation = accessibleLocations.find((loc) => loc.id === locationId);
      if (!user || !targetLocation) {
        console.error('Cannot switch to inaccessible location:', locationId);
        return false;
      }
      // Commit tenant, branding, modules and role settings together only after
      // the server confirms this location remains accessible.
      const switched = await fetchUserData(user.id, 0, true, undefined, locationId);
      if (!switched) return false;

      Promise.resolve(
        supabase
          .from('user_tenant_assignments')
          .update({ updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('tenant_id', locationId)
      ).catch((err: unknown) => console.warn('[AuthContext] Failed to record location switch activity:', err));

      const committedRequestId = bootstrapRequestIdRef.current;
      window.setTimeout(() => {
        if (committedRequestId === bootstrapRequestIdRef.current) {
          window.dispatchEvent(new CustomEvent('location-changed', { detail: { locationId } }));
        }
      }, 0);
      return true;
    },
    [accessibleLocations, user, fetchUserData]
  );

  // Platform admin: enter a tenant's dashboard view (requires profile or assignment)
  const enterTenantView = useCallback(
    async (tenantId: string) => {
      if (!user || !platformAdmin) return;

      // Load profile, assignment, and tenant data in parallel
      const [profileResult, assignmentResult, tenantResult, brandingResult, modulesResult] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).eq('tenant_id', tenantId).maybeSingle(),
        supabase
          .from('user_tenant_assignments')
          .select('role')
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase.from('tenants').select('*').eq('id', tenantId).single(),
        supabase.from('tenant_branding').select('*').eq('tenant_id', tenantId).maybeSingle(),
        supabase.rpc('get_tenant_enabled_modules', { p_tenant_id: tenantId }),
      ]);

      if (!tenantResult.data) return;

      // Use direct profile if available, otherwise build one from the assignment
      const effectiveProfile: UserProfile =
        profileResult.data ||
        (assignmentResult.data
          ? {
              id: user.id,
              tenant_id: tenantId,
              email: platformAdmin.email,
              full_name: platformAdmin.full_name,
              role: (assignmentResult.data.role || 'owner') as UserRole,
              is_active: true,
              avatar_url: null,
              start_date: null,
            }
          : null!);

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
    },
    [user, platformAdmin]
  );

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
    if (platformAdmin && !adminViewingTenant) {
      const savedTenantId = sessionStorage.getItem('admin_view_tenant_id');
      if (savedTenantId) {
        enterTenantView(savedTenantId);
      }
    }
  }, [platformAdmin, adminViewingTenant, enterTenantView]);

  const contextValue = useMemo(
    () => ({
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
      roleSettings,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole,
      hasPermission,
      getRoleDisplayName,
      canAccessModule,
      refreshEnabledModules,
      switchLocation,
      retryProfileFetch,
      isParentTenant,
      adminViewingTenant,
      enterTenantView,
      exitTenantView,
    }),
    [
      user,
      session,
      profile,
      platformAdmin,
      tenant,
      primaryTenant,
      accessibleLocations,
      activeLocationId,
      branding,
      enabledModules,
      roleSettings,
      loading,
      hasPermission,
      getRoleDisplayName,
      refreshEnabledModules,
      switchLocation,
      retryProfileFetch,
      isParentTenant,
      adminViewingTenant,
      enterTenantView,
      exitTenantView,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
