import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCreateTimeClockEdit } from '@/hooks/use-time-clock-edits';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import { Edit2, Check } from 'lucide-react';
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

interface EditRequestDialogProps {
  entry: TimeClockEntry;
  onClose: () => void;
}

export function EditRequestDialog({ entry, onClose }: EditRequestDialogProps) {
  const { toast } = useToast();
  const createEdit = useCreateTimeClockEdit();

  const inParts = splitLocal(entry.clock_in);
  const [clockInDate, setClockInDate] = useState(inParts.date);
  const [clockInTime, setClockInTime] = useState(inParts.time);
  const [clockOutDate, setClockOutDate] = useState(
    entry.clock_out ? splitLocal(entry.clock_out).date : inParts.date
  );
  const [clockOutTime, setClockOutTime] = useState(
    entry.clock_out ? splitLocal(entry.clock_out).time : ''
  );
  const [reason, setReason] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!reason.trim()) {
      toast({ title: 'Please provide a reason', variant: 'destructive' });
      return;
    }
    const combineToISO = (date: string, time: string) => {
      if (!date || !time) return null;
      return new Date(`${date}T${time}`).toISOString();
    };
    const newClockIn = combineToISO(clockInDate, clockInTime);
    const newClockOut = combineToISO(clockOutDate, clockOutTime);

    const clockInChanged = newClockIn && newClockIn !== entry.clock_in;
    const clockOutChanged = newClockOut !== entry.clock_out;

    if (!clockInChanged && !clockOutChanged) {
      toast({ title: 'No changes detected', description: 'Adjust the clock-in or clock-out time.', variant: 'destructive' });
      return;
    }

    try {
      await createEdit.mutateAsync({
        time_clock_entry_id: entry.id,
        original_clock_in: entry.clock_in,
        original_clock_out: entry.clock_out,
        requested_clock_in: clockInChanged ? newClockIn : null,
        requested_clock_out: clockOutChanged ? newClockOut : null,
        reason: reason.trim(),
      });
      toast({ title: 'Edit request submitted', description: 'Your manager will review it.' });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to submit edit request.', variant: 'destructive' });
    }
  }, [entry, clockInDate, clockInTime, clockOutDate, clockOutTime, reason, createEdit, toast, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md" style={{ backgroundColor: colors.white }} onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
            <Edit2 className="w-5 h-5" style={{ color: colors.gold }} />
            Request Time Edit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-2 rounded-lg text-sm" style={{ backgroundColor: colors.cream, color: colors.brownLight }}>
            <p className="font-medium" style={{ color: colors.brown }}>Current entry:</p>
            <p>In: {formatTimestamp(entry.clock_in)} &middot; {new Date(entry.clock_in).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
            <p>Out: {entry.clock_out ? `${formatTimestamp(entry.clock_out)} · ${new Date(entry.clock_out).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'Not clocked out'}</p>
          </div>
          <div className="space-y-1.5">
            <Label style={{ color: colors.brown }}>Corrected Clock In</Label>
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
          <div className="space-y-1.5">
            <Label style={{ color: colors.brown }}>Corrected Clock Out</Label>
            <div className="flex gap-2">
              <Input type="date" value={clockOutDate}
                onChange={(e) => setClockOutDate(e.target.value)}
                className="flex-1"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
              <Input type="time" value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="w-28"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label style={{ color: colors.brown }}>Reason <span style={{ color: colors.red }}>*</span></Label>
            <Textarea value={reason} placeholder="e.g. Forgot to clock out, clocked in late..."
              onChange={(e) => setReason(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} rows={2} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={createEdit.isPending}
              style={{ backgroundColor: colors.gold, color: colors.white }} className="flex-1">
              <Check className="w-4 h-4 mr-1" /> Submit Request
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
