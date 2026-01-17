import { useState, useRef } from 'react';
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
import { useUpload } from '@/hooks/use-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  CalendarPlus,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Home,
  Shield,
  ShieldOff,
  Upload,
  FileText,
  ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SiGooglecalendar } from 'react-icons/si';
import { Footer } from '@/components/Footer';
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

function formatDateForCalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

type WarrantyStatus = 'covered' | 'expired' | 'none';

function getWarrantyStatus(equipment: Equipment): WarrantyStatus {
  if (!equipment.has_warranty) return 'none';
  if (!equipment.purchase_date || !equipment.warranty_duration_months) return 'none';
  
  const purchaseDate = new Date(equipment.purchase_date);
  const expirationDate = new Date(purchaseDate);
  expirationDate.setMonth(expirationDate.getMonth() + equipment.warranty_duration_months);
  
  const now = new Date();
  return now <= expirationDate ? 'covered' : 'expired';
}

function getWarrantyExpirationDate(equipment: Equipment): Date | null {
  if (!equipment.has_warranty || !equipment.purchase_date || !equipment.warranty_duration_months) return null;
  
  const purchaseDate = new Date(equipment.purchase_date);
  const expirationDate = new Date(purchaseDate);
  expirationDate.setMonth(expirationDate.getMonth() + equipment.warranty_duration_months);
  return expirationDate;
}

function formatWarrantyInfo(equipment: Equipment): string {
  const status = getWarrantyStatus(equipment);
  if (status === 'none') return '';
  
  const expiration = getWarrantyExpirationDate(equipment);
  if (!expiration) return '';
  
  const now = new Date();
  if (status === 'covered') {
    const monthsRemaining = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return `Expires ${expiration.toLocaleDateString()} (~${monthsRemaining} mo)`;
  } else {
    return `Expired ${expiration.toLocaleDateString()}`;
  }
}

function generateGoogleCalendarUrl(task: MaintenanceTask, equipmentName: string): string {
  if (!task.next_due_at) return '';
  
  const startDate = new Date(task.next_due_at);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);
  
  const title = encodeURIComponent(`${task.name} - ${equipmentName}`);
  const details = encodeURIComponent(
    `Maintenance Task: ${task.name}\nEquipment: ${equipmentName}${task.description ? `\n\nDescription: ${task.description}` : ''}\n\nInterval: Every ${task.interval_days} days`
  );
  const dates = `${formatDateForCalendar(startDate)}/${formatDateForCalendar(endDate)}`;
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

function generateOutlookCalendarUrl(task: MaintenanceTask, equipmentName: string): string {
  if (!task.next_due_at) return '';
  
  const startDate = new Date(task.next_due_at);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);
  
  const title = encodeURIComponent(`${task.name} - ${equipmentName}`);
  const body = encodeURIComponent(
    `Maintenance Task: ${task.name}\nEquipment: ${equipmentName}${task.description ? `\n\nDescription: ${task.description}` : ''}\n\nInterval: Every ${task.interval_days || 'N/A'} days`
  );
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${body}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}`;
}

function downloadICalFile(task: MaintenanceTask, equipmentName: string): void {
  if (!task.next_due_at) return;
  
  const startDate = new Date(task.next_due_at);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);
  
  const title = `${task.name} - ${equipmentName}`;
  const description = `Maintenance Task: ${task.name}\\nEquipment: ${equipmentName}${task.description ? `\\n\\nDescription: ${task.description}` : ''}\\n\\nInterval: Every ${task.interval_days || 'N/A'} days`;
  
  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Erwin Mills CMS//Equipment Maintenance//EN',
    'BEGIN:VEVENT',
    `UID:${task.id}@erwinmills.cms`,
    `DTSTAMP:${formatDateForCalendar(new Date())}`,
    `DTSTART:${formatDateForCalendar(startDate)}`,
    `DTEND:${formatDateForCalendar(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${task.name.replace(/[^a-z0-9]/gi, '_')}_maintenance.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const [editingTaskLastServiced, setEditingTaskLastServiced] = useState<MaintenanceTask | null>(null);
  const [editLastServicedDate, setEditLastServicedDate] = useState('');
  
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentCategory, setNewEquipmentCategory] = useState('');
  const [newEquipmentNotes, setNewEquipmentNotes] = useState('');
  const [newEquipmentHasWarranty, setNewEquipmentHasWarranty] = useState(false);
  const [newEquipmentPurchaseDate, setNewEquipmentPurchaseDate] = useState('');
  const [newEquipmentWarrantyMonths, setNewEquipmentWarrantyMonths] = useState('');
  const [newEquipmentWarrantyNotes, setNewEquipmentWarrantyNotes] = useState('');
  const [newEquipmentDocumentUrl, setNewEquipmentDocumentUrl] = useState('');
  const [newEquipmentDocumentName, setNewEquipmentDocumentName] = useState('');
  
  const newEquipmentFileInputRef = useRef<HTMLInputElement>(null);
  const editEquipmentFileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile, isUploading: isUploadingNew } = useUpload({
    onSuccess: (response) => {
      setNewEquipmentDocumentUrl(response.objectPath);
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  });
  
  const { uploadFile: uploadEditFile, isUploading: isUploadingEdit } = useUpload({
    onSuccess: (response) => {
      if (editingEquipment) {
        setEditingEquipment({ ...editingEquipment, document_url: response.objectPath });
      }
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  });
  
  const [newTaskEquipmentId, setNewTaskEquipmentId] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskIntervalType, setNewTaskIntervalType] = useState<'time' | 'usage'>('time');
  const [newTaskIntervalDays, setNewTaskIntervalDays] = useState('');
  const [newTaskIntervalUnits, setNewTaskIntervalUnits] = useState('');
  const [newTaskUsageLabel, setNewTaskUsageLabel] = useState('');
  const [newTaskLastServiced, setNewTaskLastServiced] = useState('');
  
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionUsage, setCompletionUsage] = useState('');
  const [completionCost, setCompletionCost] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [isHistoricalEntry, setIsHistoricalEntry] = useState(false);
  
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
    
    if (newEquipmentHasWarranty) {
      if (!newEquipmentPurchaseDate) {
        toast({ title: 'Please enter purchase date for warranty tracking', variant: 'destructive' });
        return;
      }
      if (!newEquipmentWarrantyMonths || parseInt(newEquipmentWarrantyMonths) <= 0) {
        toast({ title: 'Please enter warranty duration in months', variant: 'destructive' });
        return;
      }
    }
    
    try {
      await addEquipmentMutation.mutateAsync({
        tenant_id: tenant.id,
        name: newEquipmentName.trim(),
        category: newEquipmentCategory.trim() || undefined,
        notes: newEquipmentNotes.trim() || undefined,
        has_warranty: newEquipmentHasWarranty,
        purchase_date: newEquipmentHasWarranty && newEquipmentPurchaseDate ? newEquipmentPurchaseDate : undefined,
        warranty_duration_months: newEquipmentHasWarranty && newEquipmentWarrantyMonths ? parseInt(newEquipmentWarrantyMonths) : undefined,
        warranty_notes: newEquipmentHasWarranty && newEquipmentWarrantyNotes.trim() ? newEquipmentWarrantyNotes.trim() : undefined,
        document_url: newEquipmentDocumentUrl || undefined,
        document_name: newEquipmentDocumentName || undefined,
      });
      
      setNewEquipmentName('');
      setNewEquipmentCategory('');
      setNewEquipmentNotes('');
      setNewEquipmentHasWarranty(false);
      setNewEquipmentPurchaseDate('');
      setNewEquipmentWarrantyMonths('');
      setNewEquipmentWarrantyNotes('');
      setNewEquipmentDocumentUrl('');
      setNewEquipmentDocumentName('');
      setShowAddEquipment(false);
      toast({ title: 'Equipment added successfully' });
    } catch (error: any) {
      toast({ title: 'Error adding equipment', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleNewEquipmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewEquipmentDocumentName(file.name);
      await uploadFile(file);
    }
  };
  
  const handleEditEquipmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (editingEquipment) {
        setEditingEquipment({ ...editingEquipment, document_name: file.name });
      }
      await uploadEditFile(file);
    }
  };
  
  const handleUpdateEquipment = async () => {
    if (!editingEquipment) return;
    
    if (editingEquipment.has_warranty) {
      if (!editingEquipment.purchase_date) {
        toast({ title: 'Please enter purchase date for warranty tracking', variant: 'destructive' });
        return;
      }
      if (!editingEquipment.warranty_duration_months || editingEquipment.warranty_duration_months <= 0) {
        toast({ title: 'Please enter warranty duration in months', variant: 'destructive' });
        return;
      }
    }
    
    try {
      await updateEquipmentMutation.mutateAsync({
        id: editingEquipment.id,
        updates: {
          name: editingEquipment.name,
          category: editingEquipment.category,
          notes: editingEquipment.notes,
          has_warranty: editingEquipment.has_warranty,
          purchase_date: editingEquipment.has_warranty ? editingEquipment.purchase_date : null,
          warranty_duration_months: editingEquipment.has_warranty ? editingEquipment.warranty_duration_months : null,
          warranty_notes: editingEquipment.has_warranty ? editingEquipment.warranty_notes : null,
          document_url: editingEquipment.document_url,
          document_name: editingEquipment.document_name,
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
      // Calculate next_due_at and last_completed_at if Last Serviced date is provided
      let last_completed_at: string | undefined;
      let next_due_at: string | undefined;
      
      if (newTaskLastServiced && newTaskIntervalType === 'time') {
        const lastServiced = new Date(newTaskLastServiced);
        last_completed_at = lastServiced.toISOString();
        const dueDate = new Date(lastServiced);
        dueDate.setDate(dueDate.getDate() + parseInt(newTaskIntervalDays));
        next_due_at = dueDate.toISOString();
      }
      
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
        last_completed_at,
        next_due_at,
      });
      
      setNewTaskEquipmentId('');
      setNewTaskName('');
      setNewTaskDescription('');
      setNewTaskIntervalType('time');
      setNewTaskIntervalDays('');
      setNewTaskIntervalUnits('');
      setNewTaskUsageLabel('');
      setNewTaskLastServiced('');
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
        cost: completionCost ? parseFloat(completionCost) : undefined,
        completedAt: isHistoricalEntry && completionDate ? new Date(completionDate).toISOString() : undefined,
      });
      
      setCompletingTask(null);
      setCompletionNotes('');
      setCompletionUsage('');
      setCompletionCost('');
      setCompletionDate('');
      setIsHistoricalEntry(false);
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
  
  const handleUpdateLastServiced = async () => {
    if (!editingTaskLastServiced || !editLastServicedDate) {
      toast({ title: 'Please enter a date', variant: 'destructive' });
      return;
    }
    
    try {
      const lastServiced = new Date(editLastServicedDate);
      let next_due_at: string | null = null;
      
      // Calculate next due date for time-based tasks
      if (editingTaskLastServiced.interval_type === 'time' && editingTaskLastServiced.interval_days) {
        const dueDate = new Date(lastServiced);
        dueDate.setDate(dueDate.getDate() + editingTaskLastServiced.interval_days);
        next_due_at = dueDate.toISOString();
      }
      
      await updateTaskMutation.mutateAsync({
        id: editingTaskLastServiced.id,
        updates: {
          last_completed_at: lastServiced.toISOString(),
          next_due_at,
        }
      });
      
      setEditingTaskLastServiced(null);
      setEditLastServicedDate('');
      toast({ title: 'Last serviced date updated' });
    } catch (error: any) {
      toast({ title: 'Error updating date', description: error.message, variant: 'destructive' });
    }
  };
  
  const categories = Array.from(new Set(equipment.map(e => e.category).filter(Boolean))) as string[];
  
  const isLoading = loadingEquipment || loadingTasks;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-6 relative">
        <Link
          href="/"
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="link-dashboard"
        >
          <Home className="w-4 h-4" />
          Main Dashboard
        </Link>
        <div className="absolute top-4 right-4 flex items-center gap-2">
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
        <div className="max-w-7xl mx-auto text-center pt-10">
          <img
            src={logoUrl}
            alt="Erwin Mills Coffee Co."
            className="h-20 mx-auto mb-3"
            data-testid="img-logo"
          />
          <h2 className="text-xl font-semibold" style={{ color: colors.brown }}>
            Equipment Maintenance
          </h2>
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
                    {categories.length > 0 && (
                      <Select
                        value={categories.includes(newEquipmentCategory) ? newEquipmentCategory : ''}
                        onValueChange={(value) => {
                          if (value === '__new__') {
                            setNewEquipmentCategory('');
                          } else {
                            setNewEquipmentCategory(value);
                          }
                        }}
                      >
                        <SelectTrigger 
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="select-equipment-category"
                        >
                          <SelectValue placeholder="Select or add new" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                          <SelectItem value="__new__">+ Add new category...</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {(categories.length === 0 || !categories.includes(newEquipmentCategory)) && (
                      <Input
                        value={newEquipmentCategory}
                        onChange={e => setNewEquipmentCategory(e.target.value)}
                        placeholder="e.g., Grinders, Espresso Machines"
                        className={categories.length > 0 ? 'mt-2' : ''}
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                        data-testid="input-equipment-category"
                      />
                    )}
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
                  
                  <div className="pt-2 border-t" style={{ borderColor: colors.creamDark }}>
                    <div className="flex items-center justify-between">
                      <Label style={{ color: colors.brown }}>Has Warranty?</Label>
                      <Switch
                        checked={newEquipmentHasWarranty}
                        onCheckedChange={setNewEquipmentHasWarranty}
                        data-testid="switch-equipment-warranty"
                      />
                    </div>
                  </div>
                  
                  {newEquipmentHasWarranty && (
                    <div className="space-y-3 pl-2 border-l-2" style={{ borderColor: colors.gold }}>
                      <div>
                        <Label style={{ color: colors.brown }}>Purchase Date *</Label>
                        <Input
                          type="date"
                          value={newEquipmentPurchaseDate}
                          onChange={e => setNewEquipmentPurchaseDate(e.target.value)}
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="input-equipment-purchase-date"
                        />
                      </div>
                      <div>
                        <Label style={{ color: colors.brown }}>Warranty Duration (months) *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newEquipmentWarrantyMonths}
                          onChange={e => setNewEquipmentWarrantyMonths(e.target.value)}
                          placeholder="e.g., 12, 24, 36"
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="input-equipment-warranty-months"
                        />
                      </div>
                      <div>
                        <Label style={{ color: colors.brown }}>Warranty Notes</Label>
                        <Textarea
                          value={newEquipmentWarrantyNotes}
                          onChange={e => setNewEquipmentWarrantyNotes(e.target.value)}
                          placeholder="Coverage details, exclusions, claim info..."
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="input-equipment-warranty-notes"
                        />
                      </div>
                      <div>
                        <Label style={{ color: colors.brown }}>Warranty Document (Invoice, Receipt)</Label>
                        <input
                          type="file"
                          ref={newEquipmentFileInputRef}
                          onChange={handleNewEquipmentFileChange}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          className="hidden"
                          data-testid="input-equipment-document"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => newEquipmentFileInputRef.current?.click()}
                            disabled={isUploadingNew}
                            style={{ borderColor: colors.creamDark, color: colors.brown }}
                            data-testid="button-upload-document"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {isUploadingNew ? 'Uploading...' : 'Upload Document'}
                          </Button>
                          {newEquipmentDocumentName && (
                            <div className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                              <FileText className="w-4 h-4" style={{ color: colors.gold }} />
                              <span>{newEquipmentDocumentName}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setNewEquipmentDocumentUrl('');
                                  setNewEquipmentDocumentName('');
                                }}
                                className="h-6 w-6 p-0"
                                data-testid="button-remove-document"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
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
                        setNewEquipmentHasWarranty(false);
                        setNewEquipmentPurchaseDate('');
                        setNewEquipmentWarrantyMonths('');
                        setNewEquipmentWarrantyNotes('');
                        setNewEquipmentDocumentUrl('');
                        setNewEquipmentDocumentName('');
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
                          <div>
                            {categories.length > 0 && (
                              <Select
                                value={categories.includes(editingEquipment.category || '') ? editingEquipment.category || '' : ''}
                                onValueChange={(value) => {
                                  if (value === '__new__') {
                                    setEditingEquipment({ ...editingEquipment, category: '' });
                                  } else {
                                    setEditingEquipment({ ...editingEquipment, category: value });
                                  }
                                }}
                              >
                                <SelectTrigger 
                                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                                  data-testid="select-edit-equipment-category"
                                >
                                  <SelectValue placeholder="Select or add new" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                  <SelectItem value="__new__">+ Add new category...</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {(categories.length === 0 || !categories.includes(editingEquipment.category || '')) && (
                              <Input
                                value={editingEquipment.category || ''}
                                onChange={e => setEditingEquipment({ ...editingEquipment, category: e.target.value })}
                                placeholder="Category (e.g., Grinders)"
                                className={categories.length > 0 ? 'mt-2' : ''}
                                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                                data-testid="input-edit-equipment-category"
                              />
                            )}
                          </div>
                          <Textarea
                            value={editingEquipment.notes || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, notes: e.target.value })}
                            placeholder="Notes"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-notes"
                          />
                          
                          <div className="pt-2 border-t" style={{ borderColor: colors.creamDark }}>
                            <div className="flex items-center justify-between">
                              <Label style={{ color: colors.brown }}>Has Warranty?</Label>
                              <Switch
                                checked={editingEquipment.has_warranty || false}
                                onCheckedChange={(checked) => setEditingEquipment({ ...editingEquipment, has_warranty: checked })}
                                data-testid="switch-edit-equipment-warranty"
                              />
                            </div>
                          </div>
                          
                          {editingEquipment.has_warranty && (
                            <div className="space-y-3 pl-2 border-l-2" style={{ borderColor: colors.gold }}>
                              <div>
                                <Label style={{ color: colors.brown }}>Purchase Date *</Label>
                                <Input
                                  type="date"
                                  value={editingEquipment.purchase_date || ''}
                                  onChange={e => setEditingEquipment({ ...editingEquipment, purchase_date: e.target.value || null })}
                                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                                  data-testid="input-edit-equipment-purchase-date"
                                />
                              </div>
                              <div>
                                <Label style={{ color: colors.brown }}>Warranty Duration (months) *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={editingEquipment.warranty_duration_months || ''}
                                  onChange={e => setEditingEquipment({ ...editingEquipment, warranty_duration_months: e.target.value ? parseInt(e.target.value) : null })}
                                  placeholder="e.g., 12, 24, 36"
                                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                                  data-testid="input-edit-equipment-warranty-months"
                                />
                              </div>
                              <div>
                                <Label style={{ color: colors.brown }}>Warranty Notes</Label>
                                <Textarea
                                  value={editingEquipment.warranty_notes || ''}
                                  onChange={e => setEditingEquipment({ ...editingEquipment, warranty_notes: e.target.value || null })}
                                  placeholder="Coverage details, exclusions, claim info..."
                                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                                  data-testid="input-edit-equipment-warranty-notes"
                                />
                              </div>
                              <div>
                                <Label style={{ color: colors.brown }}>Warranty Document</Label>
                                <input
                                  type="file"
                                  ref={editEquipmentFileInputRef}
                                  onChange={handleEditEquipmentFileChange}
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  className="hidden"
                                  data-testid="input-edit-equipment-document"
                                />
                                <div className="flex items-center gap-2 mt-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editEquipmentFileInputRef.current?.click()}
                                    disabled={isUploadingEdit}
                                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                                    data-testid="button-edit-upload-document"
                                  >
                                    <Upload className="w-4 h-4 mr-2" />
                                    {isUploadingEdit ? 'Uploading...' : editingEquipment.document_url ? 'Replace Document' : 'Upload Document'}
                                  </Button>
                                  {editingEquipment.document_name && (
                                    <div className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                                      <FileText className="w-4 h-4" style={{ color: colors.gold }} />
                                      <span>{editingEquipment.document_name}</span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingEquipment({ ...editingEquipment, document_url: null, document_name: null })}
                                        className="h-6 w-6 p-0"
                                        data-testid="button-edit-remove-document"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleUpdateEquipment}
                              disabled={updateEquipmentMutation.isPending || isUploadingEdit}
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
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" style={{ color: colors.brown }}>{item.name}</span>
                              {item.category && (
                                <Badge variant="outline" style={{ borderColor: colors.gold, color: colors.brownLight }}>
                                  {item.category}
                                </Badge>
                              )}
                              {getWarrantyStatus(item) === 'covered' && (
                                <Badge 
                                  className="gap-1"
                                  style={{ backgroundColor: colors.green, color: 'white' }}
                                  data-testid={`badge-warranty-covered-${item.id}`}
                                >
                                  <Shield className="w-3 h-3" />
                                  Under Warranty
                                </Badge>
                              )}
                              {getWarrantyStatus(item) === 'expired' && (
                                <Badge 
                                  className="gap-1"
                                  style={{ backgroundColor: colors.red, color: 'white' }}
                                  data-testid={`badge-warranty-expired-${item.id}`}
                                >
                                  <ShieldOff className="w-3 h-3" />
                                  Warranty Expired
                                </Badge>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-sm mt-2" style={{ color: colors.brownLight }}>{item.notes}</p>
                            )}
                            {item.has_warranty && item.purchase_date && (
                              <div className="mt-2 text-xs space-y-1" style={{ color: colors.brownLight }}>
                                <p>Purchased: {new Date(item.purchase_date).toLocaleDateString()}</p>
                                {item.warranty_duration_months && (
                                  <p>{formatWarrantyInfo(item)}</p>
                                )}
                                {item.warranty_notes && (
                                  <p className="italic">{item.warranty_notes}</p>
                                )}
                                {item.document_url && item.document_name && (
                                  <a
                                    href={item.document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 hover:underline"
                                    style={{ color: colors.gold }}
                                    data-testid={`link-document-${item.id}`}
                                  >
                                    <FileText className="w-3 h-3" />
                                    {item.document_name}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
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
                    <>
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
                      <div>
                        <Label style={{ color: colors.brown }}>Last Serviced Date (optional)</Label>
                        <Input
                          type="date"
                          value={newTaskLastServiced}
                          onChange={e => setNewTaskLastServiced(e.target.value)}
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="input-last-serviced"
                        />
                        <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                          When was this last done? The next due date will be calculated from this.
                        </p>
                      </div>
                    </>
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
                            <div className="flex items-center gap-4 mt-3 text-xs flex-wrap" style={{ color: colors.brownLight }}>
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
                                onClick={() => {
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
                            {task.next_due_at && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    style={{ color: colors.brown }}
                                    data-testid={`button-add-to-calendar-${task.id}`}
                                  >
                                    <CalendarPlus className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => window.open(generateGoogleCalendarUrl(task, task.equipment?.name || ''), '_blank')}
                                    data-testid={`menu-google-calendar-${task.id}`}
                                  >
                                    <SiGooglecalendar className="w-4 h-4 mr-2" />
                                    Add to Google Calendar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => window.open(generateOutlookCalendarUrl(task, task.equipment?.name || ''), '_blank')}
                                    data-testid={`menu-outlook-calendar-${task.id}`}
                                  >
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Add to Outlook Calendar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => downloadICalFile(task, task.equipment?.name || '')}
                                    data-testid={`menu-ical-download-${task.id}`}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download for Apple/Other
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
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
                  <Label style={{ color: colors.brown }}>Cost (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={completionCost}
                    onChange={e => setCompletionCost(e.target.value)}
                    placeholder="0.00"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    data-testid="input-completion-cost"
                  />
                </div>
                
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
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="historical-entry"
                    checked={isHistoricalEntry}
                    onChange={e => setIsHistoricalEntry(e.target.checked)}
                    className="w-4 h-4"
                    data-testid="checkbox-historical-entry"
                  />
                  <Label htmlFor="historical-entry" style={{ color: colors.brown, cursor: 'pointer' }}>
                    This is a past maintenance (enter date)
                  </Label>
                </div>
                
                {isHistoricalEntry && (
                  <div>
                    <Label style={{ color: colors.brown }}>Maintenance Date</Label>
                    <Input
                      type="date"
                      value={completionDate}
                      onChange={e => setCompletionDate(e.target.value)}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-completion-date"
                    />
                  </div>
                )}
                
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
                      setCompletionCost('');
                      setCompletionDate('');
                      setIsHistoricalEntry(false);
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

        {editingTaskLastServiced && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }} className="w-full max-w-md">
              <CardHeader>
                <CardTitle style={{ color: colors.brown }}>Edit Last Serviced Date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium" style={{ color: colors.brown }}>{editingTaskLastServiced.name}</p>
                  <p className="text-sm" style={{ color: colors.brownLight }}>{editingTaskLastServiced.equipment?.name}</p>
                </div>
                
                <div>
                  <Label style={{ color: colors.brown }}>Last Serviced Date</Label>
                  <Input
                    type="date"
                    value={editLastServicedDate}
                    onChange={e => setEditLastServicedDate(e.target.value)}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                    data-testid="input-edit-last-serviced-date"
                  />
                  <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                    The next due date will be calculated as: Last Serviced + {editingTaskLastServiced.interval_days} days
                  </p>
                </div>
                
                {editLastServicedDate && editingTaskLastServiced.interval_days && (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                    <p className="text-sm" style={{ color: colors.brown }}>
                      <strong>Next Due:</strong>{' '}
                      {(() => {
                        const lastServiced = new Date(editLastServicedDate);
                        const dueDate = new Date(lastServiced);
                        dueDate.setDate(dueDate.getDate() + editingTaskLastServiced.interval_days);
                        return dueDate.toLocaleDateString();
                      })()}
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdateLastServiced}
                    disabled={updateTaskMutation.isPending}
                    style={{ backgroundColor: colors.gold, color: colors.brown }}
                    data-testid="button-save-last-serviced"
                  >
                    {updateTaskMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingTaskLastServiced(null);
                      setEditLastServicedDate('');
                    }}
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                    data-testid="button-cancel-edit-last-serviced"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
