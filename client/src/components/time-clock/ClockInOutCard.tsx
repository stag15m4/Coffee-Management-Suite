import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useToast } from '@/hooks/use-toast';
import {
  useActiveClockEntry,
  useClockIn,
  useClockOut,
  useStartBreak,
  useEndBreak,
} from '@/hooks/use-time-clock';
import { Play, Square, Coffee } from 'lucide-react';
import { colors } from '@/lib/colors';

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ClockInOutCard() {
  const { data: activeEntry, isLoading } = useActiveClockEntry();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const { toast } = useToast();

  const activeBreak = useMemo(() => {
    if (!activeEntry?.breaks) return null;
    return activeEntry.breaks.find((b) => !b.break_end) ?? null;
  }, [activeEntry]);

  const handleClockIn = useCallback(async () => {
    try {
      await clockIn.mutateAsync(undefined);
      toast({ title: 'Clocked in', description: `Started at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to clock in.', variant: 'destructive' });
    }
  }, [clockIn, toast]);

  const handleClockOut = useCallback(async () => {
    if (!activeEntry) return;
    try {
      await clockOut.mutateAsync({ id: activeEntry.id });
      toast({ title: 'Clocked out' });
    } catch {
      toast({ title: 'Error', description: 'Failed to clock out.', variant: 'destructive' });
    }
  }, [activeEntry, clockOut, toast]);

  const handleBreakToggle = useCallback(async () => {
    if (!activeEntry) return;
    try {
      if (activeBreak) {
        await endBreak.mutateAsync(activeBreak.id);
        toast({ title: 'Break ended' });
      } else {
        await startBreak.mutateAsync({ entryId: activeEntry.id });
        toast({ title: 'Break started' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle break.', variant: 'destructive' });
    }
  }, [activeEntry, activeBreak, startBreak, endBreak, toast]);

  return (
    <Card style={{ backgroundColor: colors.white }}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          {isLoading ? (
            <CoffeeLoader text="Loading..." />
          ) : activeEntry ? (
            <>
              <div className="text-center">
                <p className="text-sm" style={{ color: colors.brownLight }}>Clocked in since</p>
                <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                  {formatTimestamp(activeEntry.clock_in)}
                </p>
                {activeBreak && (
                  <Badge style={{ backgroundColor: colors.yellow, color: colors.brown }} className="mt-1">
                    On Break
                  </Badge>
                )}
              </div>
              <div className="flex gap-3">
                <Button onClick={handleBreakToggle} variant="outline"
                  disabled={startBreak.isPending || endBreak.isPending}
                  style={{ borderColor: colors.yellow, color: colors.brown }}>
                  <Coffee className="w-4 h-4 mr-1" />
                  {activeBreak ? 'End Break' : 'Start Break'}
                </Button>
                <Button onClick={handleClockOut} disabled={clockOut.isPending}
                  style={{ backgroundColor: colors.red, color: '#fff' }}>
                  <Square className="w-4 h-4 mr-1" /> Clock Out
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm" style={{ color: colors.brownLight }}>Not clocked in</p>
              </div>
              <Button onClick={handleClockIn} disabled={clockIn.isPending} size="lg"
                style={{ backgroundColor: colors.green, color: '#fff' }}>
                <Play className="w-5 h-5 mr-2" /> Clock In
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
