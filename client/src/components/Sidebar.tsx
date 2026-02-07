import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useAuth, type ModuleId } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Calculator,
  DollarSign,
  Receipt,
  Coffee,
  Wrench,
  ListTodo,
  Building2,
  Users,
  Palette,
  CreditCard,
  User,
  LogOut,
  Lock,
  ChevronDown,
  ArrowLeft,
  Shield,
  MapPin,
  Check,
  type LucideIcon,
} from 'lucide-react';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
};

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
      { key: 'settings', label: 'Overhead' },
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
};

const ALL_MODULE_IDS: ModuleId[] = [
  'recipe-costing',
  'tip-payout',
  'cash-deposit',
  'bulk-ordering',
  'equipment-maintenance',
  'admin-tasks',
];

export function Sidebar() {
  const [location] = useLocation();
  const { profile, branding, tenant, accessibleLocations, switchLocation, enabledModules, canAccessModule, signOut, hasRole, isPlatformAdmin, adminViewingTenant, exitTenantView } = useAuth();
  const [, setLocation] = useLocation();
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Close location dropdown on outside click
  useEffect(() => {
    if (!locationDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [locationDropdownOpen]);

  const displayName = branding?.company_name || tenant?.name || 'Coffee Suite';
  const isManager = hasRole('manager');
  const isOwner = profile?.role === 'owner';
  const hasMultipleLocations = accessibleLocations.length > 1;

  const disabledModules = ALL_MODULE_IDS.filter((m) => !enabledModules.includes(m));

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col h-screen sticky top-0 border-r overflow-y-auto"
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

      {/* Branding */}
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

        {/* Module divider */}
        <div className="pt-3 pb-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider px-2"
            style={{ color: colors.brownLight }}
          >
            Modules
          </p>
        </div>

        {/* Location switcher */}
        {hasMultipleLocations && (
          <div ref={locationDropdownRef} className="relative px-2 pb-1">
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-gray-50"
              style={{ color: colors.brown }}
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
                className="absolute left-2 right-2 mt-1 rounded-md shadow-lg border z-50 py-1"
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

        {/* Enabled modules */}
        {enabledModules.map((moduleId) => {
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
                currentLocation={location}
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

        {/* Disabled module teasers */}
        {disabledModules.map((moduleId) => {
          const nav = MODULE_NAV[moduleId];
          if (!nav) return null;
          return (
            <SidebarLink
              key={moduleId}
              href="/billing"
              label={nav.label}
              icon={Lock}
              isActive={false}
              muted
            />
          );
        })}

        {/* Admin section */}
        {isManager && (
          <>
            <div className="pt-3 pb-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider px-2"
                style={{ color: colors.brownLight }}
              >
                Admin
              </p>
            </div>
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
      </nav>

      {/* User section */}
      <div className="p-3 border-t space-y-1" style={{ borderColor: colors.creamDark }}>
        <SidebarLink
          href="/user-profile"
          label={profile?.full_name?.split(' ')[0] || 'Profile'}
          icon={User}
          isActive={location === '/user-profile'}
        />
        {isPlatformAdmin && !adminViewingTenant && (
          <SidebarLink
            href="/platform-admin"
            label="Platform Admin"
            icon={Shield}
            isActive={location === '/platform-admin'}
          />
        )}
        <button
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors"
          style={{ color: colors.brownLight }}
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

function ExpandableModule({
  nav,
  isOnModule,
  currentLocation,
}: {
  nav: NavItem;
  isOnModule: boolean;
  currentLocation: string;
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
  muted,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  disabled?: boolean;
  muted?: boolean;
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
        } ${muted ? 'opacity-50' : ''}`}
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
