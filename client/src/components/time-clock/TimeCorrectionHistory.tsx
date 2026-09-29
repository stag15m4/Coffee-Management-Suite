import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useReviewTimeClockEdit,
  useCancelTimeClockEdit,
  type TimeClockEditRequest,
} from '@/hooks/use-time-clock-edits';
import { getErrorMessage } from '@/lib/utils';
import { colors } from '@/lib/colors';

const labels = {
  pending: 'Pending manager approval',
  approved: 'Approved — applied to timesheet',
  denied: 'Denied — correction not applied',
  cancelled: 'Cancelled — correction not applied',
};

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

export function TimeCorrectionHistory({
  requests,
  canReview,
  currentUserId,
  disabled = false,
}: {
  requests: TimeClockEditRequest[];
  canReview: boolean;
  currentUserId: string;
  disabled?: boolean;
}) {
  const review = useReviewTimeClockEdit();
  const cancel = useCancelTimeClockEdit();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const busy = disabled || review.isPending || cancel.isPending;

  async function decide(id: string, status: 'approved' | 'denied') {
    try {
      await review.mutateAsync({ id, status, review_notes: notes[id] });
      toast({ title: status === 'approved' ? 'Correction applied to timesheet' : 'Correction denied' });
    } catch (error) {
      toast({ title: 'Review not completed', description: getErrorMessage(error), variant: 'destructive' });
    }
  }

  async function cancelRequest(id: string) {
    try {
      await cancel.mutateAsync(id);
      toast({ title: 'Correction request cancelled' });
    } catch (error) {
      toast({ title: 'Cancellation not completed', description: getErrorMessage(error), variant: 'destructive' });
    }
  }

  if (!requests.length) return null;
  return (
    <section
      aria-label="Time corrections"
      className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: colors.creamDark, backgroundColor: colors.white }}
    >
      <h3 className="font-semibold">Time corrections</h3>
      {requests.map((request) => (
        <div key={request.id} className="rounded-lg p-3 space-y-2 text-sm" style={{ backgroundColor: colors.cream }}>
          <Badge variant="outline">{labels[request.status]}</Badge>
          {request.requested_clock_in && (
            <p>
              Clock in: {timestamp(request.original_clock_in)} →{' '}
              <strong>{timestamp(request.requested_clock_in)}</strong>
            </p>
          )}
          {request.requested_clock_out && (
            <p>
              Clock out: {timestamp(request.original_clock_out)} →{' '}
              <strong>{timestamp(request.requested_clock_out)}</strong>
            </p>
          )}
          <p>Reason: {request.reason}</p>
          <p className="text-xs">Requested {timestamp(request.created_at)}</p>
          {request.reviewed_at && (
            <p className="text-xs">
              Reviewed by {request.reviewer_name || 'manager'} · {timestamp(request.reviewed_at)}
            </p>
          )}
          {request.review_notes && <p>Manager note: {request.review_notes}</p>}
          {request.status === 'pending' && <p className="text-xs">Recorded hours stay unchanged until approval.</p>}
          {request.status === 'pending' && canReview && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Review note"
                placeholder="Review note (optional)"
                value={notes[request.id] ?? ''}
                disabled={busy}
                onChange={(event) => setNotes((prev) => ({ ...prev, [request.id]: event.target.value }))}
              />
              <Button disabled={busy} onClick={() => decide(request.id, 'approved')}>
                Approve correction
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => decide(request.id, 'denied')}>
                Deny correction
              </Button>
            </div>
          )}
          {request.status === 'pending' && request.employee_id === currentUserId && (
            <Button variant="outline" disabled={busy} onClick={() => cancelRequest(request.id)}>
              Cancel request
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
