import { Button } from '@/components/ui/button';
import { Download, FileText, ShieldCheck, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Colors, PayoutCalculation, ServerCalculationResult, PayoutApprovalResult } from './types';
import { formatCurrency, formatHoursMinutes } from './utils';

interface PayoutSummaryProps {
  colors: Colors;
  calculation: PayoutCalculation;
  hasData: boolean;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onServerValidate: () => void;
  onApprove: () => void;
  validating: boolean;
  approving: boolean;
  serverResult: ServerCalculationResult | null;
  approvalResult: PayoutApprovalResult | null;
  validationError: string | null;
  userRole: string | null;
}

export function PayoutSummary({
  colors,
  calculation,
  hasData,
  onExportCSV,
  onExportPDF,
  onServerValidate,
  onApprove,
  validating,
  approving,
  serverResult,
  approvalResult,
  validationError,
  userRole,
}: PayoutSummaryProps) {
  const { totalPool, totalTeamHours, hourlyRate, weekRange } = calculation;

  // Check if server result matches client calculation
  const hasDiscrepancy =
    serverResult &&
    (Math.abs(serverResult.totalPool - totalPool) > 0.02 || Math.abs(serverResult.totalHours - totalTeamHours) > 0.02);

  const canApprove = userRole === 'manager' || userRole === 'owner';

  return (
    <section>
      <div
        className="p-3 rounded-md flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
        style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, borderWidth: 1 }}
      >
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <p className="text-sm" style={{ color: colors.brown }}>
            <strong>Total Tips:</strong> {formatCurrency(totalPool)}
          </p>
          <p className="text-sm" style={{ color: colors.brown }}>
            <strong>Total Hours:</strong> {formatHoursMinutes(totalTeamHours)}
          </p>
          <p className="text-sm font-semibold" style={{ color: colors.gold }}>
            {formatCurrency(hourlyRate)}/hr
          </p>
        </div>
        {hasData && (
          <div className="flex gap-2">
            <Button
              onClick={onExportCSV}
              variant="outline"
              size="sm"
              style={{ borderColor: colors.gold, color: colors.brown }}
              className="gap-1.5"
              data-testid="button-export-csv"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </Button>
            <Button
              onClick={onExportPDF}
              variant="outline"
              size="sm"
              style={{ borderColor: colors.gold, color: colors.brown }}
              className="gap-1.5"
              data-testid="button-export-pdf"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Button>
          </div>
        )}
      </div>

      {/* Server Validation Section */}
      {hasData && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={onServerValidate}
              disabled={validating || totalPool <= 0}
              variant="outline"
              size="sm"
              style={{ borderColor: colors.gold, color: colors.brown }}
              className="gap-1.5"
              data-testid="button-server-validate"
            >
              {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              {validating ? 'Validating...' : 'Validate with Server'}
            </Button>

            {serverResult && !hasDiscrepancy && !approvalResult && canApprove && (
              <Button
                onClick={onApprove}
                disabled={approving}
                size="sm"
                style={{ backgroundColor: colors.green, color: colors.white }}
                className="gap-1.5"
                data-testid="button-approve-payout"
              >
                {approving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {approving ? 'Approving...' : 'Approve Payout'}
              </Button>
            )}

            {serverResult && !hasDiscrepancy && !approvalResult && !canApprove && (
              <span className="text-xs" style={{ color: colors.brownLight }}>
                A manager or owner must approve the payout.
              </span>
            )}
          </div>

          {/* Validation Error */}
          {validationError && (
            <div
              className="flex items-start gap-2 p-2 rounded text-sm"
              style={{ backgroundColor: '#fef2f2', color: colors.red }}
              data-testid="text-validation-error"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Server Validated — matches */}
          {serverResult && !hasDiscrepancy && !approvalResult && (
            <div
              className="flex items-center gap-2 p-2 rounded text-sm"
              style={{ backgroundColor: '#dcfce7', color: colors.green }}
              data-testid="text-validation-success"
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>
                Server validated: {formatCurrency(serverResult.totalPool)} pool, {serverResult.employees.length}{' '}
                employees, {formatCurrency(serverResult.hourlyRate)}/hr. Calculated at{' '}
                {new Date(serverResult.calculatedAt).toLocaleTimeString()}.
              </span>
            </div>
          )}

          {/* Server Validated — discrepancy */}
          {hasDiscrepancy && (
            <div
              className="flex items-start gap-2 p-2 rounded text-sm"
              style={{ backgroundColor: '#fef2f2', color: colors.red }}
              data-testid="text-validation-discrepancy"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Discrepancy detected.</strong> Server calculated {formatCurrency(serverResult!.totalPool)} pool
                / {formatHoursMinutes(serverResult!.totalHours)} hours, but client shows {formatCurrency(totalPool)} /{' '}
                {formatHoursMinutes(totalTeamHours)}. Save your changes and re-validate.
              </div>
            </div>
          )}

          {/* Approved */}
          {approvalResult && (
            <div
              className="flex items-center gap-2 p-2 rounded text-sm font-medium"
              style={{ backgroundColor: '#dcfce7', color: colors.green, borderWidth: 1, borderColor: colors.green }}
              data-testid="text-approval-success"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                Payout approved at {new Date(approvalResult.approvedAt).toLocaleString()}.{' '}
                {formatCurrency(approvalResult.totalPool)} distributed to {approvalResult.employeeCount} employees.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
