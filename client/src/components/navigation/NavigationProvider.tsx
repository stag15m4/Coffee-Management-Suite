import { createContext, useContext, useMemo } from 'react';
import { useAuth, type ModuleId, type UserRole } from '@/contexts/AuthContext';
import { useTerm } from '@/hooks/use-term';
import { useModuleRollout } from '@/hooks/use-module-rollout';
import { MODULE_REGISTRY, getModuleIcon, getMobileModulePriority, type NavTab } from '@/lib/module-registry';
import {
  LayoutDashboard,
  Users,
  Palette,
  Building2,
  CreditCard,
  Settings,
  User,
  Shield,
  MoreHorizontal,
  Plug,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { NavTab };

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  module?: ModuleId;
  requiredRole?: UserRole;
  badge?: string;
  isAccessible: boolean;
  tabs?: NavTab[];
}

export interface NavigationContextType {
  primaryItems: NavItem[];
  settingsItems: NavItem[];
  utilityItems: NavItem[];
  adminItems: NavItem[];
  mobileTabItems: NavItem[];
}

// Module nav config derived from registry
const MODULE_NAV_CONFIG = MODULE_REGISTRY;
const MOBILE_MODULE_PRIORITY = getMobileModulePriority();

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const {
    profile,
    enabledModules,
    canAccessModule,
    hasRole,
    isPlatformAdmin,
    adminViewingTenant,
  } = useAuth();

  const { termPlural } = useTerm();
  const { getRolloutBadge } = useModuleRollout();

  const navigation = useMemo<NavigationContextType>(() => {
    // ----- Helper: resolve the display label for a module -----
    function getModuleLabel(config: { labelKey: string; staticLabel?: string }): string {
      if (config.staticLabel) return config.staticLabel;
      return termPlural(config.labelKey);
    }

    // ----- Helper: build a NavItem from module config -----
    function buildModuleItem(moduleId: ModuleId): NavItem {
      const config = MODULE_NAV_CONFIG[moduleId];
      const accessible = canAccessModule(moduleId);
      return {
        id: config.id,
        label: getModuleLabel(config),
        href: config.route,
        icon: getModuleIcon(moduleId),
        module: moduleId,
        isAccessible: accessible,
        tabs: config.tabs,
        badge: getRolloutBadge(moduleId),
      };
    }

    // -----------------------------------------------------------------------
    // Primary items: Dashboard + enabled module items
    // -----------------------------------------------------------------------

    const dashboardItem: NavItem = {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      isAccessible: true,
    };

    const moduleItems: NavItem[] = enabledModules.map(buildModuleItem);

    const primaryItems: NavItem[] = [dashboardItem, ...moduleItems];

    // -----------------------------------------------------------------------
    // Settings items (manager+ only)
    // -----------------------------------------------------------------------

    const settingsItems: NavItem[] = [
      {
        id: 'settings-users',
        label: 'Users',
        href: '/admin/users',
        icon: Users,
        requiredRole: 'manager',
        isAccessible: hasRole('manager'),
      },
      {
        id: 'settings-branding',
        label: 'Branding',
        href: '/admin/branding',
        icon: Palette,
        requiredRole: 'owner',
        isAccessible: hasRole('owner'),
      },
      {
        id: 'settings-locations',
        label: 'Locations',
        href: '/organization',
        icon: Building2,
        requiredRole: 'owner',
        isAccessible: hasRole('owner'),
      },
      {
        id: 'settings-billing',
        label: 'Billing',
        href: '/billing',
        icon: CreditCard,
        requiredRole: 'owner',
        isAccessible: hasRole('owner'),
      },
      {
        id: 'settings-role-settings',
        label: 'Role Settings',
        href: '/admin/role-settings',
        icon: Settings,
        requiredRole: 'owner',
        isAccessible: hasRole('owner'),
      },
      {
        id: 'settings-integrations',
        label: 'Integrations',
        href: '/admin/integrations',
        icon: Plug,
        requiredRole: 'owner',
        isAccessible: hasRole('owner'),
      },
    ];

    // -----------------------------------------------------------------------
    // Utility items
    // -----------------------------------------------------------------------

    const utilityItems: NavItem[] = [
      {
        id: 'my-team',
        label: 'My Team',
        href: '/my-team',
        icon: Users,
        isAccessible: true,
      },
      {
        id: 'user-profile',
        label: 'Profile',
        href: '/user-profile',
        icon: User,
        isAccessible: true,
      },
    ];

    // -----------------------------------------------------------------------
    // Admin items (platform admins only)
    // -----------------------------------------------------------------------

    const adminItems: NavItem[] = [];

    if (isPlatformAdmin && !adminViewingTenant) {
      adminItems.push({
        id: 'platform-admin',
        label: 'Platform Admin',
        href: '/platform-admin',
        icon: Shield,
        isAccessible: true,
      });
    }

    // -----------------------------------------------------------------------
    // Mobile tab items: max 5 (Dashboard + up to 3 modules + More)
    // -----------------------------------------------------------------------

    const accessibleModulesByPriority = MOBILE_MODULE_PRIORITY
      .filter((moduleId) => {
        const item = moduleItems.find((mi) => mi.id === moduleId);
        return item?.isAccessible;
      })
      .map((moduleId) => moduleItems.find((mi) => mi.id === moduleId)!);

    const topModules = accessibleModulesByPriority.slice(0, 3);
    const hasRemainingItems = accessibleModulesByPriority.length > 3;

    const mobileTabItems: NavItem[] = [dashboardItem, ...topModules];

    if (hasRemainingItems) {
      mobileTabItems.push({
        id: 'more',
        label: 'More',
        href: '#more',
        icon: MoreHorizontal,
        isAccessible: true,
      });
    }

    return {
      primaryItems,
      settingsItems,
      utilityItems,
      adminItems,
      mobileTabItems,
    };
  }, [
    enabledModules,
    canAccessModule,
    hasRole,
    isPlatformAdmin,
    adminViewingTenant,
    profile,
    termPlural,
    getRolloutBadge,
  ]);

  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
