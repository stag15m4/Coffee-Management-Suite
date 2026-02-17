import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useShifts, useAcceptShift, useDeclineShift, type Shift } from '@/hooks/use-shifts';
import { useMyTimeOffRequests, type TimeOffRequest } from '@/hooks/use-time-off';
import {
  useActiveClockEntry,
  useClockIn,
  useClockOut,
  useStartBreak,
  useEndBreak,
  useTimeClockEntries,
  type TimeClockEntry,
  type TimeClockBreak,
} from '@/hooks/use-time-clock';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Clock,
  Coffee,
  LogIn,
  LogOut,
  CalendarDays,
  Timer,
  Plane,
  Check,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function calcWeekHours(entries: TimeClockEntry[]): number {
  let total = 0;
  for (const e of entries) {
    const clockIn = new Date(e.clock_in).getTime();
    const clockOut = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    let breakMs = 0;
    if (e.breaks) {
      for (const b of e.breaks) {
        const bs = new Date(b.break_start).getTime();
        const be = b.break_end ? new Date(b.break_end).getTime() : Date.now();
        breakMs += be - bs;
      }
    }
    total += (clockOut - clockIn - breakMs);
  }
  return total / (1000 * 60 * 60);
}

function getNextShift(myShifts: Shift[]): Shift | null {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0, 5);

  for (const s of myShifts) {
    if (s.date > todayStr) return s;
    if (s.date === todayStr && s.end_time > nowTime) return s;
  }
  return null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function MyDashboardCard() {
  const { user, profile, tenant } = useAuth();
  const { toast } = useToast();

  // Week boundaries
  const { weekStart, weekEnd } = useMemo(() => {
    const now = new Date();
    const mon = getMonday(now);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return {
      weekStart: mon.toISOString().split('T')[0],
      weekEnd: sun.toISOString().split('T')[0],
    };
  }, []);

  // Data hooks
  const { data: allShifts } = useShifts(weekStart, weekEnd);
  const { data: activeEntry, isLoading: clockLoading } = useActiveClockEntry();
  const { data: clockEntries } = useTimeClockEntries(weekStart, weekEnd, user?.id);
  const { data: timeOffRequests } = useMyTimeOffRequests();

  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const acceptShift = useAcceptShift();
  const declineShift = useDeclineShift();

  // Inline decline state
  const [decliningShiftId, setDecliningShiftId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  // Filter shifts to current user
  const myShifts = useMemo(() => {
    if (!allShifts || !user?.id) return [];
    const myName = profile?.full_name?.toLowerCase();
    return allShifts.filter(
      (s) => s.employee_id === user.id || (myName && s.employee_name?.toLowerCase() === myName)
    );
  }, [allShifts, user?.id, profile?.full_name]);

  // Shifts needing a response
  const pendingShifts = useMemo(() => {
    return myShifts.filter(
      (s) => s.status === 'published' && s.employee_id === user?.id && !s.acceptance
    );
  }, [myShifts, user?.id]);

  const nextShift = useMemo(() => getNextShift(myShifts), [myShifts]);
  const weekHours = useMemo(() => (clockEntries ? calcWeekHours(clockEntries) : 0), [clockEntries]);

  // Active time-off (non-cancelled)
  const activeTimeOff = useMemo(() => {
    if (!timeOffRequests) return [];
    return timeOffRequests.filter((r) => r.status !== 'cancelled');
  }, [timeOffRequests]);

  // Break state
  const activeBreak = activeEntry?.breaks?.find((b: TimeClockBreak) => !b.break_end) ?? null;

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync(undefined);
      toast({ title: 'Clocked in' });
    } catch {
      toast({ title: 'Failed to clock in', variant: 'destructive' });
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    try {
      await clockOut.mutateAsync({ id: activeEntry.id });
      toast({ title: 'Clocked out' });
    } catch {
      toast({ title: 'Failed to clock out', variant: 'destructive' });
    }
  };

  const handleStartBreak = async () => {
    if (!activeEntry) return;
    try {
      await startBreak.mutateAsync({ entryId: activeEntry.id });
      toast({ title: 'Break started' });
    } catch {
      toast({ title: 'Failed to start break', variant: 'destructive' });
    }
  };

  const handleEndBreak = async () => {
    if (!activeBreak) return;
    try {
      await endBreak.mutateAsync(activeBreak.id);
      toast({ title: 'Break ended' });
    } catch {
      toast({ title: 'Failed to end break', variant: 'destructive' });
    }
  };

  if (!user || !profile) return null;

  return (
    <Card
      className="overflow-hidden mb-6"
      style={{ backgroundColor: colors.white }}
      data-spotlight="my-dashboard-card"
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${colors.creamDark}` }}
      >
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: colors.gold }}
          >
            {(profile.full_name || 'U').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate" style={{ color: colors.brown }}>
            {profile.full_name || 'My Dashboard'}
          </h3>
          <p className="text-xs" style={{ color: colors.brownLight }}>
            {profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Team Member'}
            {tenant?.name ? ` \u2022 ${tenant.name}` : ''}
          </p>
        </div>

        {/* Hours badge */}
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: colors.brown }}>
            <Timer className="w-4 h-4" />
            {weekHours.toFixed(1)}h
          </div>
          <p className="text-[10px]" style={{ color: colors.brownLight }}>this week</p>
        </div>
      </div>

      <div className="p-5 grid gap-5 sm:grid-cols-2">
        {/* Clock In/Out Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4" style={{ color: colors.gold }} />
            <span className="text-sm font-semibold" style={{ color: colors.brown }}>
              Time Clock
            </span>
          </div>

          {clockLoading ? (
            <p className="text-sm" style={{ color: colors.brownLight }}>Loading...</p>
          ) : activeEntry ? (
            <div className="space-y-2">
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {activeBreak
                  ? 'On break since ' + formatTimestamp(activeBreak.break_start)
                  : 'Clocked in since ' + formatTimestamp(activeEntry.clock_in)}
              </p>
              <div className="flex gap-2 flex-wrap">
                {activeBreak ? (
                  <Button
                    size="sm"
                    onClick={handleEndBreak}
                    disabled={endBreak.isPending}
                    style={{ backgroundColor: colors.gold }}
                  >
                    <Coffee className="w-3.5 h-3.5 mr-1.5" />
                    End Break
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStartBreak}
                    disabled={startBreak.isPending}
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                  >
                    <Coffee className="w-3.5 h-3.5 mr-1.5" />
                    Break
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClockOut}
                  disabled={clockOut.isPending || !!activeBreak}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Clock Out
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleClockIn}
              disabled={clockIn.isPending}
              style={{ backgroundColor: colors.gold }}
            >
              <LogIn className="w-3.5 h-3.5 mr-1.5" />
              Clock In
            </Button>
          )}
        </div>

        {/* Next Shift */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4" style={{ color: colors.gold }} />
            <span className="text-sm font-semibold" style={{ color: colors.brown }}>
              Next Shift
            </span>
          </div>
          {nextShift ? (
            <div className="text-sm" style={{ color: colors.brownLight }}>
              <span className="font-medium" style={{ color: colors.brown }}>
                {formatDate(nextShift.date)}
              </span>{' '}
              {formatTime(nextShift.start_time)} &ndash; {formatTime(nextShift.end_time)}
              {nextShift.position && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                  {nextShift.position}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              No upcoming shifts this week
            </p>
          )}
        </div>
      </div>

      {/* Pending shifts alert */}
      {pendingShifts.length > 0 && (
        <div className="px-5 py-2 flex items-center gap-2 text-sm"
          style={{ backgroundColor: '#fef3c7', color: '#92400e', borderBottom: `1px solid ${colors.creamDark}` }}>
          <CalendarDays className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">
            {pendingShifts.length} shift{pendingShifts.length !== 1 ? 's' : ''} awaiting your response
          </span>
        </div>
      )}

      {/* My Shifts This Week */}
      {myShifts.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4" style={{ color: colors.gold }} />
            <span className="text-sm font-semibold" style={{ color: colors.brown }}>
              This Week
            </span>
            <span className="text-xs" style={{ color: colors.brownLight }}>
              ({myShifts.length} shift{myShifts.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="space-y-1.5">
            {myShifts.map((s) => {
              const isPending = s.status === 'published' && s.employee_id === user?.id && !s.acceptance;
              const isDeclining = decliningShiftId === s.id;
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex items-center gap-3 text-sm py-1.5 px-2 rounded"
                    style={{ backgroundColor: colors.cream }}>
                    <span className="w-20 flex-shrink-0 font-medium" style={{ color: colors.brown }}>
                      {formatDate(s.date)}
                    </span>
                    <span style={{ color: colors.brownLight }}>
                      {formatTime(s.start_time)} &ndash; {formatTime(s.end_time)}
                    </span>
                    {s.position && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s.position}
                      </Badge>
                    )}
                    <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                      {s.acceptance === 'accepted' && (
                        <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">Accepted</Badge>
                      )}
                      {s.acceptance === 'declined' && (
                        <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0">Declined</Badge>
                      )}
                      {isPending && (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                            disabled={acceptShift.isPending}
                            title="Accept shift"
                            onClick={async () => {
                              try { await acceptShift.mutateAsync(s.id); toast({ title: 'Shift accepted' }); }
                              catch { toast({ title: 'Failed to accept', variant: 'destructive' }); }
                            }}>
                            <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                            title="Decline shift"
                            onClick={() => setDecliningShiftId(isDeclining ? null : s.id)}>
                            <X className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {isDeclining && (
                    <div className="flex gap-2 px-2">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        className="flex-1 text-xs px-2 py-1 rounded border"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      />
                      <Button size="sm" className="text-xs"
                        disabled={declineShift.isPending}
                        onClick={async () => {
                          try {
                            await declineShift.mutateAsync({ shiftId: s.id, reason: declineReason || undefined });
                            toast({ title: 'Shift declined' });
                            setDecliningShiftId(null); setDeclineReason('');
                          } catch { toast({ title: 'Failed to decline', variant: 'destructive' }); }
                        }}
                        style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time Off Requests */}
      {activeTimeOff.length > 0 && (
        <div
          className="px-5 py-4"
          style={{ borderTop: `1px solid ${colors.creamDark}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Plane className="w-4 h-4" style={{ color: colors.gold }} />
            <span className="text-sm font-semibold" style={{ color: colors.brown }}>
              Time Off
            </span>
          </div>
          <div className="space-y-1.5">
            {activeTimeOff.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <span className="capitalize font-medium" style={{ color: colors.brown }}>
                  {r.category}
                </span>
                <span style={{ color: colors.brownLight }}>
                  {formatDate(r.start_date)} &ndash; {formatDate(r.end_date)}
                </span>
                <Badge className={`text-[10px] px-1.5 py-0 ml-auto ${STATUS_COLORS[r.status] || ''}`}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
