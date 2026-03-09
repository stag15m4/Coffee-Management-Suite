import { useState, useCallback } from 'react';
import { useSearch, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import { Landmark, Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ChartOfAccountsTab from './ChartOfAccountsTab';
import BudgetEntryTab from './BudgetEntryTab';
import ActualsTab from './ActualsTab';

const TABS: Array<{ id: string; label: string; disabled?: boolean }> = [
  { id: 'chart-of-accounts', label: 'Chart of Accounts' },
  { id: 'budget-entry', label: 'Budget Entry' },
  { id: 'actuals', label: 'Actuals' },
  { id: 'forecast', label: 'Forecast', disabled: true },
  { id: 'dashboard', label: 'Dashboard', disabled: true },
];

export default function FinancialBudgetPage() {
  const { tenant, accessibleLocations, profile } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const activeTab = new URLSearchParams(search).get('tab') || 'chart-of-accounts';
  const setActiveTab = useCallback(
    (tab: string) => setLocation(`/financial-budget?tab=${tab}`),
    [setLocation]
  );

  // Location selector — default to current tenant
  const [selectedLocationId, setSelectedLocationId] = useState<string>(tenant?.id || '');
  const isParent = accessibleLocations && accessibleLocations.length > 1;

  // For CoA, always use the parent tenant (shared across locations)
  const coaTenantId = tenant?.parent_tenant_id || tenant?.id || '';
  // For budget lines, use the selected location
  const budgetTenantId = selectedLocationId || tenant?.id || '';

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.gold }}
            >
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: colors.brown }}>
                Financial Budget
              </h1>
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Budget planning & forecasting
              </p>
            </div>
          </div>

          {/* Location selector */}
          {isParent && (
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-[220px]" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {accessibleLocations!.map((loc: any) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: activeTab === tab.id ? colors.gold : 'transparent',
                color: activeTab === tab.id ? '#fff' : tab.disabled ? colors.creamDark : colors.brown,
                opacity: tab.disabled ? 0.5 : 1,
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {tab.label}
              {tab.disabled && <Lock className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-4 sm:px-6">
        {activeTab === 'chart-of-accounts' && (
          <ChartOfAccountsTab tenantId={coaTenantId} />
        )}
        {activeTab === 'budget-entry' && (
          <BudgetEntryTab tenantId={budgetTenantId} coaTenantId={coaTenantId} />
        )}
        {activeTab === 'actuals' && (
          <ActualsTab tenantId={budgetTenantId} coaTenantId={coaTenantId} />
        )}
        {(activeTab === 'forecast' || activeTab === 'dashboard') && (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
          >
            <Lock className="w-10 h-10 mx-auto mb-3" style={{ color: colors.creamDark }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>
              Coming in Phase 2
            </h3>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {activeTab === 'forecast' && 'Rolling 12-month forecast with actuals for closed months.'}
              {activeTab === 'dashboard' && 'Company-wide dashboard with charts, variance analysis, and roll-up views.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
