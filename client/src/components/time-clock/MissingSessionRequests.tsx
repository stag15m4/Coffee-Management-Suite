import { useState } from 'react';
import { useMissingSessions, useWorkSessionActions } from '@/hooks/use-work-sessions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { PayPeriod } from '@/lib/pay-periods';
import { getErrorMessage } from '@/lib/utils';

export function MissingSessionRequests({
  employeeId,
  currentUserId,
  period,
  canReview,
}: {
  employeeId?: string;
  currentUserId: string;
  period?: PayPeriod;
  canReview: boolean;
}) {
  const { data = [], isError, isLoading } = useMissingSessions(employeeId);
  const { review } = useWorkSessionActions();
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const requests = data.filter((r) => {
    if (!period) return r.status === 'pending';
    const day = new Date(r.clock_in).toLocaleDateString('sv-SE');
    return day >= period.start && day <= period.end;
  });
  async function decide(id: string, status: 'approved' | 'denied' | 'cancelled') {
    setError('');
    try {
      await review.mutateAsync({ id, status, notes: notes[id] });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }
  if (isError)
    return <p role="alert">Missed-session requests could not load. Refresh before submitting another request.</p>;
  if (isLoading)
    return (
      <p role="status" className="text-sm">
        Loading missed-session requests…
      </p>
    );
  if (!requests.length) return null;
  return (
    <section className="rounded-lg border bg-white p-4 space-y-3" aria-label="Missed-session requests">
      <h3 className="font-semibold">Missed work sessions</h3>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {requests.map((r) => (
        <div key={r.id} className="rounded border p-3 space-y-2 text-sm">
          <p className="font-medium">{r.employee?.full_name || 'Employee'}</p>
          <Badge variant="outline">
            {r.status === 'pending'
              ? 'Pending manager approval — excluded from hours'
              : r.status === 'approved'
                ? 'Approved — session added'
                : r.status}
          </Badge>
          <p>
            {new Date(r.clock_in).toLocaleString()} → {new Date(r.clock_out).toLocaleString()}
          </p>
          {r.breaks.map((b, i) => (
            <p key={i}>
              Break {i + 1}: {new Date(b.break_start).toLocaleString()} → {new Date(b.break_end).toLocaleString()}
            </p>
          ))}
          <p>Reason: {r.reason}</p>
          {r.reviewed_at && <p>Reviewed {new Date(r.reviewed_at).toLocaleString()}</p>}
          {r.review_notes && <p>Manager note: {r.review_notes}</p>}
          {r.status === 'pending' && canReview && (
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label="Missing session review note"
                placeholder="Review note (optional)"
                value={notes[r.id] ?? ''}
                disabled={review.isPending}
                onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
              />
              <Button disabled={review.isPending} onClick={() => decide(r.id, 'approved')}>
                Approve and add session
              </Button>
              <Button variant="outline" disabled={review.isPending} onClick={() => decide(r.id, 'denied')}>
                Deny
              </Button>
            </div>
          )}
          {r.status === 'pending' && r.employee_id === currentUserId && (
            <Button variant="outline" disabled={review.isPending} onClick={() => decide(r.id, 'cancelled')}>
              Cancel request
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
