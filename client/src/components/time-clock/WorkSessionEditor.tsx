import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useWorkSessionActions } from '@/hooks/use-work-sessions';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import { getErrorMessage } from '@/lib/utils';

export function localDateTime(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Keep seconds when a minute-resolution field was not changed.
export function preserveTimestamp(value: string, original?: string | null) {
  return original && value === localDateTime(original) ? original : new Date(value).toISOString();
}

export function WorkSessionEditor({
  entry,
  employeeId,
  day,
  requestOnly = false,
  onClose,
  onSaved,
}: {
  entry?: TimeClockEntry;
  employeeId: string;
  day: string;
  requestOnly?: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { save, remove } = useWorkSessionActions();
  const [clockIn, setClockIn] = useState(entry ? localDateTime(entry.clock_in) : '');
  const [clockOut, setClockOut] = useState(
    entry?.clock_out ? localDateTime(entry.clock_out) : entry ? localDateTime(new Date().toISOString()) : ''
  );
  const [breaks, setBreaks] = useState<Array<{ id?: string; start: string; end: string; type: string }>>(
    (entry?.breaks ?? []).map((b) => ({
      id: b.id,
      start: localDateTime(b.break_start),
      end: b.break_end ? localDateTime(b.break_end) : '',
      type: b.break_type,
    }))
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const busy = save.isPending || remove.isPending;

  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setError('');
    try {
      if (!reason.trim()) throw new Error('Enter a reason for this change.');
      if (!clockIn || !clockOut || new Date(clockOut) <= new Date(clockIn))
        throw new Error('Clock out must follow clock in. Include the correct date for overnight work.');
      const payload = breaks.map((b) => {
        if (!b.start || !b.end) throw new Error('Enter both times for every break, or remove the break.');
        const original = entry?.breaks?.find((originalBreak) => originalBreak.id === b.id);
        return {
          id: b.id,
          break_start: preserveTimestamp(b.start, original?.break_start),
          break_end: preserveTimestamp(b.end, original?.break_end),
          break_type: b.type,
        };
      });
      await save.mutateAsync({
        requestOnly,
        input: {
          employeeId,
          entryId: entry?.id,
          expectedUpdatedAt: entry?.updated_at,
          clockIn: preserveTimestamp(clockIn, entry?.clock_in),
          clockOut: preserveTimestamp(clockOut, entry?.clock_out),
          breaks: payload,
          reason: reason.trim(),
        },
      });
      onSaved(
        requestOnly
          ? 'Missed session pending manager approval. Recorded hours have not changed.'
          : 'Work session saved. Punches, breaks, and change history were saved together.'
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err) || 'Could not confirm the save. Refresh before retrying.');
    } finally {
      lock.current = false;
    }
  }

  async function deleteSession() {
    if (!entry || lock.current) return;
    if (!reason.trim()) {
      setError('Enter a reason before deleting this session.');
      return;
    }
    if (!confirm('Delete this work session? Its change history will be retained.')) return;
    lock.current = true;
    setError('');
    try {
      await remove.mutateAsync({ entryId: entry.id, expectedUpdatedAt: entry.updated_at, reason: reason.trim() });
      onSaved('Session deleted. Its change history is retained.');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      lock.current = false;
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {requestOnly ? 'Request missed work session' : entry ? 'Edit work session' : 'Add work session'}
          </DialogTitle>
          <DialogDescription>
            {requestOnly
              ? 'The proposed session stays out of recorded hours until a manager approves it.'
              : 'Saving updates recorded hours immediately and keeps a before-and-after record with your reason.'}
          </DialogDescription>
        </DialogHeader>
        {!entry && <p className="text-sm">Work date: {day}. Enter the actual start and end dates and times.</p>}
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm">
            Clock in
            <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
          </label>
          <label className="block text-sm">
            Clock out
            <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
          </label>
          {breaks.map((b, index) => (
            <div key={b.id ?? `new-${index}`} className="rounded border p-3 space-y-2">
              <p className="font-medium text-sm">Break {index + 1}</p>
              <label className="block text-sm">
                Start
                <Input
                  type="datetime-local"
                  value={b.start}
                  onChange={(e) =>
                    setBreaks((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, start: e.target.value } : item))
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Return
                <Input
                  type="datetime-local"
                  value={b.end}
                  onChange={(e) =>
                    setBreaks((prev) => prev.map((item, i) => (i === index ? { ...item, end: e.target.value } : item)))
                  }
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBreaks((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove break
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setBreaks((prev) => [...prev, { start: '', end: '', type: 'break' }])}
          >
            Add break
          </Button>
          <label className="block text-sm">
            Reason (required)
            <Textarea
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the missing session or correction"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={submit}>
              {busy ? 'Saving…' : requestOnly ? 'Submit for approval' : 'Save to timesheet'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {entry && !requestOnly && (
              <Button type="button" variant="destructive" onClick={deleteSession}>
                Delete session
              </Button>
            )}
          </div>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
