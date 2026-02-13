import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useNavigation, type NavItem } from './NavigationProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeProvider';
import {
  ChevronDown, Lock, LogOut, MapPin, Check,
  Settings, ArrowLeft, User, type LucideIcon,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

// ---------------------------------------------------------------------------
// DesktopSidebar
// ---------------------------------------------------------------------------

export function DesktopSidebar({ className }: { className?: string }) {
  const [location, setLocation] = useLocation();
  const { primaryItems, settingsItems, utilityItems, adminItems } = useNavigation();
  const {
    profile,
    tenant,
    accessibleLocations,
    switchLocation,
    signOut,
    hasRole,
    adminViewingTenant,
    exitTenantView,
  } = useAuth();
  const { meta } = useTheme();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  const displayName = meta.companyName || tenant?.name || 'Dashboard';
  const hasMultipleLocations = accessibleLocations.length > 1;
  const isManager = hasRole('manager');

  // Close location dropdown on outside click
  useEffect(() => {
    if (!locationDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node))
        setLocationDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [locationDropdownOpen]);

  return (
    <aside
      className={className || "hidden lg:flex w-56 flex-shrink-0 flex-col h-screen sticky top-0 border-r"}
      style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
    >
      {/* Back to Admin banner */}
      {adminViewingTenant && (
        <button
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-secondary)' }}
          onClick={() => {
            exitTenantView();
            setLocation('/platform-admin');
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </button>
      )}

      {/* ---- Header ---- */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--color-accent-dark)' }}>
        <Link href="/">
          <button className="flex items-center gap-2.5 w-full">
            {meta.logoUrl ? (
              <img src={meta.logoUrl} alt={displayName} className="h-8 w-auto flex-shrink-0" />
            ) : (
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {displayName.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span
              className="text-sm font-bold truncate"
              style={{ color: 'var(--color-secondary)' }}
            >
              {displayName}
            </span>
          </button>
        </Link>

        {/* Location switcher */}
        {hasMultipleLocations && (
          <div ref={locationRef} className="relative mt-2">
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:opacity-80"
              style={{ color: 'var(--color-secondary)', backgroundColor: 'var(--color-accent)' }}
              onClick={() => setLocationDropdownOpen(!locationDropdownOpen)}
            >
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="truncate font-medium">{tenant?.name || 'Select location'}</span>
              <ChevronDown
                className={`w-3 h-3 ml-auto flex-shrink-0 transition-transform ${locationDropdownOpen ? 'rotate-180' : ''}`}
                style={{ color: 'var(--color-secondary-light)' }}
              />
            </button>

            {locationDropdownOpen && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-md shadow-lg border z-50 py-1"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
              >
                {accessibleLocations.map((loc) => {
                  const isActive = loc.id === tenant?.id;
                  return (
                    <button
                      key={loc.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:opacity-80"
                      style={{
                        color: isActive ? 'var(--color-primary)' : 'var(--color-secondary)',
                        fontWeight: isActive ? 600 : 400,
                      }}
                      onClick={async () => {
                        if (!isActive) await switchLocation(loc.id);
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
      </div>

      {/* ---- Primary nav (scrollable) ---- */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {primaryItems.map((item) => (
          <SidebarNavItem key={item.id} item={item} currentPath={location} />
        ))}
      </nav>

      {/* ---- Footer section ---- */}
      <div className="border-t p-3 space-y-0.5" style={{ borderColor: 'var(--color-accent-dark)' }}>
        {/* Utility items (My Team, Profile) */}
        {utilityItems.map((item) => (
          <SidebarLink
            key={item.id}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={location === item.href}
          />
        ))}

        {/* Settings button for manager+ */}
        {isManager && (
          <>
            <button
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--color-secondary)' }}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-secondary-light)' }} />
              <span>Settings</span>
            </button>

            {/* Settings sheet/drawer */}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetContent side="left" className="w-72 p-0">
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-accent-dark)' }}>
                  <SheetTitle
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-secondary)' }}
                  >
                    Settings
                  </SheetTitle>
                </div>
                <div className="p-3 space-y-0.5">
                  {settingsItems
                    .filter((item) => item.isAccessible)
                    .map((item) => (
                      <SidebarLink
                        key={item.id}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        isActive={location === item.href}
                        onClick={() => setSettingsOpen(false)}
                      />
                    ))}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}

        {/* Platform admin link */}
        {adminItems.map((item) => (
          <SidebarLink
            key={item.id}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={location === item.href}
          />
        ))}

        {/* User + Sign out */}
        <div className="pt-1 mt-1 border-t" style={{ borderColor: 'var(--color-accent-dark)' }}>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent)' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                : <User className="w-3.5 h-3.5" style={{ color: 'var(--color-secondary-light)' }} />}
            </div>
            <span className="text-sm font-medium truncate" style={{ color: 'var(--color-secondary)' }}>
              {profile?.full_name?.split(' ')[0] || 'Profile'}
            </span>
          </div>
          <button
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--color-secondary-light)' }}
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// SidebarNavItem — handles expandable items with tabs
// ---------------------------------------------------------------------------

function SidebarNavItem({ item, currentPath }: { item: NavItem; currentPath: string }) {
  const isOnPage = currentPath === item.href;
  const hasTabs = item.tabs && item.tabs.length > 0;
  const [expanded, setExpanded] = useState(isOnPage);

  // Expand automatically when navigating to this module
  useEffect(() => {
    if (isOnPage && hasTabs) setExpanded(true);
  }, [isOnPage, hasTabs]);

  // Inaccessible item
  if (!item.isAccessible) {
    return (
      <div
        className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm opacity-40 cursor-not-allowed"
        style={{ color: 'var(--color-secondary-light)' }}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        <Lock className="w-3 h-3 ml-auto flex-shrink-0" />
      </div>
    );
  }

  // Simple item (no tabs)
  if (!hasTabs) {
    return (
      <SidebarLink
        href={item.href}
        label={item.label}
        icon={item.icon}
        isActive={isOnPage}
        badge={item.badge}
      />
    );
  }

  // Expandable item with sub-tabs
  const activeTab = isOnPage
    ? new URLSearchParams(window.location.search).get('tab') || item.tabs![0].id
    : null;

  return (
    <div>
      <div className="flex items-center">
        <Link href={item.href}>
          <button
            className={`flex-1 flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
              isOnPage ? 'font-medium' : 'hover:opacity-80'
            }`}
            style={{
              color: isOnPage ? 'var(--color-primary)' : 'var(--color-secondary)',
              backgroundColor: isOnPage ? 'var(--color-primary-light)' : undefined,
              borderLeft: isOnPage ? '3px solid var(--color-primary)' : '3px solid transparent',
            }}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        </Link>
        <button
          className="p-1.5 rounded-md transition-colors hover:opacity-80"
          style={{ color: 'var(--color-secondary-light)' }}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
        </button>
      </div>

      {expanded && item.tabs && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {item.tabs.map((tab) => {
            const isActiveTab = isOnPage && activeTab === tab.id;
            return (
              <Link key={tab.id} href={`${item.href}?tab=${tab.id}`}>
                <button
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isActiveTab ? 'font-medium' : 'hover:opacity-80'
                  }`}
                  style={{
                    color: isActiveTab ? 'var(--color-primary)' : 'var(--color-secondary-light)',
                    backgroundColor: isActiveTab ? 'var(--color-primary-light)' : undefined,
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

// ---------------------------------------------------------------------------
// SidebarLink — single nav link
// ---------------------------------------------------------------------------

function SidebarLink({
  href,
  label,
  icon: Icon,
  isActive,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href}>
      <button
        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
          isActive ? 'font-medium' : 'hover:opacity-80'
        }`}
        style={{
          color: isActive ? 'var(--color-primary)' : 'var(--color-secondary)',
          backgroundColor: isActive ? 'var(--color-primary-light)' : undefined,
          borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
        }}
        onClick={onClick}
      >
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-secondary-light)' }}
        />
        <span className="truncate">{label}</span>
        {badge && (
          <span
            className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
          >
            {badge}
          </span>
        )}
      </button>
    </Link>
  );
}
