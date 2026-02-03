import { ListTodo, Circle, Clock } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'wouter';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  white: '#FFFDF7',
  red: '#ef4444',
  orange: '#f97316',
  blue: '#3b82f6',
};

interface Task {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  category_name: string | null;
  category_color: string | null;
}

export function ActiveTasksWidget() {
  const { tenant, profile } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-tasks', tenant?.id, profile?.id],
    queryFn: async () => {
      if (!tenant?.id || !profile?.id) return null;

      // Get tasks assigned to current user that are pending or in_progress
      const { data: tasks, error: tasksError } = await supabase
        .from('admin_tasks')
        .select(`
          id,
          title,
          priority,
          due_date,
          category:admin_task_categories(name, color)
        `)
        .eq('tenant_id', tenant.id)
        .eq('assigned_to', profile.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5);

      if (tasksError) throw tasksError;

      const formattedTasks: Task[] = (tasks || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
        category_name: task.category?.name || null,
        category_color: task.category?.color || null,
      }));

      return {
        tasks: formattedTasks,
        total: formattedTasks.length,
      };
    },
    enabled: !!tenant?.id && !!profile?.id,
    staleTime: 60000, // 1 minute
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return colors.red;
      case 'medium':
        return colors.orange;
      default:
        return colors.blue;
    }
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;

    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', isOverdue: false };
    } else if (diffDays <= 7) {
      return { text: `${diffDays}d`, isOverdue: false };
    } else {
      return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false };
    }
  };

  return (
    <DashboardWidget
      title="Your Active Tasks"
      icon={ListTodo}
      loading={isLoading}
      error={error ? 'Failed to load tasks' : undefined}
    >
      {data && (
        <>
          {data.tasks.length === 0 ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: colors.brownLight }}>
              <Circle className="w-4 h-4" style={{ color: colors.gold }} />
              <span>No active tasks assigned to you</span>
            </div>
          ) : (
            <div className="space-y-2">
              {data.tasks.map((task) => {
                const dueInfo = task.due_date ? formatDueDate(task.due_date) : null;
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    <Circle
                      className="w-3 h-3 mt-1 flex-shrink-0"
                      style={{ color: getPriorityColor(task.priority) }}
                      fill={getPriorityColor(task.priority)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: colors.brown }}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.category_name && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: task.category_color || colors.gold,
                              color: colors.white,
                            }}
                          >
                            {task.category_name}
                          </span>
                        )}
                        {dueInfo && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" style={{ color: dueInfo.isOverdue ? colors.red : colors.brownLight }} />
                            <span
                              className="text-xs"
                              style={{ color: dueInfo.isOverdue ? colors.red : colors.brownLight }}
                            >
                              {dueInfo.text}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <Link href="/admin-tasks">
                <button
                  className="w-full text-sm font-medium mt-2 py-1 rounded hover:opacity-80 transition-opacity"
                  style={{ color: colors.gold }}
                >
                  View all tasks →
                </button>
              </Link>
            </div>
          )}
        </>
      )}
    </DashboardWidget>
  );
}
