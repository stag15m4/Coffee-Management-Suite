import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { colors } from '@/lib/colors';
import type { PayPeriod } from '@/lib/pay-periods';

interface PayPeriodNavProps {
  period: PayPeriod;
  onPrev: () => void;
  onNext: () => void;
}

export function PayPeriodNav({ period, onPrev, onNext }: PayPeriodNavProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onPrev}
        className="h-8 w-8 p-0" style={{ color: colors.brown }}>
        <ChevronLeft className="w-5 h-5" />
      </Button>
      <span className="text-sm font-semibold min-w-[130px] text-center" style={{ color: colors.brown }}>
        {period.label}
      </span>
      <Button variant="ghost" size="sm" onClick={onNext}
        className="h-8 w-8 p-0" style={{ color: colors.brown }}>
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
}
