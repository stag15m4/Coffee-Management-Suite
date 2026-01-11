import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useEquipment, 
  useMaintenanceTasks, 
  useAddEquipment, 
  useUpdateEquipment,
  useDeleteEquipment,
  useAddMaintenanceTask,
  useUpdateMaintenanceTask,
  useDeleteMaintenanceTask,
  useLogMaintenance,
  useUpdateUsage,
  type Equipment,
  type MaintenanceTask
} from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Plus, 
  Settings, 
  Wrench, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw
} from 'lucide-react';
import { Link } from 'wouter';
import logoUrl from '@assets/Erwin-Mills-Logo_1767709452739.png';

const colors = {
  gold: '#C9A227',
  goldLight: '#D4B23A',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  inputBg: '#FDF8E8',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

type TaskStatus = 'overdue' | 'due-soon' | 'good';

function getTaskStatus(task: MaintenanceTask): TaskStatus {
  if (task.interval_type === 'time') {
    if (!task.next_due_at) return 'good';
    const now = new Date();
    const dueDate = new Date(task.next_due_at);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'due-soon';
    return 'good';
  } else {
    if (!task.interval_units) return 'good';
    const remaining = task.interval_units - (task.current_usage || 0);
    const percentUsed = (task.current_usage || 0) / task.interval_units;
    
    if (remaining <= 0) return 'overdue';
    if (percentUsed >= 0.9) return 'due-soon';
    return 'good';
  }
}

function getStatusColor(status: TaskStatus) {
  switch (status) {
    case 'overdue': return colors.red;
    case 'due-soon': return colors.yellow;
    case 'good': return colors.green;
  }
}

function getStatusLabel(status: TaskStatus) {
  switch (status) {
    case 'overdue': return 'Overdue';
    case 'due-soon': return 'Due Soon';
    case 'good': return 'Good';
  }
}

function formatDueInfo(task: MaintenanceTask): string {
  if (task.interval_type === 'time') {
    if (!task.next_due_at) return 'Not scheduled';
    const dueDate = new Date(task.next_due_at);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue} days`;
  } else {
    if (!task.interval_units) return 'No interval set';
    const remaining = task.interval_units - (task.current_usage || 0);
    if (remaining <= 0) return `${Math.abs(remaining)} ${task.usage_unit_label || 'units'} overdue`;
    return `${remaining} ${task.usage_unit_label || 'units'} remaining`;
  }
}

export default function EquipmentMaintenance() {
  const { profile, tenant } = useAuth();
  const { toast } = useToast();
  
  const { data: equipment = [], isLoading: loadingEquipment } = useEquipment();
  const { data: tasks = [], isLoading: loadingTasks } = useMaintenanceTasks();
  
  const addEquipmentMutation = useAddEquipment();
  const updateEquipmentMutation = useUpdateEquipment();
  const deleteEquipmentMutation = useDeleteEquipment();
  const addTaskMutation = useAddMaintenanceTask();
  const updateTaskMutation = useUpdateMaintenanceTask();
  const deleteTaskMutation = useDeleteMaintenanceTask();
  const logMaintenanceMutation = useLogMaintenance();
  const updateUsageMutation = useUpdateUsage();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'equipment' | 'tasks'>('dashboard');
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [completingTask, setCompletingTask] = useState<MaintenanceTask | null>(null);
  
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentCategory, setNewEquipmentCategory] = useState('');
  const [newEquipmentNotes, setNewEquipmentNotes] = useState('');
  
  const [newTaskEquipmentId, setNewTaskEquipmentId] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskIntervalType, setNewTaskIntervalType] = useState<'time' | 'usage'>('time');
  const [newTaskIntervalDays, setNewTaskIntervalDays] = useState('');
  const [newTaskIntervalUnits, setNewTaskIntervalUnits] = useState('');
  const [newTaskUsageLabel, setNewTaskUsageLabel] = useState('');
  
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionUsage, setCompletionUsage] = useState('');
  
  const overdueCount = tasks.filter(t => getTaskStatus(t) === 'overdue').length;
  const dueSoonCount = tasks.filter(t => getTaskStatus(t) === 'due-soon').length;
  
  const handleAddEquipment = async () => {
    if (!newEquipmentName.trim()) {
      toast({ title: 'Please enter equipment name', variant: 'destructive' });
      return;
    }
    
    if (!tenant?.id) {
      toast({ title: 'No tenant context', variant: 'destructive' });
      return;
    }
    
    try {
      await addEquipmentMutation.mutateAsync({
        tenant_id: tenant.id,
        name: newEquipmentName.trim(),
        category: newEquipmentCategory.trim() || undefined,
        notes: newEquipmentNotes.trim() || undefined,
      });
      
      setNewEquipmentName('');
      setNewEquipmentCategory('');
      setNewEquipmentNotes('');
      setShowAddEquipment(false);
      toast({ title: 'Equipment added successfully' });
    } catch (error: any) {
      toast({ title: 'Error adding equipment', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleUpdateEquipment = async () => {
    if (!editingEquipment) return;
    
    try {
      await updateEquipmentMutation.mutateAsync({
        id: editingEquipment.id,
        updates: {
          name: editingEquipment.name,
          category: editingEquipment.category,
          notes: editingEquipment.notes,
        }
      });
      
      setEditingEquipment(null);
      toast({ title: 'Equipment updated successfully' });
    } catch (error: any) {
      toast({ title: 'Error updating equipment', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('Are you sure you want to remove this equipment? All related maintenance tasks will also be removed.')) return;
    
    try {
      await deleteEquipmentMutation.mutateAsync(id);
      toast({ title: 'Equipment removed successfully' });
    } catch (error: any) {
      toast({ title: 'Error removing equipment', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleAddTask = async () => {
    if (!newTaskEquipmentId || !newTaskName.trim()) {
      toast({ title: 'Please select equipment and enter task name', variant: 'destructive' });
      return;
    }
    
    if (newTaskIntervalType === 'time' && !newTaskIntervalDays) {
      toast({ title: 'Please enter interval in days', variant: 'destructive' });
      return;
    }
    
    if (newTaskIntervalType === 'usage' && (!newTaskIntervalUnits || !newTaskUsageLabel)) {
      toast({ title: 'Please enter usage interval and unit label', variant: 'destructive' });
      return;
    }
    
    if (!tenant?.id) {
      toast({ title: 'No tenant context', variant: 'destructive' });
      return;
    }
    
    try {
      await addTaskMutation.mutateAsync({
        tenant_id: tenant.id,
        equipment_id: newTaskEquipmentId,
        name: newTaskName.trim(),
        description: newTaskDescription.trim() || undefined,
        interval_type: newTaskIntervalType,
        interval_days: newTaskIntervalType === 'time' ? parseInt(newTaskIntervalDays) : undefined,
        interval_units: newTaskIntervalType === 'usage' ? parseInt(newTaskIntervalUnits) : undefined,
        usage_unit_label: newTaskIntervalType === 'usage' ? newTaskUsageLabel.trim() : undefined,
        current_usage: 0,
      });
      
      setNewTaskEquipmentId('');
      setNewTaskName('');
      setNewTaskDescription('');
      setNewTaskIntervalType('time');
      setNewTaskIntervalDays('');
      setNewTaskIntervalUnits('');
      setNewTaskUsageLabel('');
      setShowAddTask(false);
      toast({ title: 'Maintenance task added successfully' });
    } catch (error: any) {
      toast({ title: 'Error adding task', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleCompleteTask = async () => {
    if (!completingTask) return;
    
    if (!tenant?.id) {
      toast({ title: 'No tenant context', variant: 'destructive' });
      return;
    }
    
    try {
      await logMaintenanceMutation.mutateAsync({
        tenantId: tenant.id,
        taskId: completingTask.id,
        completedBy: profile?.full_name || profile?.email,
        notes: completionNotes.trim() || undefined,
        usageAtCompletion: completingTask.interval_type === 'usage' && completionUsage 
          ? parseInt(completionUsage) 
          : undefined,
      });
      
      setCompletingTask(null);
      setCompletionNotes('');
      setCompletionUsage('');
      toast({ title: 'Maintenance logged successfully' });
    } catch (error: any) {
      toast({ title: 'Error logging maintenance', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to remove this maintenance task?')) return;
    
    try {
      await deleteTaskMutation.mutateAsync(id);
      toast({ title: 'Task removed successfully' });
    } catch (error: any) {
      toast({ title: 'Error removing task', description: error.message, variant: 'destructive' });
    }
  };
  
  const categories = Array.from(new Set(equipment.map(e => e.category).filter(Boolean))) as string[];
  
  const isLoading = loadingEquipment || loadingTasks;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header 
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/" data-testid="link-back-dashboard">
              <Button variant="ghost" size="icon" style={{ color: colors.brown }}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <img src={logoUrl} alt="Erwin Mills" className="h-10 w-auto" />
            <div>
              <h1 className="font-bold text-lg" style={{ color: colors.brown }}>Equipment Maintenance</h1>
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Track and manage equipment maintenance
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge 
                style={{ backgroundColor: colors.red, color: 'white' }}
                data-testid="badge-overdue-count"
              >
                {overdueCount} Overdue
              </Badge>
            )}
            {dueSoonCount > 0 && (
              <Badge 
                style={{ backgroundColor: colors.yellow, color: colors.brown }}
                data-testid="badge-due-soon-count"
              >
                {dueSoonCount} Due Soon
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setActiveTab('dashboard')}
            style={activeTab === 'dashboard' ? { backgroundColor: colors.gold, color: colors.brown } : { borderColor: colors.gold, color: colors.brown }}
            data-testid="tab-dashboard"
          >
            <Wrench className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'equipment' ? 'default' : 'outline'}
            onClick={() => setActiveTab('equipment')}
            style={activeTab === 'equipment' ? { backgroundColor: colors.gold, color: colors.brown } : { borderColor: colors.gold, color: colors.brown }}
            data-testid="tab-equipment"
          >
            <Settings className="w-4 h-4 mr-2" />
            Equipment
          </Button>
          <Button
            variant={activeTab === 'tasks' ? 'default' : 'outline'}
            onClick={() => setActiveTab('tasks')}
            style={activeTab === 'tasks' ? { backgroundColor: colors.gold, color: colors.brown } : { borderColor: colors.gold, color: colors.brown }}
            data-testid="tab-tasks"
          >
            <Clock className="w-4 h-4 mr-2" />
            Tasks
          </Button>
        </div>

        {isLoading ? (
          <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
            <CardContent className="p-8 text-center">
              <p style={{ color: colors.brownLight }}>Loading...</p>
            </CardContent>
          </Card>
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
                <CardContent className="p-8 text-center">
                  <Wrench className="w-12 h-12 mx-auto mb-4" style={{ color: colors.brownLight }} />
                  <h3 className="font-semibold mb-2" style={{ color: colors.brown }}>No Maintenance Tasks</h3>
                  <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
                    Add equipment and maintenance tasks to start tracking.
                  </p>
                  <Button
                    onClick={() => setActiveTab('equipment')}
                    style={{ backgroundColor: colors.gold, color: colors.brown }}
                    data-testid="button-get-started"
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            ) : (
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
                    <CardTitle style={{ color: colors.brown }}>Maintenance Tasks</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y" style={{ borderColor: colors.creamDark }}>
                      {tasks.map(task => {
                        const status = getTaskStatus(task);
                        const statusColor = getStatusColor(status);
                        
                        return (
                          <div 
                            key={task.id} 
                            className="p-4 flex items-center justify-between gap-4"
                            data-testid={`task-row-${task.id}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: statusColor }}
                              />
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
                              
                              <Button
                                size="sm"
                                onClick={() => {
                                  setCompletingTask(task);
                                  setCompletionUsage(task.current_usage?.toString() || '0');
                                }}
                                style={{ backgroundColor: colors.gold, color: colors.brown }}
                                data-testid={`button-complete-${task.id}`}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Done
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        ) : activeTab === 'equipment' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold" style={{ color: colors.brown }}>Equipment List</h2>
              <Button
                onClick={() => setShowAddEquipment(true)}
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-add-equipment"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Equipment
              </Button>
            </div>

            {showAddEquipment && (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg" style={{ color: colors.brown }}>Add Equipment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label style={{ color: colors.brown }}>Name *</Label>
                    <Input
                      value={newEquipmentName}
                      onChange={e => setNewEquipmentName(e.target.value)}
                      placeholder="e.g., Grinder 1, La Marzocco"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-equipment-name"
                    />
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Category</Label>
                    <Input
                      value={newEquipmentCategory}
                      onChange={e => setNewEquipmentCategory(e.target.value)}
                      placeholder="e.g., Grinders, Espresso Machines"
                      list="categories"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-equipment-category"
                    />
                    <datalist id="categories">
                      {categories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Notes</Label>
                    <Textarea
                      value={newEquipmentNotes}
                      onChange={e => setNewEquipmentNotes(e.target.value)}
                      placeholder="Serial number, location, etc."
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-equipment-notes"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddEquipment}
                      disabled={addEquipmentMutation.isPending}
                      style={{ backgroundColor: colors.gold, color: colors.brown }}
                      data-testid="button-save-equipment"
                    >
                      {addEquipmentMutation.isPending ? 'Saving...' : 'Save Equipment'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddEquipment(false);
                        setNewEquipmentName('');
                        setNewEquipmentCategory('');
                        setNewEquipmentNotes('');
                      }}
                      style={{ borderColor: colors.creamDark, color: colors.brown }}
                      data-testid="button-cancel-equipment"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {equipment.length === 0 ? (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
                <CardContent className="p-8 text-center">
                  <Settings className="w-12 h-12 mx-auto mb-4" style={{ color: colors.brownLight }} />
                  <h3 className="font-semibold mb-2" style={{ color: colors.brown }}>No Equipment Yet</h3>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Add your equipment to start tracking maintenance.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {equipment.map(item => (
                  <Card 
                    key={item.id} 
                    style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                    data-testid={`equipment-card-${item.id}`}
                  >
                    <CardContent className="p-4">
                      {editingEquipment?.id === item.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editingEquipment.name}
                            onChange={e => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-name"
                          />
                          <Input
                            value={editingEquipment.category || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, category: e.target.value })}
                            placeholder="Category"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-category"
                          />
                          <Textarea
                            value={editingEquipment.notes || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, notes: e.target.value })}
                            placeholder="Notes"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-notes"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleUpdateEquipment}
                              disabled={updateEquipmentMutation.isPending}
                              style={{ backgroundColor: colors.gold, color: colors.brown }}
                              data-testid="button-save-edit-equipment"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingEquipment(null)}
                              style={{ borderColor: colors.creamDark, color: colors.brown }}
                              data-testid="button-cancel-edit-equipment"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium" style={{ color: colors.brown }}>{item.name}</div>
                            {item.category && (
                              <Badge variant="outline" className="mt-1" style={{ borderColor: colors.gold, color: colors.brownLight }}>
                                {item.category}
                              </Badge>
                            )}
                            {item.notes && (
                              <p className="text-sm mt-2" style={{ color: colors.brownLight }}>{item.notes}</p>
                            )}
                            <p className="text-xs mt-2" style={{ color: colors.brownLight }}>
                              {tasks.filter(t => t.equipment_id === item.id).length} maintenance tasks
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingEquipment(item)}
                              style={{ color: colors.brown }}
                              data-testid={`button-edit-equipment-${item.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteEquipment(item.id)}
                              style={{ color: colors.red }}
                              data-testid={`button-delete-equipment-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold" style={{ color: colors.brown }}>Maintenance Tasks</h2>
              <Button
                onClick={() => setShowAddTask(true)}
                disabled={equipment.length === 0}
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-add-task"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>

            {equipment.length === 0 && (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
                <CardContent className="p-4 text-center">
                  <p style={{ color: colors.brownLight }}>
                    Add equipment first before creating maintenance tasks.
                  </p>
                </CardContent>
              </Card>
            )}

            {showAddTask && (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg" style={{ color: colors.brown }}>Add Maintenance Task</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label style={{ color: colors.brown }}>Equipment *</Label>
                    <Select value={newTaskEquipmentId} onValueChange={setNewTaskEquipmentId}>
                      <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} data-testid="select-task-equipment">
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipment.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Task Name *</Label>
                    <Input
                      value={newTaskName}
                      onChange={e => setNewTaskName(e.target.value)}
                      placeholder="e.g., Change burrs, Clean ice bin"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-task-name"
                    />
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Description</Label>
                    <Textarea
                      value={newTaskDescription}
                      onChange={e => setNewTaskDescription(e.target.value)}
                      placeholder="Optional details about this task"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-task-description"
                    />
                  </div>
                  <div>
                    <Label style={{ color: colors.brown }}>Interval Type *</Label>
                    <Select value={newTaskIntervalType} onValueChange={(v: 'time' | 'usage') => setNewTaskIntervalType(v)}>
                      <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} data-testid="select-interval-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time">Time-Based (every X days)</SelectItem>
                        <SelectItem value="usage">Usage-Based (every X units)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {newTaskIntervalType === 'time' ? (
                    <div>
                      <Label style={{ color: colors.brown }}>Interval (days) *</Label>
                      <Input
                        type="number"
                        value={newTaskIntervalDays}
                        onChange={e => setNewTaskIntervalDays(e.target.value)}
                        placeholder="e.g., 180 for 6 months"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                        data-testid="input-interval-days"
                      />
                      <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                        Common: 14 days (2 weeks), 30 days (1 month), 90 days (3 months), 180 days (6 months), 365 days (1 year)
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label style={{ color: colors.brown }}>Usage Unit Label *</Label>
                        <Input
                          value={newTaskUsageLabel}
                          onChange={e => setNewTaskUsageLabel(e.target.value)}
                          placeholder="e.g., lbs, shots, cycles"
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="input-usage-label"
                        />
                      </div>
                      <div>
                        <Label style={{ color: colors.brown }}>Interval (units) *</Label>
                        <Input
                          type="number"
                          value={newTaskIntervalUnits}
                          onChange={e => setNewTaskIntervalUnits(e.target.value)}
                          placeholder="e.g., 1000"
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="input-interval-units"
                        />
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddTask}
                      disabled={addTaskMutation.isPending}
                      style={{ backgroundColor: colors.gold, color: colors.brown }}
                      data-testid="button-save-task"
                    >
                      {addTaskMutation.isPending ? 'Saving...' : 'Save Task'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddTask(false);
                        setNewTaskEquipmentId('');
                        setNewTaskName('');
                        setNewTaskDescription('');
                        setNewTaskIntervalType('time');
                        setNewTaskIntervalDays('');
                        setNewTaskIntervalUnits('');
                        setNewTaskUsageLabel('');
                      }}
                      style={{ borderColor: colors.creamDark, color: colors.brown }}
                      data-testid="button-cancel-task"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {tasks.length === 0 && equipment.length > 0 ? (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
                <CardContent className="p-8 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4" style={{ color: colors.brownLight }} />
                  <h3 className="font-semibold mb-2" style={{ color: colors.brown }}>No Maintenance Tasks</h3>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Create maintenance tasks to track equipment upkeep.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {tasks.map(task => {
                  const status = getTaskStatus(task);
                  const statusColor = getStatusColor(status);
                  
                  return (
                    <Card 
                      key={task.id} 
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderLeftWidth: 4, borderLeftColor: statusColor }}
                      data-testid={`task-card-${task.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" style={{ color: colors.brown }}>{task.name}</span>
                              <Badge 
                                style={{ 
                                  backgroundColor: statusColor, 
                                  color: status === 'due-soon' ? colors.brown : 'white' 
                                }}
                              >
                                {getStatusLabel(status)}
                              </Badge>
                            </div>
                            <div className="text-sm mt-1" style={{ color: colors.brownLight }}>
                              {task.equipment?.name}
                            </div>
                            {task.description && (
                              <p className="text-sm mt-2" style={{ color: colors.brownLight }}>{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: colors.brownLight }}>
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
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setCompletingTask(task);
                                setCompletionUsage(task.current_usage?.toString() || '0');
                              }}
                              style={{ backgroundColor: colors.gold, color: colors.brown }}
                              data-testid={`button-log-maintenance-${task.id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Log
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteTask(task.id)}
                              style={{ color: colors.red }}
                              data-testid={`button-delete-task-${task.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {completingTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }} className="w-full max-w-md">
              <CardHeader>
                <CardTitle style={{ color: colors.brown }}>Log Maintenance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium" style={{ color: colors.brown }}>{completingTask.name}</p>
                  <p className="text-sm" style={{ color: colors.brownLight }}>{completingTask.equipment?.name}</p>
                </div>
                
                {completingTask.interval_type === 'usage' && (
                  <div>
                    <Label style={{ color: colors.brown }}>
                      Current Usage ({completingTask.usage_unit_label})
                    </Label>
                    <Input
                      type="number"
                      value={completionUsage}
                      onChange={e => setCompletionUsage(e.target.value)}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-completion-usage"
                    />
                    <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                      Update the current usage counter (resets at {completingTask.interval_units} {completingTask.usage_unit_label})
                    </p>
                  </div>
                )}
                
                <div>
                  <Label style={{ color: colors.brown }}>Notes (optional)</Label>
                  <Textarea
                    value={completionNotes}
                    onChange={e => setCompletionNotes(e.target.value)}
                    placeholder="Any notes about this maintenance"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    data-testid="input-completion-notes"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleCompleteTask}
                    disabled={logMaintenanceMutation.isPending}
                    style={{ backgroundColor: colors.gold, color: colors.brown }}
                    data-testid="button-confirm-completion"
                  >
                    {logMaintenanceMutation.isPending ? 'Saving...' : 'Mark Complete'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCompletingTask(null);
                      setCompletionNotes('');
                      setCompletionUsage('');
                    }}
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                    data-testid="button-cancel-completion"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
