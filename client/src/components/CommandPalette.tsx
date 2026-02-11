import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { useAuth, type ModuleId } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Calculator,
  DollarSign,
  Receipt,
  Coffee,
  Wrench,
  CheckSquare,
  CalendarDays,
  CreditCard,
  Building2,
  Palette,
  MapPin,
  User,
  type LucideIcon,
} from 'lucide-react';

interface CommandRoute {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
  module?: ModuleId;
  adminOnly?: boolean;
}

const PAGES: CommandRoute[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, keywords: ['home', 'overview'] },
  { label: 'My Team', href: '/my-team', icon: Users, keywords: ['team', 'employees', 'staff'] },
  { label: 'Profile', href: '/user-profile', icon: User, keywords: ['account', 'settings', 'me'] },
];

const MODULES: CommandRoute[] = [
  { label: 'Recipe Costing', href: '/recipe-costing', icon: Calculator, module: 'recipe-costing', keywords: ['recipes', 'ingredients', 'pricing', 'overhead', 'vendors', 'bases'] },
  { label: 'Tip Payout', href: '/tip-payout', icon: DollarSign, module: 'tip-payout', keywords: ['tips', 'gratuity'] },
  { label: 'Cash Deposit', href: '/cash-deposit', icon: Receipt, module: 'cash-deposit', keywords: ['deposit', 'cash', 'register', 'drawer'] },
  { label: 'Coffee Orders', href: '/coffee-order', icon: Coffee, module: 'bulk-ordering', keywords: ['order', 'bulk', 'wholesale'] },
  { label: 'Equipment', href: '/equipment-maintenance', icon: Wrench, module: 'equipment-maintenance', keywords: ['maintenance', 'repair', 'machine'] },
  { label: 'Tasks', href: '/admin-tasks', icon: CheckSquare, module: 'admin-tasks', keywords: ['todo', 'checklist', 'assign'] },
  { label: 'Calendar', href: '/calendar-workforce', icon: CalendarDays, module: 'calendar-workforce', keywords: ['schedule', 'shifts', 'time off', 'clock'] },
];

const SETTINGS: CommandRoute[] = [
  { label: 'Locations', href: '/organization', icon: Building2, adminOnly: true, keywords: ['stores', 'organization'] },
  { label: 'Users', href: '/admin/users', icon: Users, adminOnly: true, keywords: ['employees', 'roles', 'invite'] },
  { label: 'Branding', href: '/admin/branding', icon: Palette, adminOnly: true, keywords: ['logo', 'colors', 'theme'] },
  { label: 'Billing', href: '/billing', icon: CreditCard, adminOnly: true, keywords: ['subscription', 'plan', 'payment'] },
];

const RECIPE_TABS: { label: string; tab: string; keywords?: string[] }[] = [
  { label: 'Pricing Matrix', tab: 'pricing', keywords: ['prices', 'margin'] },
  { label: 'Ingredients', tab: 'ingredients', keywords: ['ingredient', 'cost'] },
  { label: 'Recipes', tab: 'recipes', keywords: ['recipe', 'drink'] },
  { label: 'Vendors', tab: 'vendors', keywords: ['supplier', 'vendor'] },
  { label: 'Bases', tab: 'bases', keywords: ['base', 'template'] },
  { label: 'Overhead', tab: 'overhead', keywords: ['overhead', 'labor', 'payroll'] },
  { label: 'Settings', tab: 'settings', keywords: ['export', 'minutes per drink'] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user, canAccessModule, hasRole } = useAuth();

  // Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // G-chord shortcuts: G then D = Dashboard, G then T = Tasks, G then C = Calendar
  useEffect(() => {
    let gPressed = false;
    let timer: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!gPressed) {
          gPressed = true;
          timer = setTimeout(() => { gPressed = false; }, 500);
        }
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(timer);
        if (e.key === 'd') { e.preventDefault(); setLocation('/'); }
        else if (e.key === 't' && canAccessModule?.('admin-tasks')) { e.preventDefault(); setLocation('/admin-tasks'); }
        else if (e.key === 'c' && canAccessModule?.('calendar-workforce')) { e.preventDefault(); setLocation('/calendar-workforce'); }
        else if (e.key === 'r' && canAccessModule?.('recipe-costing')) { e.preventDefault(); setLocation('/recipe-costing'); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); clearTimeout(timer); };
  }, [setLocation, canAccessModule]);

  // Allow opening from sidebar search button via custom event
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  // Don't render for unauthenticated users
  if (!user) return null;

  const isManager = hasRole?.('manager') || hasRole?.('owner');

  const accessibleModules = MODULES.filter(
    (m) => !m.module || canAccessModule?.(m.module)
  );

  const accessibleSettings = isManager ? SETTINGS : [];

  const accessibleRecipeTabs = canAccessModule?.('recipe-costing') ? RECIPE_TABS : [];

  const navigate = (href: string) => {
    setLocation(href);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Where do you want to go?" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGES.map((route) => (
            <CommandItem
              key={route.href}
              value={[route.label, ...(route.keywords || [])].join(' ')}
              onSelect={() => navigate(route.href)}
            >
              <route.icon className="mr-2 h-4 w-4" />
              {route.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {accessibleModules.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Modules">
              {accessibleModules.map((route) => (
                <CommandItem
                  key={route.href}
                  value={[route.label, ...(route.keywords || [])].join(' ')}
                  onSelect={() => navigate(route.href)}
                >
                  <route.icon className="mr-2 h-4 w-4" />
                  {route.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {accessibleRecipeTabs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recipe Costing Tabs">
              {accessibleRecipeTabs.map((tab) => (
                <CommandItem
                  key={tab.tab}
                  value={['Recipe Costing', tab.label, ...(tab.keywords || [])].join(' ')}
                  onSelect={() => navigate(`/recipe-costing?tab=${tab.tab}`)}
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  {tab.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {accessibleSettings.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              {accessibleSettings.map((route) => (
                <CommandItem
                  key={route.href}
                  value={[route.label, ...(route.keywords || [])].join(' ')}
                  onSelect={() => navigate(route.href)}
                >
                  <route.icon className="mr-2 h-4 w-4" />
                  {route.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
