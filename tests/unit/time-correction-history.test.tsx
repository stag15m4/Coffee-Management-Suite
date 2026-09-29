import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TimeClockEditRequest } from '../../client/src/hooks/use-time-clock-edits';

vi.mock('../../client/src/hooks/use-time-clock-edits', () => ({
  useReviewTimeClockEdit: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCancelTimeClockEdit: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('../../client/src/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { TimeCorrectionHistory } from '../../client/src/components/time-clock/TimeCorrectionHistory';

const request: TimeClockEditRequest = {
  id: 'request',
  tenant_id: 'tenant',
  time_clock_entry_id: 'entry',
  employee_id: 'employee',
  original_clock_in: '2026-09-29T11:00:00Z',
  original_clock_out: '2026-09-29T14:18:00Z',
  requested_clock_in: '2026-09-29T12:00:00Z',
  requested_clock_out: null,
  reason: 'Forgot to record the correct start',
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  review_notes: null,
  created_at: '2026-09-29T15:00:00Z',
  updated_at: '2026-09-29T15:00:00Z',
};

describe('timesheet correction history', () => {
  it('shows staff that a pending correction has not changed recorded hours', () => {
    const html = renderToStaticMarkup(
      <TimeCorrectionHistory requests={[request]} canReview={false} currentUserId="employee" />
    );
    expect(html).toContain('Pending manager approval');
    expect(html).toContain('Recorded hours stay unchanged until approval.');
    expect(html).toContain(request.reason);
    expect(html).toContain('Cancel request');
    expect(html).not.toContain('Approve correction');
  });

  it('gives managers explicit correction review actions on the timesheet', () => {
    const html = renderToStaticMarkup(<TimeCorrectionHistory requests={[request]} canReview currentUserId="manager" />);
    expect(html).toContain('Approve correction');
    expect(html).toContain('Deny correction');
    expect(html).not.toContain('Cancel request');
  });

  it('shows the applied result and reviewer after approval without pending controls', () => {
    const html = renderToStaticMarkup(
      <TimeCorrectionHistory
        requests={[{ ...request, status: 'approved', reviewer_name: 'Seth', reviewed_at: '2026-09-29T15:10:00Z' }]}
        canReview
        currentUserId="manager"
      />
    );
    expect(html).toContain('Approved — applied to timesheet');
    expect(html).toContain('Reviewed by Seth');
    expect(html).not.toContain('Approve correction');
    expect(html).not.toContain('Cancel request');
  });
});
