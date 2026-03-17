import { useState, useCallback } from 'react';
import { useSearch, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import { Landmark, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChartOfAccountsTab from './ChartOfAccountsTab';
import UnifiedBudgetTab from './UnifiedBudgetTab';
import ForecastTab from './ForecastTab';

const TABS: Array<{ id: string; label: string }> = [
  { id: 'budget', label: 'Budget' },
  { id: 'forecast', label: 'Forecast' },
];

export default function FinancialBudgetPage() {
  const { tenant, accessibleLocations, profile } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const activeTab = new URLSearchParams(search).get('tab') || 'budget';
  const setActiveTab = useCallback((tab: string) => setLocation(`/financial-budget?tab=${tab}`), [setLocation]);

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

          <div className="flex items-center gap-2">
            {/* Location selector */}
            {isParent && (
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger
                  className="w-[220px]"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                >
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

            {/* Chart of Accounts (settings) */}
            <button
              onClick={() => setActiveTab('chart-of-accounts')}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{
                backgroundColor: activeTab === 'chart-of-accounts' ? colors.gold : colors.inputBg,
                color: activeTab === 'chart-of-accounts' ? '#fff' : colors.brownLight,
                border: `1px solid ${colors.gold}`,
                cursor: 'pointer',
              }}
              title="Chart of Accounts"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: activeTab === tab.id ? colors.gold : 'transparent',
                color: activeTab === tab.id ? '#fff' : colors.brown,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-4 sm:px-6">
        {activeTab === 'chart-of-accounts' && <ChartOfAccountsTab tenantId={coaTenantId} />}
        {activeTab === 'budget' && <UnifiedBudgetTab tenantId={budgetTenantId} coaTenantId={coaTenantId} />}
        {activeTab === 'forecast' && <ForecastTab tenantId={budgetTenantId} coaTenantId={coaTenantId} />}
      </div>
    </div>
  );
}
