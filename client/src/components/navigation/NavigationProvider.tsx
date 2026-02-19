import { createContext, useContext, useMemo } from 'react';
import { useAuth, type ModuleId, type UserRole } from '@/contexts/AuthContext';
import { useTerm } from '@/hooks/use-term';
import {
  LayoutDashboard,
  Calculator,
  DollarSign,
  Receipt,
  Coffee,
  Wrench,
  ListTodo,
  CalendarDays,
  BarChart3,
  Users,
  Palette,
  Building2,
  CreditCard,
  Settings,
  User,
  Shield,
  MoreHorizontal,
  Plug,
  FileText,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavTab {
  id: string;
  label: string;
}

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

// ---------------------------------------------------------------------------
// Module nav config
// ---------------------------------------------------------------------------

interface ModuleNavConfig {
  id: string;
  route: string;
  icon: LucideIcon;
  labelKey: string;          // key for termPlural(), or empty if using a static label
  staticLabel?: string;      // used when labelKey is not a term key
  tabs?: NavTab[];
}

const MODULE_NAV_CONFIG: Record<ModuleId, ModuleNavConfig> = {
  'recipe-costing': {
    id: 'recipe-costing',
    route: '/recipe-costing',
    icon: Calculator,
    labelKey: 'recipe',
    tabs: [
      { id: 'pricing', label: 'Pricing Matrix' },
      { id: 'ingredients', label: 'Ingredients' },
      { id: 'recipes', label: 'Recipes' },
      { id: 'vendors', label: 'Vendors' },
      { id: 'overhead', label: 'Overhead' },
      { id: 'settings', label: 'Settings' },
    ],
  },
  'tip-payout': {
    id: 'tip-payout',
    route: '/tip-payout',
    icon: DollarSign,
    labelKey: 'tipPayout',
  },
  'cash-deposit': {
    id: 'cash-deposit',
    route: '/cash-deposit',
    icon: Receipt,
    labelKey: 'deposit',
  },
  'bulk-ordering': {
    id: 'bulk-ordering',
    route: '/coffee-order',
    icon: Coffee,
    labelKey: '',
    staticLabel: 'Bulk Ordering',
  },
  'equipment-maintenance': {
    id: 'equipment-maintenance',
    route: '/equipment-maintenance',
    icon: Wrench,
    labelKey: 'equipment',
    tabs: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'equipment', label: 'Equipment' },
    ],
  },
  'admin-tasks': {
    id: 'admin-tasks',
    route: '/admin-tasks',
    icon: ListTodo,
    labelKey: 'task',
  },
  'calendar-workforce': {
    id: 'calendar-workforce',
    route: '/calendar-workforce',
    icon: CalendarDays,
    labelKey: '',
    staticLabel: 'Personnel',
    tabs: [
      { id: 'schedule', label: 'Schedule' },
      { id: 'time-off', label: 'Time Off' },
      { id: 'time-clock', label: 'Time Clock' },
      { id: 'export', label: 'Export' },
    ],
  },
  'reporting': {
    id: 'reporting',
    route: '/reporting',
    icon: BarChart3,
    labelKey: '',
    staticLabel: 'Reporting',
  },
  'document-library': {
    id: 'document-library',
    route: '/document-library',
    icon: FileText,
    labelKey: '',
    staticLabel: 'Documents',
  },
};

/**
 * Priority order for mobile tab bar module selection.
 * The first 3 accessible modules in this order fill slots 2-4 of the bottom tab bar.
 */
const MOBILE_MODULE_PRIORITY: ModuleId[] = [
  'recipe-costing',
  'cash-deposit',
  'tip-payout',
  'equipment-maintenance',
  'calendar-workforce',
  'admin-tasks',
  'bulk-ordering',
  'reporting',
  'document-library',
];

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

  const navigation = useMemo<NavigationContextType>(() => {
    // ----- Helper: resolve the display label for a module -----
    function getModuleLabel(config: ModuleNavConfig): string {
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
        icon: config.icon,
        module: moduleId,
        isAccessible: accessible,
        tabs: config.tabs,
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
