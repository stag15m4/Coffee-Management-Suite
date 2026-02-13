import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle } from 'lucide-react';
import { Colors } from './types';

interface TeamHoursVerifyProps {
  colors: Colors;
  teamHoursCheck: string;
  teamMinutesCheck: string;
  onTeamHoursChange: (value: string) => void;
  onTeamMinutesChange: (value: string) => void;
  onVerify: () => void;
  hoursVerifyResult: { match: boolean; message: string } | null;
}

export function TeamHoursVerify({
  colors,
  teamHoursCheck,
  teamMinutesCheck,
  onTeamHoursChange,
  onTeamMinutesChange,
  onVerify,
  hoursVerifyResult,
}: TeamHoursVerifyProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3" style={{ color: colors.brown }}>
        <CheckCircle className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Verify Total Team Hours</h3>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onVerify(); }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="team-hours" className="text-sm" style={{ color: colors.brownLight }}>Total Hours</Label>
            <Input
              id="team-hours"
              type="number"
              min="0"
              placeholder="0"
              inputMode="numeric"
              value={teamHoursCheck}
              onChange={(e) => onTeamHoursChange(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              data-testid="input-team-hours"
            />
          </div>
          <div>
            <Label htmlFor="team-minutes" className="text-sm" style={{ color: colors.brownLight }}>Total Minutes</Label>
            <Input
              id="team-minutes"
              type="number"
              min="0"
              max="59"
              placeholder="0"
              inputMode="numeric"
              value={teamMinutesCheck}
              onChange={(e) => onTeamMinutesChange(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              data-testid="input-team-minutes"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            style={{ backgroundColor: colors.gold, color: colors.white }}
            data-testid="button-verify-hours"
          >
            Verify
          </Button>
        </div>

        {hoursVerifyResult && (
          <div
            className="text-center font-semibold p-2 rounded"
            role="status"
            aria-live="polite"
            style={{
              color: hoursVerifyResult.match ? colors.green : colors.red,
              backgroundColor: hoursVerifyResult.match ? '#dcfce7' : '#fef2f2',
            }}
            data-testid="text-hours-verify-result"
          >
            {hoursVerifyResult.message}
          </div>
        )}
      </form>
    </section>
  );
}
