import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Flag, ChevronDown } from 'lucide-react';
import { colors } from '@/lib/colors';
import { type CashEntry, type FormData, formatCurrency, formatDateDisplay } from './deposit-utils';

interface DepositFormProps {
  formData: FormData;
  editingEntry: CashEntry | null;
  saving: boolean;
  showAdjustments: boolean;
  ownerTipsEnabled: boolean;
  ownerTipsLoaded: boolean;
  drawerDefault: number;
  calculatedDeposit: number;
  diff: number;
  netCash: number;
  onUpdateField: (field: string, value: string | boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResetForm: () => void;
  onToggleAdjustments: () => void;
  onToggleOwnerTips: () => void;
}

export function DepositForm({
  formData,
  editingEntry,
  saving,
  showAdjustments,
  ownerTipsEnabled,
  ownerTipsLoaded,
  drawerDefault,
  calculatedDeposit,
  diff,
  netCash,
  onUpdateField,
  onSubmit,
  onResetForm,
  onToggleAdjustments,
  onToggleOwnerTips,
}: DepositFormProps) {
  return (
    <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg" style={{ color: colors.brown }}>
          {editingEntry ? 'Edit Entry' : 'Daily Entry'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Date</Label>
              <div
                className="px-3 py-2 rounded-md text-sm cursor-pointer relative min-h-9 flex items-center border"
                style={{ backgroundColor: colors.inputBg, borderColor: 'hsl(var(--input))' }}
              >
                {formData.drawer_date ? formatDateDisplay(formData.drawer_date) : 'Select date'}
                <input
                  type="date"
                  value={formData.drawer_date}
                  onChange={(e) => onUpdateField('drawer_date', e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  data-testid="input-entry-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Gross Revenue</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={formData.gross_revenue}
                  onChange={(e) => onUpdateField('gross_revenue', e.target.value)}
                  className="pl-7"
                  style={{ backgroundColor: colors.inputBg }}
                  placeholder="0.00"
                  data-testid="input-gross-revenue"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Starting Drawer</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={formData.starting_drawer}
                  onChange={(e) => onUpdateField('starting_drawer', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="pl-7"
                  style={{ backgroundColor: colors.inputBg }}
                  placeholder={drawerDefault.toFixed(2)}
                  data-testid="input-starting-drawer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Cash Sales</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={formData.cash_sales}
                  onChange={(e) => onUpdateField('cash_sales', e.target.value)}
                  className="pl-7"
                  style={{ backgroundColor: colors.inputBg }}
                  placeholder="0.00"
                  data-testid="input-cash-sales"
                />
              </div>
            </div>
          </div>

          {/* Adjustments -- collapsible for progressive disclosure */}
          <div>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium py-1 transition-colors hover:opacity-80"
              style={{ color: colors.brownLight }}
              onClick={onToggleAdjustments}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showAdjustments ? 'rotate-0' : '-rotate-90'}`}
              />
              Adjustments
              {!showAdjustments && (parseFloat(String(formData.tip_pool)) || parseFloat(String(formData.cash_refund)) || parseFloat(String(formData.pay_in)) || parseFloat(String(formData.pay_out)) || parseFloat(String(formData.owner_tips))) ? (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.cream, color: colors.brown }}>has values</span>
              ) : null}
            </button>
            {showAdjustments && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div className="space-y-2">
                  <Label style={{ color: colors.brown }}>Tip Pool</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.tip_pool}
                      onChange={(e) => onUpdateField('tip_pool', e.target.value)}
                      className="pl-7"
                      style={{ backgroundColor: colors.inputBg }}
                      placeholder="0.00"
                      data-testid="input-tip-pool"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label style={{ color: colors.brown }}>Cash Refund</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.cash_refund}
                      onChange={(e) => onUpdateField('cash_refund', e.target.value)}
                      className="pl-7"
                      style={{ backgroundColor: colors.inputBg }}
                      placeholder="0.00"
                      data-testid="input-cash-refund"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label style={{ color: colors.brown }}>Pay In</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.pay_in}
                      onChange={(e) => onUpdateField('pay_in', e.target.value)}
                      className="pl-7"
                      style={{ backgroundColor: colors.inputBg }}
                      placeholder="0.00"
                      data-testid="input-pay-in"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label style={{ color: colors.brown }}>Pay Out</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.pay_out}
                      onChange={(e) => onUpdateField('pay_out', e.target.value)}
                      className="pl-7"
                      style={{ backgroundColor: colors.inputBg }}
                      placeholder="0.00"
                      data-testid="input-pay-out"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label style={{ color: ownerTipsEnabled ? colors.brown : colors.brownLight }}>Owner Tips</Label>
                    <button
                      type="button"
                      onClick={onToggleOwnerTips}
                      disabled={!ownerTipsLoaded}
                      className="text-xs px-2 py-1 rounded disabled:opacity-50"
                      style={{
                        backgroundColor: ownerTipsEnabled ? colors.gold : colors.creamDark,
                        color: ownerTipsEnabled ? colors.white : colors.brownLight,
                      }}
                      data-testid="button-toggle-owner-tips"
                    >
                      {ownerTipsEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.owner_tips}
                      onChange={(e) => onUpdateField('owner_tips', e.target.value)}
                      className="pl-7"
                      style={{ backgroundColor: ownerTipsEnabled && ownerTipsLoaded ? colors.inputBg : colors.creamDark }}
                      placeholder="0.00"
                      disabled={!ownerTipsEnabled || !ownerTipsLoaded}
                      data-testid="input-owner-tips"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Actual Deposit</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={formData.actual_deposit}
                  onChange={(e) => onUpdateField('actual_deposit', e.target.value)}
                  className="pl-7"
                  style={{ backgroundColor: colors.inputBg }}
                  placeholder="0.00"
                  data-testid="input-actual-deposit"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Calculated Deposit</Label>
              <div
                className="h-9 px-3 py-1 rounded-md font-mono text-sm flex items-center border"
                style={{ backgroundColor: colors.inputBg, borderColor: 'hsl(var(--input))', color: colors.brown }}
              >
                {formatCurrency(calculatedDeposit)}
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Difference</Label>
              <div
                className="h-9 px-3 py-1 rounded-md font-mono text-sm font-bold flex items-center border"
                style={{
                  backgroundColor: colors.inputBg,
                  borderColor: 'hsl(var(--input))',
                  color: diff === 0 ? '#22c55e' : diff > 0 ? '#eab308' : '#dc2626',
                }}
              >
                {formatCurrency(diff)}
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.brown }}>Net Cash</Label>
              <div
                className="h-9 px-3 py-1 rounded-md font-mono text-sm font-bold flex items-center"
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                {formatCurrency(netCash)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label style={{ color: colors.brown }}>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => onUpdateField('notes', e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              style={{ backgroundColor: colors.inputBg }}
              data-testid="input-notes"
            />
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <Button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: colors.brown, color: colors.white }}
              data-testid="button-save-entry"
            >
              {saving ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Entry'}
            </Button>
            <Button
              type="button"
              variant={formData.flagged ? 'destructive' : 'outline'}
              onClick={() => onUpdateField('flagged', !formData.flagged)}
              style={formData.flagged ? {} : { borderColor: colors.brown, color: colors.brown }}
              data-testid="button-toggle-flag"
            >
              <Flag className="h-4 w-4 mr-2" />
              Flag for Follow-up
            </Button>
            {editingEntry && (
              <Button type="button" variant="ghost" onClick={onResetForm} data-testid="button-cancel-edit">
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
