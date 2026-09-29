import { useState } from 'react';
import { useSessionAudit } from '@/hooks/use-work-sessions';
import { Button } from '@/components/ui/button';

function describe(value: Record<string, unknown> | null) {
  if (!value) return 'No record';
  const start = value.clock_in ?? value.break_start;
  const end = value.clock_out ?? value.break_end;
  return `${typeof start === 'string' ? new Date(start).toLocaleString() : 'Not recorded'} → ${typeof end === 'string' ? new Date(end).toLocaleString() : 'Open'}`;
}

export function SessionHistoryPanel({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading, isError } = useSessionAudit(employeeId, open);
  return (
    <section className="rounded-lg border bg-white p-4 space-y-3">
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'} change history
      </Button>
      {open && (
        <>
          <p className="text-xs">
            Latest 100 recorded changes for this employee, across all pay periods. History starts when audit tracking
            was installed.
          </p>
          {isLoading && <p role="status">Loading history…</p>}
          {isError && <p role="alert">History could not load. Refresh and try again.</p>}
          {!isLoading && !isError && !data.length && <p>No recorded changes yet.</p>}
          {data.map((event) => (
            <div key={event.id} className="border-t pt-3 text-sm space-y-1">
              <p className="font-semibold">
                {event.entity_type === 'break' ? 'Break' : 'Session'}{' '}
                {event.action === 'insert' ? 'added' : event.action === 'delete' ? 'deleted' : 'changed'}
              </p>
              <p>
                {event.actor_name || (event.actor_id ? 'Signed-in user' : 'System, integration, or kiosk')} ·{' '}
                {new Date(event.created_at).toLocaleString()}
              </p>
              <p>Before: {describe(event.old_value)}</p>
              <p>After: {describe(event.new_value)}</p>
              <p>Reason: {event.reason || 'No reason recorded by this action'}</p>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
