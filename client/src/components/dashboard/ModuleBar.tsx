import { useAuth, type ModuleId } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { Lock, Calculator, DollarSign, Receipt, Coffee, Wrench, ListTodo, CalendarDays, type LucideIcon } from 'lucide-react';
import { ALL_MODULES } from '@/hooks/use-store-metrics';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
};

const MODULE_INFO: Record<ModuleId, { name: string; shortName: string; icon: LucideIcon; href: string }> = {
  'recipe-costing': { name: 'Recipe Costing', shortName: 'Recipes', icon: Calculator, href: '/recipe-costing' },
  'tip-payout': { name: 'Tip Payout', shortName: 'Tips', icon: DollarSign, href: '/tip-payout' },
  'cash-deposit': { name: 'Cash Deposit', shortName: 'Cash', icon: Receipt, href: '/cash-deposit' },
  'bulk-ordering': { name: 'Coffee Orders', shortName: 'Orders', icon: Coffee, href: '/coffee-order' },
  'equipment-maintenance': { name: 'Equipment Maintenance', shortName: 'Equipment', icon: Wrench, href: '/equipment-maintenance' },
  'admin-tasks': { name: 'Admin Tasks', shortName: 'Tasks', icon: ListTodo, href: '/admin-tasks' },
  'calendar-workforce': { name: 'Calendar & Workforce', shortName: 'Calendar', icon: CalendarDays, href: '/calendar-workforce' },
};

interface ModuleBarProps {
  enabledModules: ModuleId[];
}

export function ModuleBar({ enabledModules }: ModuleBarProps) {
  const { canAccessModule } = useAuth();
  const disabledModules = ALL_MODULES.filter((m) => !enabledModules.includes(m));

  return (
    <div className="space-y-3">
      {/* Enabled modules — tap-friendly grid */}
      {enabledModules.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {enabledModules.map((moduleId) => {
            const info = MODULE_INFO[moduleId];
            const Icon = info.icon;
            const hasAccess = canAccessModule(moduleId);

            if (!hasAccess) {
              // User's role doesn't have access — show muted
              return (
                <div
                  key={moduleId}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg opacity-40"
                  style={{ backgroundColor: colors.cream }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.creamDark }}
                  >
                    <Icon className="w-5 h-5" style={{ color: colors.brownLight }} />
                  </div>
                  <span className="text-xs text-center font-medium" style={{ color: colors.brownLight }}>
                    {info.shortName}
                  </span>
                </div>
              );
            }

            return (
              <Link key={moduleId} href={info.href}>
                <button className="w-full flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors active:scale-95">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.gold }}
                  >
                    <Icon className="w-5 h-5" style={{ color: colors.brown }} />
                  </div>
                  <span className="text-xs text-center font-medium" style={{ color: colors.brown }}>
                    {info.shortName}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {/* Disabled modules — compact teaser row */}
      {disabledModules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {disabledModules.map((moduleId) => {
            const info = MODULE_INFO[moduleId];
            return (
              <Link key={moduleId} href="/billing">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full opacity-60 hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: colors.cream }}
                >
                  <Lock className="w-3 h-3" style={{ color: colors.brownLight }} />
                  <span className="text-xs" style={{ color: colors.brownLight }}>
                    {info.shortName}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
