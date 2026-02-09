import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banknote, CreditCard, DollarSign } from 'lucide-react';
import { Colors } from './types';
import { DAYS, formatCurrency, getMonday } from './utils';

interface DailyTipsEntryProps {
  colors: Colors;
  weekKey: string;
  onWeekKeyChange: (weekKey: string) => void;
  weekRange: { start: string; end: string };
  cashEntries: number[];
  ccEntries: number[];
  onCashEntryChange: (index: number, value: number) => void;
  onCcEntryChange: (index: number, value: number) => void;
  cashTotal: number;
  ccTotal: number;
  ccAfterFee: number;
  onSaveTips: () => void;
  savingTips: boolean;
}

export function DailyTipsEntry({
  colors,
  weekKey,
  onWeekKeyChange,
  weekRange,
  cashEntries,
  ccEntries,
  onCashEntryChange,
  onCcEntryChange,
  cashTotal,
  ccTotal,
  ccAfterFee,
  onSaveTips,
  savingTips,
}: DailyTipsEntryProps) {
  // Tab order: Mon Cash → Mon CC → Tue Cash → Tue CC → ... → Sun CC
  const handleTipTabNav = useCallback((e: React.KeyboardEvent<HTMLInputElement>, row: 'cash' | 'cc', dayIndex: number) => {
    if (e.key !== 'Tab') return;
    const forward = !e.shiftKey;
    let nextRow: 'cash' | 'cc';
    let nextDay: number;

    if (forward) {
      if (row === 'cash') {
        nextRow = 'cc';
        nextDay = dayIndex;
      } else {
        nextRow = 'cash';
        nextDay = dayIndex + 1;
      }
      if (nextDay > 6) return; // let default tab move to Save button
    } else {
      if (row === 'cc') {
        nextRow = 'cash';
        nextDay = dayIndex;
      } else {
        nextRow = 'cc';
        nextDay = dayIndex - 1;
      }
      if (nextDay < 0) return; // let default tab move to date picker
    }

    e.preventDefault();
    const selector = `[data-testid="input-${nextRow}-${DAYS[nextDay].toLowerCase()}"]`;
    const nextInput = document.querySelector<HTMLInputElement>(selector);
    nextInput?.focus();
    nextInput?.select();
  }, []);

  return (
    <section>
      <div className="flex items-center gap-2 mb-1" style={{ color: colors.brown }}>
        <DollarSign className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Daily Tips Entry</h3>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <p className="font-semibold text-sm" style={{ color: colors.brown }}>
          Week: Monday {weekRange.start} – Sunday {weekRange.end}
        </p>
        <Input
          type="date"
          value={weekKey}
          onChange={(e) => onWeekKeyChange(getMonday(new Date(e.target.value + 'T12:00:00')))}
          className="w-40"
          style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
          aria-label="Select week starting date"
          data-testid="input-week-picker"
        />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onSaveTips(); }}
        aria-busy={savingTips}
      >
        <div className="space-y-2">
          {/* Day-of-week headers */}
          <div className="flex items-end gap-2">
            <div className="w-9 shrink-0" />
            <div className="grid grid-cols-7 gap-1 flex-1">
              {DAYS.map((day) => (
                <span key={day} className="text-xs text-center" style={{ color: colors.brownLight }}>{day}</span>
              ))}
            </div>
            <div className="w-24 shrink-0" />
          </div>

          {/* Cash row */}
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 shrink-0" style={{ color: colors.brown }} aria-label="Cash tips" />
            <div className="grid grid-cols-7 gap-1 flex-1">
              {DAYS.map((day, i) => (
                <Input
                  key={`cash-${i}`}
                  type="number"
                  step="0.01"
                  placeholder="0"
                  inputMode="decimal"
                  value={cashEntries[i] || ''}
                  onChange={(e) => onCashEntryChange(i, parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => handleTipTabNav(e, 'cash', i)}
                  className="text-center text-sm p-1"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  aria-label={`Cash tips for ${day}`}
                  data-testid={`input-cash-${day.toLowerCase()}`}
                />
              ))}
            </div>
            <p className="w-24 shrink-0 text-right text-sm font-medium" style={{ color: colors.brown }}>
              {formatCurrency(cashTotal)}
            </p>
          </div>

          {/* Credit card row */}
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 shrink-0" style={{ color: colors.brown }} aria-label="Credit card tips" />
            <div className="grid grid-cols-7 gap-1 flex-1">
              {DAYS.map((day, i) => (
                <Input
                  key={`cc-${i}`}
                  type="number"
                  step="0.01"
                  placeholder="0"
                  inputMode="decimal"
                  value={ccEntries[i] || ''}
                  onChange={(e) => onCcEntryChange(i, parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => handleTipTabNav(e, 'cc', i)}
                  className="text-center text-sm p-1"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  aria-label={`Credit card tips for ${day}`}
                  data-testid={`input-cc-${day.toLowerCase()}`}
                />
              ))}
            </div>
            <div className="w-24 shrink-0 text-right">
              <p className="text-sm font-medium" style={{ color: colors.brown }}>{formatCurrency(ccTotal)}</p>
              <p className="text-xs" style={{ color: colors.brownLight }}>-3.5%: {formatCurrency(ccAfterFee)}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <Button
            type="submit"
            disabled={savingTips}
            style={{ backgroundColor: colors.gold, color: colors.brown }}
            data-testid="button-save-tips"
          >
            Save Tips
          </Button>
        </div>
      </form>
    </section>
  );
}
