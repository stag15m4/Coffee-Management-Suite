import { useAuth, type ModuleId } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { Lock, Calculator, DollarSign, Receipt, Coffee, Wrench, ListTodo, CalendarDays, BarChart3, FileText, type LucideIcon } from 'lucide-react';
import { ALL_MODULES } from '@/hooks/use-store-metrics';
import { useModuleRollout } from '@/hooks/use-module-rollout';
import { colors } from '@/lib/colors';

const MODULE_INFO: Record<ModuleId, { name: string; shortName: string; icon: LucideIcon; href: string }> = {
  'recipe-costing': { name: 'Recipe Costing', shortName: 'Recipes', icon: Calculator, href: '/recipe-costing' },
  'tip-payout': { name: 'Tip Payout', shortName: 'Tips', icon: DollarSign, href: '/tip-payout' },
  'cash-deposit': { name: 'Cash Deposit', shortName: 'Cash', icon: Receipt, href: '/cash-deposit' },
  'bulk-ordering': { name: 'Coffee Orders', shortName: 'Orders', icon: Coffee, href: '/coffee-order' },
  'equipment-maintenance': { name: 'Equipment Maintenance', shortName: 'Equipment', icon: Wrench, href: '/equipment-maintenance' },
  'admin-tasks': { name: 'Admin Tasks', shortName: 'Tasks', icon: ListTodo, href: '/admin-tasks' },
  'calendar-workforce': { name: 'Personnel', shortName: 'Personnel', icon: CalendarDays, href: '/calendar-workforce' },
  'reporting': { name: 'Reporting', shortName: 'Reports', icon: BarChart3, href: '/reporting' },
  'document-library': { name: 'Document Library', shortName: 'Documents', icon: FileText, href: '/document-library' },
};

interface ModuleBarProps {
  enabledModules: ModuleId[];
}

export function ModuleBar({ enabledModules }: ModuleBarProps) {
  const { canAccessModule } = useAuth();
  const { getRolloutBadge } = useModuleRollout();
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

            const rolloutBadge = getRolloutBadge(moduleId);
            return (
              <Link key={moduleId} href={info.href}>
                <button className="w-full flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors active:scale-95 relative">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.gold }}
                  >
                    <Icon className="w-5 h-5" style={{ color: colors.brown }} />
                  </div>
                  <span className="text-xs text-center font-medium" style={{ color: colors.brown }}>
                    {info.shortName}
                  </span>
                  {rolloutBadge && (
                    <span
                      className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: rolloutBadge === 'Beta' ? '#3b82f6' : '#6b7280',
                        color: 'white',
                      }}
                    >
                      {rolloutBadge}
                    </span>
                  )}
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
