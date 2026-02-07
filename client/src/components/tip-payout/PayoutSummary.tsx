import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { Colors, PayoutCalculation } from './types';
import { formatCurrency, formatHoursMinutes } from './utils';

interface PayoutSummaryProps {
  colors: Colors;
  calculation: PayoutCalculation;
  hasData: boolean;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export function PayoutSummary({ colors, calculation, hasData, onExportCSV, onExportPDF }: PayoutSummaryProps) {
  const { totalPool, totalTeamHours, hourlyRate, weekRange } = calculation;

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
    </section>
  );
}
