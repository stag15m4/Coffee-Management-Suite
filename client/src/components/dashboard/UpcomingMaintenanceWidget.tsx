import { Wrench, AlertCircle, CheckCircle } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';
import { MOCK_MAINTENANCE_TASKS, useMockData } from './MockDataProvider';
import { colors } from '@/lib/colors';

interface MaintenanceTask {
  id: string;
  equipment_name: string;
  task_type: string;
  due_date: string;
  is_overdue: boolean;
}

export function UpcomingMaintenanceWidget() {
  const { tenant } = useAuth();
  const { isMockMode } = useMockData();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-maintenance', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      // Use mock data in dev mode
      if (isMockMode) {
        return MOCK_MAINTENANCE_TASKS;
      }

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      // Get upcoming maintenance tasks (next 7 days)
      const { data: tasks, error: tasksError } = await supabase
        .from('maintenance_tasks')
        .select(`
          id,
          task_type,
          next_due_date,
          equipment:equipment!inner(id, name)
        `)
        .eq('equipment.tenant_id', tenant.id)
        .eq('is_active', true)
        .lte('next_due_date', sevenDaysFromNow)
        .order('next_due_date', { ascending: true })
        .limit(5);

      if (tasksError) throw tasksError;

      const formattedTasks: MaintenanceTask[] = (tasks || []).map((task: any) => ({
        id: task.id,
        equipment_name: task.equipment.name,
        task_type: task.task_type,
        due_date: task.next_due_date,
        is_overdue: task.next_due_date < today,
      }));

      return {
        tasks: formattedTasks,
        overdueCount: formattedTasks.filter(t => t.is_overdue).length,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60000, // 1 minute
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  return (
    <DashboardWidget
      title="Upcoming Maintenance"
      icon={Wrench}
      loading={isLoading}
      error={error ? 'Failed to load maintenance data' : undefined}
    >
      {data && (
        <>
          {data.tasks.length === 0 ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: colors.brownLight }}>
              <CheckCircle className="w-4 h-4" style={{ color: colors.gold }} />
              <span>No maintenance due in the next 7 days</span>
            </div>
          ) : (
            <div className="space-y-2">
              {data.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2 p-2 rounded"
                  style={{ backgroundColor: task.is_overdue ? '#fef2f2' : colors.white }}
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: task.is_overdue ? colors.red : colors.orange }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: colors.brown }}>
                      {task.equipment_name}
                    </p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>
                      {task.task_type}
                    </p>
                    <p
                      className="text-xs font-medium mt-0.5"
                      style={{ color: task.is_overdue ? colors.red : colors.brownLight }}
                    >
                      {formatDate(task.due_date)}
                    </p>
                  </div>
                </div>
              ))}
              <Link href="/equipment-maintenance">
                <button
                  className="w-full text-sm font-medium mt-2 py-1 rounded hover:opacity-80 transition-opacity"
                  style={{ color: colors.gold }}
                >
                  View all maintenance →
                </button>
              </Link>
            </div>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
