import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskAttachments } from '@/components/TaskAttachments';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SiGooglecalendar } from 'react-icons/si';
import { colors } from '@/lib/colors';
import {
  Plus,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  CalendarPlus,
  Download,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import type { MaintenanceTask, Equipment } from '@/lib/supabase-queries';
import {
  getTaskStatus,
  getStatusColor,
  getStatusLabel,
  formatDueInfo,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  downloadICalFile,
} from './equipment-utils';

interface MaintenanceDueProps {
  tasks: MaintenanceTask[];
  sortedTasks: MaintenanceTask[];
  equipment: Equipment[];
  overdueCount: number;
  dueSoonCount: number;
  expandedTaskId: string | null;
  setExpandedTaskId: (id: string | null) => void;
  setLightboxUrl: (url: string | null) => void;
  setShowAddTask: (show: boolean) => void;
  setActiveTab: (tab: 'dashboard' | 'equipment') => void;
  setCompletingTask: (task: MaintenanceTask | null) => void;
  setCompletionUsage: (usage: string) => void;
  setEditingTaskLastServiced: (task: MaintenanceTask | null) => void;
  setEditLastServicedDate: (date: string) => void;
  openEditTask: (task: MaintenanceTask) => void;
  handleDeleteTask: (id: string) => Promise<void>;
  profileFullName: string | undefined;
}

export function MaintenanceDue({
  tasks,
  sortedTasks,
  equipment,
  overdueCount,
  dueSoonCount,
  expandedTaskId,
  setExpandedTaskId,
  setLightboxUrl,
  setShowAddTask,
  setActiveTab,
  setCompletingTask,
  setCompletionUsage,
  setEditingTaskLastServiced,
  setEditLastServicedDate,
  openEditTask,
  handleDeleteTask,
  profileFullName,
}: MaintenanceDueProps) {
  if (tasks.length === 0) {
    return (
      <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
        <CardContent className="p-8 text-center">
          <Wrench className="w-12 h-12 mx-auto mb-4" style={{ color: colors.brownLight }} />
          <h3 className="font-semibold mb-2" style={{ color: colors.brown }}>No Maintenance Tasks</h3>
          <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
            Add equipment and maintenance tasks to start tracking.
          </p>
          <Button
            onClick={() => setActiveTab('equipment')}
            style={{ backgroundColor: colors.gold, color: colors.white }}
            data-testid="button-get-started"
          >
            Get Started
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Card style={{ backgroundColor: colors.white, borderColor: colors.red, borderWidth: 2 }}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: colors.red }} />
            <div className="text-2xl font-bold" style={{ color: colors.red }}>{overdueCount}</div>
            <div className="text-sm" style={{ color: colors.brownLight }}>Overdue</div>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white, borderColor: colors.yellow, borderWidth: 2 }}>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: colors.yellow }} />
            <div className="text-2xl font-bold" style={{ color: colors.yellow }}>{dueSoonCount}</div>
            <div className="text-sm" style={{ color: colors.brownLight }}>Due Soon</div>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white, borderColor: colors.green, borderWidth: 2 }}>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: colors.green }} />
            <div className="text-2xl font-bold" style={{ color: colors.green }}>
              {tasks.filter(t => getTaskStatus(t) === 'good').length}
            </div>
            <div className="text-sm" style={{ color: colors.brownLight }}>Good</div>
          </CardContent>
        </Card>
      </div>

      <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle style={{ color: colors.brown }}>Maintenance Tasks</CardTitle>
            <Button
              size="sm"
              onClick={() => setShowAddTask(true)}
              disabled={equipment.length === 0}
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-add-task"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y" style={{ borderColor: colors.creamDark }}>
            {sortedTasks.map(task => {
              const status = getTaskStatus(task);
              const statusColor = getStatusColor(status);
              const isExpanded = expandedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  data-testid={`task-row-${task.id}`}
                >
                  {/* Compact row -- always visible */}
                  <div
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FDF8E8] transition-colors"
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: statusColor }}
                      />
                      {(task.image_url || task.equipment?.photo_url) && (
                        <div
                          className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                          style={{ border: `2px solid ${colors.creamDark}` }}
                        >
                          <img src={(task.image_url || task.equipment?.photo_url)!} alt={task.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate" style={{ color: colors.brown }}>
                          {task.name}
                        </div>
                        <div className="text-sm truncate" style={{ color: colors.brownLight }}>
                          {task.equipment?.name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <Badge
                          style={{
                            backgroundColor: statusColor,
                            color: status === 'due-soon' ? colors.brown : 'white'
                          }}
                        >
                          {getStatusLabel(status)}
                        </Badge>
                        <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
                          {formatDueInfo(task)}
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        style={{ color: colors.brownLight }}
                      />
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: colors.creamDark, backgroundColor: colors.cream }}>
                      <div className="pt-3 space-y-3">
                        {(task.image_url || task.equipment?.photo_url) && (
                          <div
                            className="w-64 h-64 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ border: `2px solid ${colors.creamDark}` }}
                            onClick={(e) => { e.stopPropagation(); setLightboxUrl((task.image_url || task.equipment?.photo_url)!); }}
                          >
                            <img src={(task.image_url || task.equipment?.photo_url)!} alt={task.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {task.description && (
                          <p className="text-sm" style={{ color: colors.brownLight }}>{task.description}</p>
                        )}
                        {task.estimated_cost != null && Number(task.estimated_cost) > 0 && (
                          <div className="text-sm" style={{ color: colors.brown }}>
                            Estimated cost: <span className="font-semibold">${Number(task.estimated_cost).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: colors.brownLight }}>
                          {task.interval_type === 'time' ? (
                            <>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Every {task.interval_days} days
                              </span>
                              <span>{formatDueInfo(task)}</span>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1">
                                <RotateCcw className="w-3 h-3" />
                                Every {task.interval_units} {task.usage_unit_label}
                              </span>
                              <span>Current: {task.current_usage || 0} {task.usage_unit_label}</span>
                              <span>{formatDueInfo(task)}</span>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTaskLastServiced(task);
                              setEditLastServicedDate(task.last_completed_at
                                ? new Date(task.last_completed_at).toISOString().split('T')[0]
                                : '');
                            }}
                            className="flex items-center gap-1 hover:underline cursor-pointer"
                            style={{ color: colors.gold }}
                            data-testid={`button-edit-last-serviced-${task.id}`}
                          >
                            <Calendar className="w-3 h-3" />
                            {task.last_completed_at
                              ? `Last: ${new Date(task.last_completed_at).toLocaleDateString()}`
                              : 'Set Last Serviced'}
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                        {/* Task attachments & video tutorials */}
                        <TaskAttachments taskId={task.id} tenantId={task.tenant_id} userName={profileFullName} />

                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompletingTask(task);
                              setCompletionUsage(task.current_usage?.toString() || '0');
                            }}
                            style={{ backgroundColor: colors.gold, color: colors.white }}
                            data-testid={`button-log-maintenance-${task.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Log
                          </Button>
                          {task.next_due_at && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ borderColor: colors.creamDark, color: colors.brown }}
                                  data-testid={`button-add-to-calendar-${task.id}`}
                                >
                                  <CalendarPlus className="w-4 h-4 mr-1" />
                                  Calendar
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => window.open(generateGoogleCalendarUrl(task, task.equipment?.name || ''), '_blank')}
                                >
                                  <SiGooglecalendar className="w-4 h-4 mr-2" />
                                  Add to Google Calendar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => window.open(generateOutlookCalendarUrl(task, task.equipment?.name || ''), '_blank')}
                                >
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Add to Outlook Calendar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => downloadICalFile(task, task.equipment?.name || '')}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download for Apple/Other
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTask(task);
                            }}
                            style={{ borderColor: colors.creamDark, color: colors.brown }}
                            data-testid={`button-edit-task-${task.id}`}
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            style={{ borderColor: colors.creamDark, color: colors.red }}
                            data-testid={`button-delete-task-${task.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
