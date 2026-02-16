import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useMyTimeClockEdits,
  useTimeClockEdits,
  useReviewTimeClockEdit,
  useCancelTimeClockEdit,
} from '@/hooks/use-time-clock-edits';
import { Edit2, Users, Check, X } from 'lucide-react';
import { colors } from '@/lib/colors';

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function statusColor(s: string) {
  switch (s) {
    case 'approved': return colors.green;
    case 'denied': return colors.red;
    case 'pending': return colors.yellow;
    case 'cancelled': return colors.brownLight;
    default: return colors.brown;
  }
}

interface EditRequestsListProps {
  canApprove: boolean;
  currentUserId: string;
}

export function EditRequestsList({ canApprove, currentUserId }: EditRequestsListProps) {
  const { toast } = useToast();
  const { data: myEdits } = useMyTimeClockEdits();
  const { data: allEdits } = useTimeClockEdits();
  const reviewEdit = useReviewTimeClockEdit();
  const cancelEdit = useCancelTimeClockEdit();
  const [reviewNotes, setReviewNotes] = useState('');

  const pendingTeamEdits = useMemo(() => {
    if (!allEdits || !canApprove) return [];
    return allEdits.filter((r) => {
      if (r.status !== 'pending') return false;
      if (r.employee_manager_id === currentUserId) return true;
      if (!r.employee_manager_id) return true;
      return false;
    });
  }, [allEdits, canApprove, currentUserId]);

  const handleReview = useCallback(async (id: string, status: 'approved' | 'denied') => {
    try {
      await reviewEdit.mutateAsync({ id, status, review_notes: reviewNotes || undefined });
      toast({ title: `Edit request ${status}` });
      setReviewNotes('');
    } catch {
      toast({ title: 'Error', description: 'Failed to review edit request.', variant: 'destructive' });
    }
  }, [reviewEdit, reviewNotes, toast]);

  const hasMyEdits = myEdits && myEdits.length > 0;
  const hasPendingEdits = canApprove;

  if (!hasMyEdits && !hasPendingEdits) return null;

  return (
    <>
      {/* My Edit Requests */}
      {hasMyEdits && (
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
              <Edit2 className="w-5 h-5" style={{ color: colors.gold }} />
              My Edit Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myEdits.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: colors.cream }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" style={{ borderColor: statusColor(r.status), color: statusColor(r.status) }}>
                      {r.status}
                    </Badge>
                    <span className="text-xs" style={{ color: colors.brownLight }}>
                      {new Date(r.original_clock_in).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-xs mt-1 space-y-0.5" style={{ color: colors.brown }}>
                    {r.requested_clock_in && (
                      <p>Clock in: {formatTimestamp(r.original_clock_in)} → <span className="font-medium">{formatTimestamp(r.requested_clock_in)}</span></p>
                    )}
                    {r.requested_clock_out && (
                      <p>Clock out: {r.original_clock_out ? formatTimestamp(r.original_clock_out) : 'Missing'} → <span className="font-medium">{formatTimestamp(r.requested_clock_out)}</span></p>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>{r.reason}</p>
                  {r.review_notes && (
                    <p className="text-xs mt-0.5 italic" style={{ color: colors.brownLight }}>
                      Note: {r.review_notes}
                    </p>
                  )}
                </div>
                {r.status === 'pending' && (
                  <Button variant="ghost" size="sm" onClick={() => cancelEdit.mutate(r.id)}
                    style={{ color: colors.red }}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Edit Requests (approvers) */}
      {canApprove && (
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <Users className="w-5 h-5" style={{ color: colors.gold }} />
              Pending Edit Requests
              {pendingTeamEdits.length > 0 && (
                <Badge style={{ backgroundColor: colors.yellow, color: colors.brown }}>
                  {pendingTeamEdits.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTeamEdits.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: colors.brownLight }}>
                No pending edit requests.
              </p>
            ) : (
              pendingTeamEdits.map((r) => (
                <div key={r.id} className="p-3 rounded-lg space-y-2" style={{ backgroundColor: colors.cream }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.brown }}>
                      {r.employee_name || 'Unknown'}
                    </p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>
                      {new Date(r.original_clock_in).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="text-xs mt-1 space-y-0.5" style={{ color: colors.brown }}>
                      {r.requested_clock_in && (
                        <p>Clock in: {formatTimestamp(r.original_clock_in)} → <span className="font-medium">{formatTimestamp(r.requested_clock_in)}</span></p>
                      )}
                      {r.requested_clock_out && (
                        <p>Clock out: {r.original_clock_out ? formatTimestamp(r.original_clock_out) : 'Missing'} → <span className="font-medium">{formatTimestamp(r.requested_clock_out)}</span></p>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: colors.brownLight }}>Reason: {r.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Review notes (optional)"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="text-xs h-8 flex-1"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    />
                    <Button size="sm" onClick={() => handleReview(r.id, 'approved')}
                      disabled={reviewEdit.isPending}
                      style={{ backgroundColor: colors.green, color: '#fff' }}>
                      <Check className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReview(r.id, 'denied')}
                      disabled={reviewEdit.isPending}
                      style={{ borderColor: colors.red, color: colors.red }}>
                      <X className="w-3 h-3 mr-1" /> Deny
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
