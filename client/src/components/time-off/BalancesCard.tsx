import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet } from 'lucide-react';
import { useMyTimeOffBalances, useTimeOffBalances, type TimeOffBalance } from '@/hooks/use-time-off-policies';
import { colors } from '@/lib/colors';

function BalanceBar({ balance }: { balance: TimeOffBalance }) {
  const available = Math.max(0, balance.balance_hours - balance.used_hours - balance.pending_hours);
  const total = balance.balance_hours || 1; // avoid div by zero
  const usedPct = Math.min(100, (balance.used_hours / total) * 100);
  const pendingPct = Math.min(100 - usedPct, (balance.pending_hours / total) * 100);
  const availablePct = 100 - usedPct - pendingPct;

  return (
    <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium" style={{ color: colors.brown }}>
          {balance.policy_name || 'PTO'}
        </span>
        <span className="text-sm font-semibold" style={{ color: colors.gold }}>
          {available.toFixed(1)}h available
        </span>
      </div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {(balance.policy_categories || []).map((c) => (
          <Badge
            key={c}
            variant="outline"
            className="text-[10px] px-1.5 py-0"
            style={{ borderColor: colors.creamDark, color: colors.brownLight }}
          >
            {c}
          </Badge>
        ))}
      </div>
      {/* Progress bar */}
      <div className="h-2.5 rounded-full overflow-hidden flex" style={{ backgroundColor: colors.creamDark }}>
        {usedPct > 0 && <div className="h-full" style={{ width: `${usedPct}%`, backgroundColor: colors.blue }} />}
        {pendingPct > 0 && (
          <div className="h-full" style={{ width: `${pendingPct}%`, backgroundColor: colors.yellow }} />
        )}
        {availablePct > 0 && (
          <div className="h-full" style={{ width: `${availablePct}%`, backgroundColor: colors.green }} />
        )}
      </div>
      <div className="flex justify-between mt-1 text-[11px]" style={{ color: colors.brownLight }}>
        <span>Used: {balance.used_hours.toFixed(1)}h</span>
        {balance.pending_hours > 0 && <span>Pending: {balance.pending_hours.toFixed(1)}h</span>}
        <span>Balance: {balance.balance_hours.toFixed(1)}h</span>
      </div>
    </div>
  );
}

/** Shows the current employee's own PTO balances. */
export function MyBalancesCard() {
  const { data: balances, isLoading } = useMyTimeOffBalances();

  if (isLoading || !balances || balances.length === 0) return null;

  return (
    <Card style={{ backgroundColor: colors.white }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
          <Wallet className="w-5 h-5" style={{ color: colors.gold }} />
          My PTO Balances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {balances.map((b) => (
          <BalanceBar key={b.id} balance={b} />
        ))}
      </CardContent>
    </Card>
  );
}

/** Shows all employees' balances — manager view. */
export function TeamBalancesCard({ employees }: { employees: { user_profile_id?: string | null; name: string }[] }) {
  const { data: allBalances, isLoading } = useTimeOffBalances();

  // Group balances by employee
  const byEmployee = useMemo(() => {
    if (!allBalances) return [];
    const map = new Map<string, { name: string; balances: TimeOffBalance[] }>();
    for (const b of allBalances) {
      if (!map.has(b.employee_id)) {
        const emp = employees.find((e) => e.user_profile_id === b.employee_id);
        map.set(b.employee_id, { name: emp?.name || 'Unknown', balances: [] });
      }
      map.get(b.employee_id)!.balances.push(b);
    }
    return Array.from(map.entries())
      .map(([empId, data]) => ({ employeeId: empId, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBalances, employees]);

  if (isLoading || byEmployee.length === 0) return null;

  return (
    <Card style={{ backgroundColor: colors.white }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
          <Wallet className="w-5 h-5" style={{ color: colors.gold }} />
          Team PTO Balances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {byEmployee.map(({ employeeId, name, balances }) => (
          <div key={employeeId}>
            <p className="text-sm font-medium mb-2" style={{ color: colors.brown }}>
              {name}
            </p>
            <div className="space-y-2 pl-2">
              {balances.map((b) => (
                <BalanceBar key={b.id} balance={b} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
