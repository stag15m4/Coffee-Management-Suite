import { Card, CardContent } from '@/components/ui/card';
import { colors } from '@/lib/colors';
import { formatCurrency } from './deposit-utils';

interface DepositSummaryProps {
  daysRecorded: number;
  totalGross: number;
  avgDailyRevenue: number;
  excludedCount: number;
  totalDeposits: number;
  totalVariance: number;
}

export function DepositSummary({
  daysRecorded,
  totalGross,
  avgDailyRevenue,
  excludedCount,
  totalDeposits,
  totalVariance,
}: DepositSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Days Recorded</div>
          <div className="text-2xl font-bold" data-testid="text-days-recorded">{daysRecorded}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Gross Revenue</div>
          <div className="text-2xl font-bold text-primary" data-testid="text-total-gross">{formatCurrency(totalGross)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Avg Daily Revenue</div>
          <div className="text-2xl font-bold" style={{ color: colors.gold }} data-testid="text-avg-daily">
            {formatCurrency(avgDailyRevenue)}
          </div>
          {excludedCount > 0 && (
            <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
              {excludedCount} outlier{excludedCount > 1 ? 's' : ''} excluded
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Deposits</div>
          <div className="text-2xl font-bold" data-testid="text-total-deposits">{formatCurrency(totalDeposits)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total Variance</div>
          <div className={`text-2xl font-bold ${Math.abs(totalVariance) < 1 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-total-variance">
            {formatCurrency(totalVariance)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
