import { useState, useEffect, useMemo } from 'react';
import { LogIn, LogOut, Coffee, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveClockEntry, useClockIn, useClockOut, useStartBreak, useEndBreak, useTimeClockEntries } from '@/hooks/use-time-clock';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import { useShifts } from '@/hooks/use-shifts';
import type { Shift } from '@/hooks/use-shifts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-queries';
import { useQuery } from '@tanstack/react-query';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]}, ${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function calcWeekHours(entries: TimeClockEntry[]): number {
  let total = 0;
  for (const e of entries) {
    const start = new Date(e.clock_in).getTime();
    const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    let breakMs = 0;
    for (const b of e.breaks ?? []) {
      const bs = new Date(b.break_start).getTime();
      const be = b.break_end ? new Date(b.break_end).getTime() : Date.now();
      breakMs += be - bs;
    }
    total += end - start - breakMs;
  }
  return Math.round((total / 3_600_000) * 10) / 10;
}

function getNextShift(shifts: Shift[]): Shift | null {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0, 5);
  for (const s of shifts) {
    if (s.date > todayStr) return s;
    if (s.date === todayStr && s.start_time > nowTime) return s;
  }
  return null;
}

function formatElapsed(clockInTime: string): string {
  const ms = Date.now() - new Date(clockInTime).getTime();
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface AdminTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
}

export default function EmployeeDashboard() {
  const { user, profile, tenant, canAccessModule } = useAuth();
  const { toast } = useToast();
  const activeEntry = useActiveClockEntry();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();

  // Tick for elapsed timer
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeEntry.data) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [activeEntry.data]);

  // Week range
  const monday = useMemo(() => getMonday(new Date()), []);
  const weekStart = monday.toISOString().split('T')[0];
  const sunday = useMemo(() => {
    const s = new Date(monday);
    s.setDate(s.getDate() + 6);
    return s;
  }, [monday]);
  const weekEnd = sunday.toISOString().split('T')[0];

  const weekEntries = useTimeClockEntries(weekStart, weekEnd, user?.id);
  const shifts = useShifts(weekStart, weekEnd);

  // Filter to user's shifts
  const myShifts = useMemo(
    () => (shifts.data ?? []).filter((s) => s.employee_id === user?.id),
    [shifts.data, user?.id],
  );
  const nextShift = useMemo(() => getNextShift(myShifts), [myShifts]);
  const weekHours = useMemo(() => calcWeekHours(weekEntries.data ?? []), [weekEntries.data]);

  // Tasks (only when module enabled)
  const showTasks = canAccessModule('admin-tasks');
  const tasks = useQuery<AdminTask[]>({
    queryKey: ['employee-tasks', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('admin_tasks')
        .select('id, title, priority, status, due_date')
        .eq('assigned_to', profile.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: showTasks && !!profile?.id,
    staleTime: 60_000,
  });

  // Derived state
  const entry = activeEntry.data;
  const activeBreak = entry?.breaks?.find((b) => !b.break_end) ?? null;
  const isClockedIn = !!entry;
  const isOnBreak = !!activeBreak;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  // Actions
  async function handleHeroTap() {
    try {
      if (!isClockedIn) {
        await clockIn.mutateAsync(undefined);
        toast({ title: 'Clocked in!' });
      } else {
        if (isOnBreak) return; // must end break first
        await clockOut.mutateAsync({ id: entry!.id });
        toast({ title: 'Clocked out!' });
      }
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    }
  }

  async function handleBreak() {
    try {
      if (isOnBreak) {
        await endBreak.mutateAsync(activeBreak!.id);
        toast({ title: 'Break ended' });
      } else {
        await startBreak.mutateAsync({ entryId: entry!.id });
        toast({ title: 'Break started' });
      }
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    }
  }

  const busy = clockIn.isPending || clockOut.isPending || startBreak.isPending || endBreak.isPending;

  // Hero button styles
  const heroColor = !isClockedIn
    ? '#22c55e'
    : isOnBreak
      ? '#f59e0b'
      : 'var(--color-primary)';

  const priorityColors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f59e0b',
    medium: '#3b82f6',
    low: '#6b7280',
  };

  return (
    <div className="min-h-screen pb-8" style={{ background: 'var(--color-accent)' }}>
      <div className="mx-auto max-w-md px-4 pt-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-secondary)' }}>
            Hi, {firstName}!
          </h1>
          <p className="text-sm mt-1 opacity-70" style={{ color: 'var(--color-secondary)' }}>
            {tenant?.name} &bull; {weekHours}h this week
          </p>
        </div>

        {/* Hero Clock Button */}
        <div className="flex flex-col items-center gap-3">
          <button
            disabled={busy || activeEntry.isLoading || (isClockedIn && isOnBreak)}
            onClick={handleHeroTap}
            className="relative flex items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-60"
            style={{
              width: 120,
              height: 120,
              background: heroColor,
              boxShadow: `0 4px 20px ${heroColor}44`,
            }}
          >
            {/* Pulsing ring when clocked in and working */}
            {isClockedIn && !isOnBreak && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: heroColor }}
              />
            )}
            {!isClockedIn ? (
              <LogIn size={32} color="#fff" />
            ) : isOnBreak ? (
              <Coffee size={32} color="#fff" />
            ) : (
              <span className="text-white font-bold text-lg">{formatElapsed(entry!.clock_in)}</span>
            )}
          </button>
          <span className="text-sm font-medium" style={{ color: 'var(--color-secondary)' }}>
            {!isClockedIn
              ? 'Clock In'
              : isOnBreak
                ? 'On Break'
                : `Since ${formatTimestamp(entry!.clock_in)}`}
          </span>
        </div>

        {/* Secondary Actions */}
        {isClockedIn && (
          <div className="flex justify-center gap-3">
            <button
              disabled={busy}
              onClick={handleBreak}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-transform active:scale-95"
              style={{
                borderColor: isOnBreak ? '#f59e0b' : 'var(--color-secondary)',
                color: isOnBreak ? '#f59e0b' : 'var(--color-secondary)',
                background: 'var(--color-background)',
              }}
            >
              {isOnBreak ? 'End Break' : 'Break'}
            </button>
            <button
              disabled={busy || isOnBreak}
              onClick={() => handleHeroTap()}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-transform active:scale-95 disabled:opacity-40"
              style={{ borderColor: '#ef4444', color: '#ef4444', background: 'var(--color-background)' }}
            >
              <span className="flex items-center gap-1.5">
                <LogOut size={14} /> Clock Out
              </span>
            </button>
          </div>
        )}

        {/* Next Shift */}
        <Section title="Next Shift">
          {nextShift ? (
            <p className="text-sm" style={{ color: 'var(--color-secondary)' }}>
              {formatDate(nextShift.date)} &bull; {formatTime(nextShift.start_time)}&ndash;
              {formatTime(nextShift.end_time)}
              {nextShift.position && <> &bull; {nextShift.position}</>}
            </p>
          ) : (
            <p className="text-sm opacity-60" style={{ color: 'var(--color-secondary)' }}>
              No upcoming shifts
            </p>
          )}
        </Section>

        {/* This Week */}
        <Section title="This Week">
          {myShifts.length === 0 ? (
            <p className="text-sm opacity-60" style={{ color: 'var(--color-secondary)' }}>
              No shifts scheduled
            </p>
          ) : (
            <div className="space-y-1.5">
              {myShifts.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-secondary)' }}>
                  <span className="w-10 font-medium">{formatDate(s.date).split(',')[0]}</span>
                  <span>{formatTime(s.start_time)}&ndash;{formatTime(s.end_time)}</span>
                  {s.position && <span className="ml-auto opacity-60">{s.position}</span>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* My Tasks */}
        {showTasks && (tasks.data?.length ?? 0) > 0 && (
          <Section title={`My Tasks (${tasks.data!.length})`}>
            <div className="space-y-2">
              {tasks.data!.map((t) => (
                <div key={t.id} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-secondary)' }}>
                  <span className="mt-0.5 h-3.5 w-3.5 rounded border flex-shrink-0" style={{ borderColor: 'var(--color-secondary)' }} />
                  <span className="flex-1">{t.title}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{
                      background: `${priorityColors[t.priority] ?? '#6b7280'}18`,
                      color: priorityColors[t.priority] ?? '#6b7280',
                    }}
                  >
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-background)' }}>
      <h2
        className="text-xs font-semibold uppercase tracking-wide mb-2 opacity-60"
        style={{ color: 'var(--color-secondary)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
