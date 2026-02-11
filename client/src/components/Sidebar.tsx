import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useAuth, type ModuleId } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import {
  LayoutDashboard,
  Calculator,
  DollarSign,
  Receipt,
  Coffee,
  Wrench,
  ListTodo,
  CalendarDays,
  Building2,
  Users,
  Palette,
  CreditCard,
  User,
  LogOut,
  ChevronDown,
  ArrowLeft,
  Shield,
  MapPin,
  Check,
  Sparkles,
  Settings,
  Search,
  BarChart3,
  Gift,
  type LucideIcon,
} from 'lucide-react';

interface SubTab {
  key: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  tabs?: SubTab[];
}

const MODULE_NAV: Record<ModuleId, NavItem> = {
  'recipe-costing': {
    href: '/recipe-costing',
    label: 'Recipe Costing',
    icon: Calculator,
    tabs: [
      { key: 'pricing', label: 'Pricing Matrix' },
      { key: 'ingredients', label: 'Ingredients' },
      { key: 'recipes', label: 'Recipes' },
      { key: 'vendors', label: 'Vendors' },
      { key: 'bases', label: 'Bases' },
      { key: 'overhead', label: 'Overhead' },
      { key: 'settings', label: 'Settings' },
    ],
  },
  'tip-payout': { href: '/tip-payout', label: 'Tip Payout', icon: DollarSign },
  'cash-deposit': { href: '/cash-deposit', label: 'Cash Deposit', icon: Receipt },
  'bulk-ordering': { href: '/coffee-order', label: 'Coffee Orders', icon: Coffee },
  'equipment-maintenance': {
    href: '/equipment-maintenance',
    label: 'Equipment',
    icon: Wrench,
    tabs: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'equipment', label: 'Equipment' },
    ],
  },
  'admin-tasks': { href: '/admin-tasks', label: 'Tasks', icon: ListTodo },
  'calendar-workforce': {
    href: '/calendar-workforce',
    label: 'Calendar',
    icon: CalendarDays,
    tabs: [
      { key: 'schedule', label: 'Schedule' },
      { key: 'time-off', label: 'Time Off' },
      { key: 'time-clock', label: 'Time Clock' },
      { key: 'export', label: 'Export' },
    ],
  },
  'reporting': { href: '/reporting', label: 'Reporting', icon: BarChart3 },
};

interface NavCategory {
  label: string;
  modules: ModuleId[];
}

const NAV_CATEGORIES: NavCategory[] = [
  { label: 'Operations', modules: ['tip-payout', 'cash-deposit', 'bulk-ordering'] },
  { label: 'Kitchen', modules: ['recipe-costing'] },
  { label: 'Scheduling', modules: ['calendar-workforce', 'admin-tasks'] },
  { label: 'Maintenance', modules: ['equipment-maintenance'] },
  { label: 'Analytics', modules: ['reporting'] },
];

const ALL_MODULE_IDS: ModuleId[] = [
  'recipe-costing',
  'tip-payout',
  'cash-deposit',
  'bulk-ordering',
  'equipment-maintenance',
  'admin-tasks',
  'calendar-workforce',
  'reporting',
];

export function Sidebar() {
  const [location] = useLocation();
  const { profile, branding, tenant, accessibleLocations, switchLocation, enabledModules, canAccessModule, signOut, hasRole, isPlatformAdmin, adminViewingTenant, exitTenantView } = useAuth();
  const [, setLocation] = useLocation();
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(() => {
    return location.startsWith('/admin') || location === '/billing' || location === '/organization';
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!locationDropdownOpen && !userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (locationDropdownOpen && locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setLocationDropdownOpen(false);
      }
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [locationDropdownOpen, userMenuOpen]);

  const [whatsNewBadge, setWhatsNewBadge] = useState(false);

  // Listen for badge status from WhatsNew component
  useEffect(() => {
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setWhatsNewBadge(detail.hasNew);
    };
    window.addEventListener('whats-new-status', handleStatus);
    return () => window.removeEventListener('whats-new-status', handleStatus);
  }, []);

  const displayName = branding?.company_name || tenant?.name || 'Coffee Suite';
  const isManager = hasRole('manager');
  const isOwner = profile?.role === 'owner';
  const hasMultipleLocations = accessibleLocations.length > 1;

  const disabledModules = ALL_MODULE_IDS.filter((m) => !enabledModules.includes(m));
  const hasDisabledModules = disabledModules.length > 0;

  // Trial countdown
  const isTrial = tenant?.subscription_plan === 'free' || !tenant?.subscription_plan;
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  // Check if settings section has an active page
  const isSettingsActive = location.startsWith('/admin') || location === '/billing' || location === '/organization';

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col h-full overflow-y-auto border-r"
      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
    >
      {/* Back to Admin banner */}
      {adminViewingTenant && (
        <button
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.brown }}
          onClick={() => {
            exitTenantView();
            setLocation('/platform-admin');
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </button>
      )}

      {/* Branding + Location switcher */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: colors.creamDark }}>
        <Link href="/">
          <button className="flex flex-col items-center gap-1.5 w-full">
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt={displayName} className="h-10 w-auto" />
            ) : (
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: branding?.primary_color || colors.gold }}
              >
                <span className="text-sm font-bold" style={{ color: colors.brown }}>
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm font-bold text-center leading-tight" style={{ color: colors.brown }}>
              {displayName}
            </span>
          </button>
        </Link>

        {/* Location switcher — in header area for prominence */}
        {hasMultipleLocations && (
          <div ref={locationDropdownRef} className="relative mt-2">
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-gray-50"
              style={{ color: colors.brown, backgroundColor: colors.cream }}
              onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
            >
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.gold }} />
              <span className="truncate font-medium">{tenant?.name || 'Select location'}</span>
              <ChevronDown
                className={`w-3 h-3 ml-auto flex-shrink-0 transition-transform ${locationDropdownOpen ? 'rotate-180' : ''}`}
                style={{ color: colors.brownLight }}
              />
            </button>
            {locationDropdownOpen && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-md shadow-lg border z-50 py-1"
                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
              >
                {accessibleLocations.map((loc) => {
                  const isActive = loc.id === tenant?.id;
                  return (
                    <button
                      key={loc.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-gray-50"
                      style={{
                        color: isActive ? colors.gold : colors.brown,
                        fontWeight: isActive ? 600 : 400,
                      }}
                      onClick={async () => {
                        if (!isActive) {
                          await switchLocation(loc.id);
                        }
                        setLocationDropdownOpen(false);
                      }}
                    >
                      {isActive && <Check className="w-3 h-3 flex-shrink-0" />}
                      <span className={`truncate ${isActive ? '' : 'ml-5'}`}>{loc.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Trial countdown badge */}
        {isTrial && trialDaysLeft !== null && (
          <Link href="/billing">
            <button
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-90"
              style={{
                backgroundColor: trialDaysLeft <= 3 ? '#fef2f2' : '#eff6ff',
                color: trialDaysLeft <= 3 ? '#dc2626' : '#2563eb',
              }}
            >
              <Sparkles className="w-3 h-3" />
              {trialDaysLeft > 0
                ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left`
                : 'Trial expired'}
            </button>
          </Link>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {/* Dashboard */}
        <SidebarLink
          href="/"
          label="Dashboard"
          icon={LayoutDashboard}
          isActive={location === '/' || location === '/dashboard'}
        />

        {/* Search trigger for command palette */}
        <button
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors hover:bg-gray-50"
          style={{ color: colors.brownLight }}
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs">Search...</span>
          <kbd
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded border font-mono"
            style={{ borderColor: colors.creamDark, color: colors.brownLight, backgroundColor: colors.cream }}
          >
            {/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+'}K
          </kbd>
        </button>

        {/* My Team — free, not module-gated */}
        <SidebarLink
          href="/my-team"
          label="My Team"
          icon={Users}
          isActive={location === '/my-team'}
        />

        {/* Module categories */}
        {NAV_CATEGORIES.map((category) => {
          const enabledInCategory = category.modules.filter((m) => enabledModules.includes(m));
          if (enabledInCategory.length === 0) return null;

          return (
            <div key={category.label}>
              <div className="pt-3 pb-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider px-2"
                  style={{ color: colors.brownLight }}
                >
                  {category.label}
                </p>
              </div>
              {enabledInCategory.map((moduleId) => {
                const nav = MODULE_NAV[moduleId];
                if (!nav) return null;
                const accessible = canAccessModule(moduleId);
                const isOnModule = location === nav.href;

                if (nav.tabs && accessible) {
                  return (
                    <ExpandableModule
                      key={moduleId}
                      nav={nav}
                      isOnModule={isOnModule}
                    />
                  );
                }

                return (
                  <SidebarLink
                    key={moduleId}
                    href={nav.href}
                    label={nav.label}
                    icon={nav.icon}
                    isActive={isOnModule}
                    disabled={!accessible}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Explore modules link — only if there are disabled modules */}
        {hasDisabledModules && (
          <div className="pt-2">
            <Link href="/billing">
              <button
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-xs transition-colors hover:bg-gray-50"
                style={{ color: colors.brownLight }}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: colors.gold }} />
                <span>Explore modules</span>
              </button>
            </Link>
          </div>
        )}

        {/* Settings section — manager+ only */}
        {isManager && (
          <>
            <div className="pt-3 pb-1">
              <button
                className="w-full flex items-center justify-between px-2"
                onClick={() => setSettingsExpanded(!settingsExpanded)}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isSettingsActive ? colors.gold : colors.brownLight }}
                >
                  Settings
                </p>
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${settingsExpanded ? '' : '-rotate-90'}`}
                  style={{ color: colors.brownLight }}
                />
              </button>
            </div>
            {settingsExpanded && (
              <>
                {isOwner && (
                  <SidebarLink
                    href="/organization"
                    label="Locations"
                    icon={Building2}
                    isActive={location === '/organization' || location === '/admin/locations'}
                  />
                )}
                <SidebarLink
                  href="/admin/users"
                  label="Users"
                  icon={Users}
                  isActive={location === '/admin/users'}
                />
                {isOwner && (
                  <SidebarLink
                    href="/admin/branding"
                    label="Branding"
                    icon={Palette}
                    isActive={location === '/admin/branding'}
                  />
                )}
                {isOwner && (
                  <SidebarLink
                    href="/billing"
                    label="Billing"
                    icon={CreditCard}
                    isActive={location === '/billing'}
                  />
                )}
              </>
            )}
          </>
        )}
      </nav>

      {/* What's New + User section */}
      <div className="p-3 border-t" style={{ borderColor: colors.creamDark }}>
        <button
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors hover:bg-gray-50"
          style={{ color: colors.brown }}
          onClick={() => window.dispatchEvent(new Event('open-whats-new'))}
        >
          <Gift className="w-4 h-4 flex-shrink-0" style={{ color: colors.gold }} />
          <span className="truncate text-sm">What's New</span>
          {whatsNewBadge && (
            <span
              className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: colors.gold }}
            />
          )}
        </button>
      </div>
      <div className="px-3 pb-3" style={{ borderColor: colors.creamDark }}>
        {isPlatformAdmin && !adminViewingTenant && (
          <SidebarLink
            href="/platform-admin"
            label="Platform Admin"
            icon={Shield}
            isActive={location === '/platform-admin'}
          />
        )}
        <div ref={userMenuRef} className="relative">
          <button
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors hover:bg-gray-50"
            style={{ color: colors.brown }}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: colors.cream }}
            >
              <User className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
            </div>
            <span className="truncate text-sm font-medium">
              {profile?.full_name?.split(' ')[0] || 'Profile'}
            </span>
            <ChevronDown
              className={`w-3 h-3 ml-auto flex-shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
              style={{ color: colors.brownLight }}
            />
          </button>
          {userMenuOpen && (
            <div
              className="absolute left-0 right-0 bottom-full mb-1 rounded-md shadow-lg border z-50 py-1"
              style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
            >
              <Link href="/user-profile">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                  style={{ color: colors.brown }}
                  onClick={() => setUserMenuOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  Profile
                </button>
              </Link>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                style={{ color: colors.brownLight }}
                onClick={() => {
                  setUserMenuOpen(false);
                  signOut();
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function ExpandableModule({
  nav,
  isOnModule,
}: {
  nav: NavItem;
  isOnModule: boolean;
}) {
  const [expanded, setExpanded] = useState(isOnModule);
  const Icon = nav.icon;
  const searchString = useSearch();
  const { adminViewingTenant } = useAuth();

  // Hide recipes tab from platform admins to protect proprietary recipes
  const visibleTabs = adminViewingTenant
    ? nav.tabs?.filter((tab) => tab.key !== 'recipes')
    : nav.tabs;

  // Get the active tab from the URL search params
  const activeTab = isOnModule
    ? new URLSearchParams(searchString).get('tab') || visibleTabs![0].key
    : null;

  return (
    <div>
      <div className="flex items-center">
        <Link href={nav.href}>
          <button
            className={`flex-1 flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
              isOnModule ? 'font-medium' : 'hover:bg-gray-50'
            }`}
            style={{
              color: isOnModule ? colors.gold : colors.brown,
              backgroundColor: isOnModule ? colors.cream : undefined,
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{nav.label}</span>
          </button>
        </Link>
        <button
          className="p-1.5 rounded-md hover:bg-gray-50 transition-colors"
          onClick={() => setExpanded(!expanded)}
          style={{ color: colors.brownLight }}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
        </button>
      </div>
      {expanded && visibleTabs && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {visibleTabs.map((tab) => {
            const isActiveTab = isOnModule && activeTab === tab.key;
            return (
              <Link key={tab.key} href={`${nav.href}?tab=${tab.key}`}>
                <button
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isActiveTab ? 'font-medium' : 'hover:bg-gray-50'
                  }`}
                  style={{
                    color: isActiveTab ? colors.gold : colors.brownLight,
                    backgroundColor: isActiveTab ? colors.cream : undefined,
                  }}
                >
                  {tab.label}
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  isActive,
  disabled,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div
        className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm opacity-40 cursor-not-allowed"
        style={{ color: colors.brownLight }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  return (
    <Link href={href}>
      <button
        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
          isActive ? 'font-medium' : 'hover:bg-gray-50'
        }`}
        style={{
          color: isActive ? colors.gold : colors.brown,
          backgroundColor: isActive ? colors.cream : undefined,
        }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    </Link>
  );
}
