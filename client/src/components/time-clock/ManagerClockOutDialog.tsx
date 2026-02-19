import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useEditTimeClockEntry, useUpdateEntryManagerNotes } from '@/hooks/use-time-clock';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import { Clock, LogOut, Edit2 } from 'lucide-react';
import { colors } from '@/lib/colors';

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function splitLocal(ts: string) {
  const d = new Date(ts);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

interface ManagerClockOutDialogProps {
  entry: TimeClockEntry;
  employeeName: string;
  onClose: () => void;
}

export function ManagerClockOutDialog({ entry, employeeName, onClose }: ManagerClockOutDialogProps) {
  const { toast } = useToast();
  const editEntry = useEditTimeClockEntry();
  const updateNotes = useUpdateEntryManagerNotes();

  const isActive = !entry.clock_out;

  const inParts = splitLocal(entry.clock_in);
  const [clockInDate, setClockInDate] = useState(inParts.date);
  const [clockInTime, setClockInTime] = useState(inParts.time);
  const [clockOutDate, setClockOutDate] = useState(
    entry.clock_out ? splitLocal(entry.clock_out).date : inParts.date
  );
  const [clockOutTime, setClockOutTime] = useState(
    entry.clock_out ? splitLocal(entry.clock_out).time : ''
  );
  const [managerNotes, setManagerNotes] = useState('');

  const handleForceClockOut = useCallback(async () => {
    try {
      await editEntry.mutateAsync({
        id: entry.id,
        clock_out: new Date().toISOString(),
      });
      if (managerNotes.trim()) {
        await updateNotes.mutateAsync({ id: entry.id, manager_notes: managerNotes.trim() });
      }
      toast({ title: `${employeeName} clocked out` });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to clock out employee.', variant: 'destructive' });
    }
  }, [entry.id, employeeName, managerNotes, editEntry, updateNotes, toast, onClose]);

  const handleSaveTime = useCallback(async () => {
    const combineToISO = (date: string, time: string) => {
      if (!date || !time) return null;
      return new Date(`${date}T${time}`).toISOString();
    };

    const newClockIn = combineToISO(clockInDate, clockInTime);
    const newClockOut = combineToISO(clockOutDate, clockOutTime);

    if (!newClockOut) {
      toast({ title: 'Enter a clock-out time', variant: 'destructive' });
      return;
    }

    if (newClockIn && newClockOut && new Date(newClockOut) <= new Date(newClockIn)) {
      toast({ title: 'Clock out must be after clock in', variant: 'destructive' });
      return;
    }

    const updates: { id: string; clock_in?: string; clock_out?: string } = { id: entry.id };
    if (newClockIn && newClockIn !== entry.clock_in) updates.clock_in = newClockIn;
    if (newClockOut !== entry.clock_out) updates.clock_out = newClockOut;

    if (!updates.clock_in && !updates.clock_out) {
      toast({ title: 'No changes detected', variant: 'destructive' });
      return;
    }

    try {
      await editEntry.mutateAsync(updates);
      if (managerNotes.trim()) {
        await updateNotes.mutateAsync({ id: entry.id, manager_notes: managerNotes.trim() });
      }
      toast({ title: 'Time entry updated' });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to update time entry.', variant: 'destructive' });
    }
  }, [entry, clockInDate, clockInTime, clockOutDate, clockOutTime, managerNotes, editEntry, updateNotes, toast, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md" style={{ backgroundColor: colors.white }} onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
            <Edit2 className="w-5 h-5" style={{ color: colors.gold }} />
            Edit Time Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current entry info */}
          <div className="p-2 rounded-lg text-sm" style={{ backgroundColor: colors.cream, color: colors.brownLight }}>
            <p className="font-medium" style={{ color: colors.brown }}>{employeeName}</p>
            <p>In: {formatTimestamp(entry.clock_in)} &middot; {new Date(entry.clock_in).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
            <p>Out: {entry.clock_out ? `${formatTimestamp(entry.clock_out)} · ${new Date(entry.clock_out).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'Still clocked in'}</p>
          </div>

          {/* Force clock out button — only for active entries */}
          {isActive && (
            <Button
              onClick={handleForceClockOut}
              disabled={editEntry.isPending}
              className="w-full"
              style={{ backgroundColor: colors.red, color: '#fff' }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Force Clock Out Now
            </Button>
          )}

          {isActive && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: colors.creamDark }} />
              <span className="text-xs" style={{ color: colors.brownLight }}>or enter a specific time</span>
              <div className="flex-1 h-px" style={{ backgroundColor: colors.creamDark }} />
            </div>
          )}

          {/* Clock In fields */}
          <div className="space-y-1.5">
            <Label style={{ color: colors.brown }}>Clock In</Label>
            <div className="flex gap-2">
              <Input type="date" value={clockInDate}
                onChange={(e) => setClockInDate(e.target.value)}
                className="flex-1"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
              <Input type="time" value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                className="w-28"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
            </div>
          </div>

          {/* Clock Out fields */}
          <div className="space-y-1.5">
            <Label style={{ color: colors.brown }}>Clock Out</Label>
            <div className="flex gap-2">
              <Input type="date" value={clockOutDate}
                onChange={(e) => setClockOutDate(e.target.value)}
                className="flex-1"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
              <Input type="time" value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="w-28"
                placeholder="--:--"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
            </div>
          </div>

          {/* Manager notes */}
          <div className="space-y-1.5">
            <Label style={{ color: colors.brown }}>Manager Notes</Label>
            <Textarea value={managerNotes} placeholder="Optional note..."
              onChange={(e) => setManagerNotes(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} rows={2} />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveTime} disabled={editEntry.isPending}
              style={{ backgroundColor: colors.gold, color: colors.white }} className="flex-1">
              <Clock className="w-4 h-4 mr-1" /> Save Time
            </Button>
            <Button variant="outline" onClick={onClose}
              style={{ borderColor: colors.creamDark, color: colors.brown }}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
