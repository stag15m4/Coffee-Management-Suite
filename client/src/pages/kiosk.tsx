import { useState, useEffect, useCallback, useRef } from 'react';
import { colors } from '@/lib/colors';

// ─── TYPES ──────────────────────────────────────────────

type KioskStep = 'store_code' | 'pin_entry' | 'confirm' | 'countdown' | 'success' | 'my_hours' | 'edit_entry';

interface EmployeeInfo {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  source: 'user_profile' | 'tip_employee';
}

interface ClockState {
  status: 'clocked_out' | 'clocked_in' | 'on_break';
  activeEntryId: string | null;
  clockInTime: string | null;
  activeBreakId: string | null;
  breakStartTime: string | null;
}

interface HoursEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  breaks: { id: string; break_start: string; break_end: string | null }[];
  has_pending_edit: boolean;
}

// ─── HELPERS ────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function calcNetHours(entry: HoursEntry): number {
  if (!entry.clock_out) return 0;
  const total = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3_600_000;
  const breakHrs = entry.breaks.reduce((sum, b) => {
    if (!b.break_end) return sum;
    return sum + (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 3_600_000;
  }, 0);
  return Math.max(0, total - breakHrs);
}

function formatHM(h: number): string {
  if (h <= 0) return '0:00';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

function getPayPeriodRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (day <= 15) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month, 15);
    return { start: fmt(start), end: fmt(end) };
  }
  const start = new Date(year, month, 16);
  const end = new Date(year, month + 1, 0);
  return { start: fmt(start), end: fmt(end) };
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function splitLocal(ts: string) {
  const d = new Date(ts);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

// ─── WAKE LOCK (keep screen on) ─────────────────────────

function useWakeLock() {
  const wakeLock = useRef<any>(null);

  const acquire = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLock.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch { /* not supported or denied */ }
  }, []);

  useEffect(() => {
    acquire();
    // Re-acquire on visibility change (Safari releases wake lock when tab is hidden)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock.current) {
        wakeLock.current.release().catch(() => {});
      }
    };
  }, [acquire]);
}

// ─── MAIN COMPONENT ─────────────────────────────────────

export default function Kiosk() {
  // Keep the screen on
  useWakeLock();

  // Live clock (keeps the page active with regular re-renders)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const [step, setStep] = useState<KioskStep>('store_code');
  const [storeCode, setStoreCode] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [clockState, setClockState] = useState<ClockState>({
    status: 'clocked_out', activeEntryId: null, clockInTime: null, activeBreakId: null, breakStartTime: null,
  });
  const [countdown, setCountdown] = useState(5);
  const [pendingAction, setPendingAction] = useState<'clock_in' | 'clock_out' | 'break_start' | 'break_end'>('clock_in');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState(false);

  // My Hours state
  const [hoursEntries, setHoursEntries] = useState<HoursEntry[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HoursEntry | null>(null);
  const [editClockInDate, setEditClockInDate] = useState('');
  const [editClockInTime, setEditClockInTime] = useState('');
  const [editClockOutDate, setEditClockOutDate] = useState('');
  const [editClockOutTime, setEditClockOutTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Idle timer for my_hours
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (step === 'my_hours' || step === 'edit_entry') {
      idleTimer.current = setTimeout(() => {
        setStep('pin_entry');
        setPin('');
        setEmployee(null);
      }, 60_000);
    }
  }, [step]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [step, resetIdleTimer]);

  // ─── STORE CODE ──────────────────────────────────

  const handleVerifyStore = useCallback(async () => {
    if (!storeCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/kiosk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: storeCode.trim() }),
      });
      if (!resp.ok) {
        setError('Store not found. Check your code.');
        return;
      }
      const data = await resp.json();
      setTenantId(data.tenantId);
      setTenantName(data.tenantName);
      setLogoUrl(data.logoUrl);
      setStep('pin_entry');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }, [storeCode]);

  // ─── PIN ENTRY ───────────────────────────────────

  const handlePinDigit = useCallback((digit: string) => {
    setPinError(false);
    setPin((prev) => {
      const next = prev + digit;
      if (next.length === 4) {
        // Auto-submit
        setTimeout(() => submitPin(next), 100);
      }
      return next.length <= 4 ? next : prev;
    });
  }, []);

  const submitPin = useCallback(async (pinValue: string) => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, pin: pinValue }),
      });
      if (resp.status === 429) {
        setError('Too many attempts. Wait a moment.');
        setPin('');
        setPinError(true);
        return;
      }
      if (!resp.ok) {
        setPin('');
        setPinError(true);
        return;
      }
      const data = await resp.json();
      setEmployee(data.employee);
      setClockState({
        status: data.status,
        activeEntryId: data.activeEntryId,
        clockInTime: data.clockInTime,
        activeBreakId: data.activeBreakId,
        breakStartTime: data.breakStartTime,
      });

      // Determine pending action
      if (data.status === 'clocked_out') setPendingAction('clock_in');
      else if (data.status === 'on_break') setPendingAction('break_end');
      else setPendingAction('clock_out');

      setStep('confirm');
    } catch {
      setError('Connection error. Try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // ─── COUNTDOWN ───────────────────────────────────

  useEffect(() => {
    if (step !== 'countdown') return;
    if (countdown <= 0) {
      executeAction();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown]);

  const startCountdown = useCallback((action: typeof pendingAction) => {
    setPendingAction(action);
    setCountdown(5);
    setStep('countdown');
  }, []);

  const executeAction = useCallback(async () => {
    try {
      let endpoint = '';
      let body: Record<string, string> = { tenantId };

      switch (pendingAction) {
        case 'clock_in':
          endpoint = '/api/kiosk/clock-in';
          body.employeeId = employee!.id;
          body.source = employee!.source;
          body.employeeName = employee!.fullName;
          break;
        case 'clock_out':
          endpoint = '/api/kiosk/clock-out';
          body.employeeId = employee!.id;
          body.entryId = clockState.activeEntryId!;
          break;
        case 'break_start':
          endpoint = '/api/kiosk/break-start';
          body.employeeId = employee!.id;
          body.entryId = clockState.activeEntryId!;
          break;
        case 'break_end':
          endpoint = '/api/kiosk/break-end';
          body.breakId = clockState.activeBreakId!;
          break;
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error('Action failed');

      const messages: Record<string, string> = {
        clock_in: 'Clocked In!',
        clock_out: 'Clocked Out!',
        break_start: 'Break Started!',
        break_end: 'Break Ended!',
      };
      setSuccessMessage(messages[pendingAction]);
      setStep('success');
    } catch {
      setError('Action failed. Please try again.');
      setStep('confirm');
    }
  }, [pendingAction, tenantId, employee, clockState]);

  // ─── SUCCESS AUTO-RESET ──────────────────────────

  useEffect(() => {
    if (step !== 'success') return;
    const timer = setTimeout(() => {
      setStep('pin_entry');
      setPin('');
      setEmployee(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [step]);

  // ─── MY HOURS ────────────────────────────────────

  const loadMyHours = useCallback(async () => {
    if (!employee) return;
    setLoadingHours(true);
    try {
      const { start, end } = getPayPeriodRange();
      const params = new URLSearchParams({ tenantId, employeeId: employee.id, source: employee.source, start, end });
      const resp = await fetch(`/api/kiosk/my-hours?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setHoursEntries(data);
      }
    } catch { /* ignore */ } finally {
      setLoadingHours(false);
    }
  }, [tenantId, employee]);

  const openMyHours = useCallback(() => {
    setStep('my_hours');
    loadMyHours();
  }, [loadMyHours]);

  const openEditEntry = useCallback((entry: HoursEntry) => {
    resetIdleTimer();
    setEditingEntry(entry);
    const inParts = splitLocal(entry.clock_in);
    setEditClockInDate(inParts.date);
    setEditClockInTime(inParts.time);
    if (entry.clock_out) {
      const outParts = splitLocal(entry.clock_out);
      setEditClockOutDate(outParts.date);
      setEditClockOutTime(outParts.time);
    } else {
      setEditClockOutDate(inParts.date);
      setEditClockOutTime('');
    }
    setEditReason('');
    setStep('edit_entry');
  }, [resetIdleTimer]);

  const submitEditRequest = useCallback(async () => {
    if (!editingEntry || !editReason.trim()) return;
    setSubmittingEdit(true);
    try {
      const combine = (date: string, time: string) => {
        if (!date || !time) return null;
        return new Date(`${date}T${time}`).toISOString();
      };
      const resp = await fetch('/api/kiosk/edit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          employeeId: employee!.id,
          entryId: editingEntry.id,
          correctedClockIn: combine(editClockInDate, editClockInTime),
          correctedClockOut: combine(editClockOutDate, editClockOutTime),
          reason: editReason.trim(),
        }),
      });
      if (!resp.ok) throw new Error('Failed');
      setStep('my_hours');
      loadMyHours();
    } catch {
      setError('Failed to submit request. Try again.');
    } finally {
      setSubmittingEdit(false);
    }
  }, [editingEntry, editReason, editClockInDate, editClockInTime, editClockOutDate, editClockOutTime, tenantId, employee, loadMyHours]);

  // ─── ACTION LABELS ───────────────────────────────

  const actionLabel = pendingAction === 'clock_in' ? 'Clock In'
    : pendingAction === 'clock_out' ? 'Clock Out'
    : pendingAction === 'break_start' ? 'Start Break'
    : 'End Break';

  const actionColor = pendingAction === 'clock_in' ? '#22c55e'
    : pendingAction === 'clock_out' ? '#ef4444'
    : pendingAction === 'break_start' ? colors.gold
    : '#22c55e';

  // ─── RENDER ──────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: colors.cream, userSelect: 'none', WebkitUserSelect: 'none' }}
      onTouchStart={step === 'my_hours' || step === 'edit_entry' ? resetIdleTimer : undefined}
    >
      {/* ─── STORE CODE STEP ─── */}
      {step === 'store_code' && (
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.gold }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold" style={{ color: colors.brown }}>Time Clock</h1>
            <p className="text-sm mt-1" style={{ color: colors.brownLight }}>Enter your store code to begin</p>
          </div>
          <input
            type="text"
            value={storeCode}
            onChange={(e) => { setStoreCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyStore()}
            className="w-full text-center text-2xl tracking-[0.3em] font-bold py-4 px-6 rounded-xl border-2 outline-none transition-colors"
            style={{ backgroundColor: colors.white, borderColor: error ? '#ef4444' : colors.gold, color: colors.brown }}
            placeholder="STORE CODE"
            autoFocus
            autoCapitalize="characters"
          />
          {error && <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>}
          <button
            onClick={handleVerifyStore}
            disabled={loading || !storeCode.trim()}
            className="w-full py-4 rounded-xl text-lg font-bold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: colors.gold }}
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </div>
      )}

      {/* ─── PIN ENTRY STEP ─── */}
      {step === 'pin_entry' && (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          {/* Tenant header */}
          <div className="text-center">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-12 h-12 rounded-full mx-auto mb-2 object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: colors.gold }}>
                {tenantName.charAt(0)}
              </div>
            )}
            <h2 className="text-xl font-bold" style={{ color: colors.brown }}>{tenantName}</h2>
            <p className="text-sm" style={{ color: colors.brownLight }}>Enter your PIN</p>
          </div>

          {/* PIN dots */}
          <div className="flex gap-4 justify-center">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${pinError && pin.length === 0 ? 'animate-shake' : ''}`}
                style={{
                  borderColor: pinError ? '#ef4444' : colors.gold,
                  backgroundColor: i < pin.length ? (pinError ? '#ef4444' : colors.gold) : 'transparent',
                  transform: i < pin.length ? 'scale(1.1)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          {error && <p className="text-sm font-medium text-center" style={{ color: '#ef4444' }}>{error}</p>}

          {/* Numeric pad */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', '\u232B'].map((key) => (
              <button
                key={key}
                onClick={() => {
                  if (key === 'CLR') { setPin(''); setPinError(false); setError(''); }
                  else if (key === '\u232B') setPin((p) => p.slice(0, -1));
                  else if (pin.length < 4) handlePinDigit(key);
                }}
                disabled={loading}
                className="w-20 h-20 rounded-full text-2xl font-bold flex items-center justify-center transition-colors active:scale-95"
                style={{
                  backgroundColor: key === 'CLR' || key === '\u232B' ? colors.cream : colors.white,
                  color: colors.brown,
                  border: `2px solid ${colors.creamDark}`,
                  fontSize: key === 'CLR' ? '14px' : undefined,
                }}
              >
                {key}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setStep('store_code'); setStoreCode(''); setPin(''); setError(''); }}
            className="text-sm underline mt-2"
            style={{ color: colors.brownLight }}
          >
            Change Store
          </button>
        </div>
      )}

      {/* ─── CONFIRM STEP ─── */}
      {step === 'confirm' && employee && (
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          {/* Employee info */}
          {employee.avatarUrl ? (
            <img src={employee.avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover border-4" style={{ borderColor: colors.gold }} />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white" style={{ backgroundColor: colors.gold }}>
              {employee.fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-center">
            <h2 className="text-2xl font-bold" style={{ color: colors.brown }}>{employee.fullName}</h2>
            <div
              className="inline-block mt-2 px-4 py-1.5 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: clockState.status === 'clocked_out' ? '#fef2f2' : clockState.status === 'on_break' ? '#fffbeb' : '#f0fdf4',
                color: clockState.status === 'clocked_out' ? '#991b1b' : clockState.status === 'on_break' ? '#92400e' : '#166534',
              }}
            >
              {clockState.status === 'clocked_out' && 'Clocked Out'}
              {clockState.status === 'clocked_in' && `Clocked In since ${formatTime(clockState.clockInTime!)}`}
              {clockState.status === 'on_break' && `On Break since ${formatTime(clockState.breakStartTime!)}`}
            </div>
          </div>

          {/* Primary action */}
          <button
            onClick={() => startCountdown(pendingAction)}
            className="w-full py-5 rounded-xl text-xl font-bold text-white transition-opacity active:scale-[0.98]"
            style={{ backgroundColor: actionColor }}
          >
            {actionLabel}
          </button>

          {/* Secondary actions */}
          {clockState.status === 'clocked_in' && (
            <button
              onClick={() => startCountdown('break_start')}
              className="w-full py-4 rounded-xl text-lg font-semibold border-2 transition-opacity active:scale-[0.98]"
              style={{ borderColor: colors.gold, color: colors.gold, backgroundColor: 'transparent' }}
            >
              Start Break
            </button>
          )}

          {/* My Hours button */}
          <button
            onClick={openMyHours}
            className="w-full py-3 rounded-xl text-base font-medium border-2 active:scale-[0.98]"
            style={{ borderColor: colors.creamDark, color: colors.brown, backgroundColor: colors.white }}
          >
            My Hours
          </button>

          {/* Cancel */}
          <button
            onClick={() => { setStep('pin_entry'); setPin(''); setEmployee(null); }}
            className="text-sm underline"
            style={{ color: colors.brownLight }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ─── COUNTDOWN STEP ─── */}
      {step === 'countdown' && employee && (
        <div className="flex flex-col items-center gap-8 w-full max-w-sm">
          <div className="text-center">
            <h2 className="text-xl font-bold" style={{ color: colors.brown }}>{employee.fullName}</h2>
          </div>

          {/* Countdown circle */}
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold"
            style={{ backgroundColor: actionColor, color: '#fff' }}
          >
            {countdown}
          </div>

          <p className="text-lg font-semibold" style={{ color: colors.brown }}>
            {pendingAction === 'clock_in' && 'Clocking In...'}
            {pendingAction === 'clock_out' && 'Clocking Out...'}
            {pendingAction === 'break_start' && 'Starting Break...'}
            {pendingAction === 'break_end' && 'Ending Break...'}
          </p>

          <button
            onClick={() => { setStep('confirm'); }}
            className="w-full py-4 rounded-xl text-lg font-semibold border-2 active:scale-[0.98]"
            style={{ borderColor: colors.creamDark, color: colors.brown, backgroundColor: colors.white }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ─── SUCCESS STEP ─── */}
      {step === 'success' && (
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: '#22c55e' }}>
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold" style={{ color: colors.brown }}>{successMessage}</h2>
          <p className="text-sm" style={{ color: colors.brownLight }}>
            {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      )}

      {/* ─── MY HOURS STEP ─── */}
      {step === 'my_hours' && employee && (
        <div className="flex flex-col w-full max-w-lg gap-4" style={{ maxHeight: '90vh' }}>
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('confirm')}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
              style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
            >
              <svg className="w-5 h-5" fill="none" stroke={colors.brown} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-bold" style={{ color: colors.brown }}>{employee.fullName}</h2>
              <p className="text-xs" style={{ color: colors.brownLight }}>Current Pay Period</p>
            </div>
          </div>

          {/* Entries */}
          <div className="flex-1 overflow-y-auto rounded-xl" style={{ backgroundColor: colors.white }}>
            {loadingHours ? (
              <div className="text-center py-12" style={{ color: colors.brownLight }}>Loading...</div>
            ) : hoursEntries.length === 0 ? (
              <div className="text-center py-12" style={{ color: colors.brownLight }}>No entries this period</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.creamDark}` }}>
                    <th className="text-left py-3 px-4" style={{ color: colors.brownLight }}>Date</th>
                    <th className="text-center py-3 px-2" style={{ color: colors.brownLight }}>In</th>
                    <th className="text-center py-3 px-2" style={{ color: colors.brownLight }}>Out</th>
                    <th className="text-right py-3 px-4" style={{ color: colors.brownLight }}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {hoursEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => !entry.has_pending_edit && entry.clock_out && openEditEntry(entry)}
                      className={entry.clock_out && !entry.has_pending_edit ? 'active:bg-gray-50 cursor-pointer' : ''}
                      style={{ borderBottom: `1px solid ${colors.cream}` }}
                    >
                      <td className="py-3 px-4" style={{ color: colors.brown }}>
                        <div className="flex items-center gap-2">
                          {formatDate(entry.clock_in)}
                          {entry.has_pending_edit && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                              Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2" style={{ color: colors.brown }}>{formatTime(entry.clock_in)}</td>
                      <td className="text-center py-3 px-2" style={{ color: entry.clock_out ? colors.brown : colors.brownLight }}>
                        {entry.clock_out ? formatTime(entry.clock_out) : '--'}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold" style={{ color: colors.brown }}>
                        {entry.clock_out ? formatHM(calcNetHours(entry)) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${colors.creamDark}` }}>
                    <td colSpan={3} className="py-3 px-4 font-semibold" style={{ color: colors.brown }}>Total</td>
                    <td className="text-right py-3 px-4 font-bold" style={{ color: colors.gold }}>
                      {formatHM(hoursEntries.reduce((sum, e) => sum + calcNetHours(e), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <p className="text-xs text-center" style={{ color: colors.brownLight }}>
            Tap a completed entry to request a correction
          </p>
        </div>
      )}

      {/* ─── EDIT ENTRY STEP ─── */}
      {step === 'edit_entry' && editingEntry && employee && (
        <div className="flex flex-col w-full max-w-sm gap-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('my_hours')}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
              style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
            >
              <svg className="w-5 h-5" fill="none" stroke={colors.brown} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-bold" style={{ color: colors.brown }}>Request Correction</h2>
              <p className="text-xs" style={{ color: colors.brownLight }}>{formatDate(editingEntry.clock_in)}</p>
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: colors.white }}>
            {/* Original times */}
            <div className="text-sm" style={{ color: colors.brownLight }}>
              Original: {formatTime(editingEntry.clock_in)} – {editingEntry.clock_out ? formatTime(editingEntry.clock_out) : '--'}
            </div>

            {/* Corrected clock in */}
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>Corrected Clock In</label>
              <div className="flex gap-2">
                <input type="date" value={editClockInDate} onChange={(e) => setEditClockInDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }} />
                <input type="time" value={editClockInTime} onChange={(e) => setEditClockInTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }} />
              </div>
            </div>

            {/* Corrected clock out */}
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>Corrected Clock Out</label>
              <div className="flex gap-2">
                <input type="date" value={editClockOutDate} onChange={(e) => setEditClockOutDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }} />
                <input type="time" value={editClockOutTime} onChange={(e) => setEditClockOutTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }} />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-sm font-medium block mb-1" style={{ color: colors.brown }}>Reason *</label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why does this need to be corrected?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
              />
            </div>

            {error && <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>}

            <button
              onClick={submitEditRequest}
              disabled={submittingEdit || !editReason.trim()}
              className="w-full py-3 rounded-xl text-base font-bold text-white transition-opacity disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: colors.gold }}
            >
              {submittingEdit ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Live clock footer — keeps page active */}
      <div className="fixed bottom-0 left-0 right-0 py-2 text-center text-xs" style={{ color: colors.brownLight }}>
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
        {' \u00B7 '}
        {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}
