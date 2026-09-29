import type { TimeClockEntry } from '@/hooks/use-time-clock';
import { useToast } from '@/hooks/use-toast';
import { WorkSessionEditor } from './WorkSessionEditor';

export function ManagerClockOutDialog({
  entry,
  employeeName,
  onClose,
}: {
  entry: TimeClockEntry;
  employeeName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  return (
    <WorkSessionEditor
      entry={entry}
      employeeId={entry.employee_id}
      day={new Date(entry.clock_in).toLocaleDateString('sv-SE')}
      onClose={onClose}
      onSaved={(message) => toast({ title: employeeName, description: message })}
    />
  );
}
