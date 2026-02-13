import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Flag, Receipt } from 'lucide-react';
import { colors } from '@/lib/colors';
import { type CashEntry, formatCurrency, formatDate, formatWeekRange, groupEntriesByWeek } from './deposit-utils';

interface DepositHistoryProps {
  entries: CashEntry[];
  onEdit: (entry: CashEntry) => void;
  onDelete: (entry: CashEntry) => void;
  onToggleFlag: (entry: CashEntry) => void;
  onToggleExcluded: (entry: CashEntry) => void;
}

export function DepositHistory({
  entries,
  onEdit,
  onDelete,
  onToggleFlag,
  onToggleExcluded,
}: DepositHistoryProps) {
  const entriesByWeek = groupEntriesByWeek(entries);
  const sortedWeeks = Object.keys(entriesByWeek).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: colors.brown }}>Transaction History</h2>
      {entries.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <Receipt className="w-10 h-10 mx-auto" style={{ color: colors.brownLight }} />
          <h3 className="text-lg font-semibold" style={{ color: colors.brown }}>No deposits yet</h3>
          <p className="text-sm max-w-sm mx-auto" style={{ color: colors.brownLight }}>
            Use the form above to log your first cash deposit and start tracking daily revenue.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedWeeks.map(weekStart => {
            const weekEntries = entriesByWeek[weekStart].sort((a, b) => b.drawer_date.localeCompare(a.drawer_date));
            const weekGross = weekEntries.reduce((sum, e) => sum + (e.gross_revenue || 0), 0);
            const weekDeposits = weekEntries.reduce((sum, e) => sum + (e.actual_deposit || 0), 0);

            return (
              <div key={weekStart} className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
                <div className="px-4 py-3 font-semibold text-sm" style={{ backgroundColor: colors.brown, color: colors.cream }}>
                  Week: {formatWeekRange(weekStart)} | Gross: {formatCurrency(weekGross)} | Deposits: {formatCurrency(weekDeposits)}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: colors.brown }}>
                        <th className="px-4 py-3 text-left font-semibold text-white">Date</th>
                        <th className="px-4 py-3 text-right font-semibold text-white">Gross Rev</th>
                        <th className="px-4 py-3 text-right font-semibold text-white">Cash Sales</th>
                        <th className="px-4 py-3 text-right font-semibold text-white">Tip Pool</th>
                        <th className="px-4 py-3 text-right font-semibold text-white">Actual Dep</th>
                        <th className="px-4 py-3 text-right font-semibold text-white">Calc Dep</th>
                        <th className="px-4 py-3 text-right font-semibold text-white">Diff</th>
                        <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.gold }}>Net Cash</th>
                        <th className="px-4 py-3 text-center font-semibold text-white">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekEntries.map((entry, idx) => {
                        const entryDiff = (entry.actual_deposit || 0) - (entry.calculated_deposit || 0);
                        const entryNetCash = (entry.actual_deposit || 0) - (entry.pay_in || 0);

                        return (
                          <tr
                            key={entry.id}
                            style={{
                              backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                              borderBottom: `1px solid ${colors.creamDark}`,
                            }}
                            data-testid={`row-entry-${entry.id}`}
                            {...(idx === 0 ? { 'data-spotlight': 'outlier-toggle' } : {})}
                          >
                            <td className="px-4 py-3 font-medium" style={{ color: colors.brown }}>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onToggleFlag(entry)}
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: entry.flagged ? '#ef4444' : colors.creamDark }}
                                  title={entry.flagged ? 'Flagged for follow-up' : 'Flag for follow-up'}
                                  data-testid={`button-flag-${entry.id}`}
                                />
                                <span style={{ opacity: entry.excluded_from_average ? 0.5 : 1 }}>
                                  {formatDate(entry.drawer_date)}
                                </span>
                                <button
                                  onClick={() => onToggleExcluded(entry)}
                                  className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                                  style={{
                                    backgroundColor: entry.excluded_from_average ? '#fef3c7' : 'transparent',
                                    color: entry.excluded_from_average ? '#92400e' : colors.brownLight,
                                    border: entry.excluded_from_average ? '1px solid #fcd34d' : `1px solid transparent`,
                                  }}
                                  title={entry.excluded_from_average ? 'Included in averages (click to exclude)' : 'Exclude from averages (festival/event day)'}
                                  data-testid={`button-exclude-${entry.id}`}
                                >
                                  {entry.excluded_from_average ? 'outlier' : ''}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right" style={{ color: colors.brown, opacity: entry.excluded_from_average ? 0.5 : 1 }}>{formatCurrency(entry.gross_revenue)}</td>
                            <td className="px-4 py-3 text-right" style={{ color: colors.brown }}>{formatCurrency(entry.cash_sales)}</td>
                            <td className="px-4 py-3 text-right" style={{ color: colors.brown }}>{formatCurrency(entry.tip_pool)}</td>
                            <td className="px-4 py-3 text-right" style={{ color: colors.brown }}>{formatCurrency(entry.actual_deposit)}</td>
                            <td className="px-4 py-3 text-right" style={{ color: colors.brownLight }}>{formatCurrency(entry.calculated_deposit)}</td>
                            <td className="px-4 py-3 text-right font-medium" style={{
                              color: Math.abs(entryDiff) < 0.01 ? colors.green :
                                entryDiff > 0 ? '#eab308' : '#ef4444'
                            }}>
                              {formatCurrency(entryDiff)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold" style={{ color: colors.gold }}>
                              {formatCurrency(entryNetCash)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => onEdit(entry)}
                                  data-testid={`button-edit-${entry.id}`}
                                >
                                  <Pencil className="h-4 w-4" style={{ color: colors.brownLight }} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => onToggleExcluded(entry)}
                                  title={entry.excluded_from_average ? 'Include in averages' : 'Exclude from averages (outlier day)'}
                                  data-testid={`button-exclude-action-${entry.id}`}
                                >
                                  <Flag className="h-4 w-4" style={{ color: entry.excluded_from_average ? '#f59e0b' : colors.creamDark }} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => onDelete(entry)}
                                  data-testid={`button-delete-${entry.id}`}
                                >
                                  <Trash2 className="h-4 w-4" style={{ color: colors.brownLight }} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
