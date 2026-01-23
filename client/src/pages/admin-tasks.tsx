import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useUpload } from '@/hooks/use-upload';
import { useAppResume } from '@/hooks/use-app-resume';
import { useLocationChange } from '@/hooks/use-location-change';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Plus, 
  Settings, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Calendar,
  Trash2,
  Edit2,
  Check,
  X,
  Home,
  Upload,
  FileText,
  ExternalLink,
  Users,
  ListTodo,
  MessageSquare,
  History,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Link } from 'wouter';
import defaultLogo from '@assets/Erwin-Mills-Logo_1767709452739.png';

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

interface TaskCategory {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  is_default: boolean;
}

interface TaskUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface AdminTask {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  next_recurrence_date: string | null;
  parent_task_id: string | null;
  document_url: string | null;
  document_name: string | null;
  estimated_cost: number | null;
  created_at: string;
  updated_at: string;
  category?: TaskCategory;
  assignee?: TaskUser;
  creator?: TaskUser;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: TaskUser;
}

interface TaskHistory {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user?: TaskUser;
}

type TaskDueStatus = 'overdue' | 'due-soon' | 'upcoming' | 'no-date';

function getTaskDueStatus(task: AdminTask): TaskDueStatus {
  if (!task.due_date) return 'no-date';
  if (task.status === 'completed' || task.status === 'cancelled') return 'no-date';
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 3) return 'due-soon';
  return 'upcoming';
}

function getStatusColor(status: TaskDueStatus) {
  switch (status) {
    case 'overdue': return colors.red;
    case 'due-soon': return colors.yellow;
    case 'upcoming': return colors.green;
    case 'no-date': return colors.brownLight;
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return colors.red;
    case 'medium': return colors.yellow;
    case 'low': return colors.green;
    default: return colors.brownLight;
  }
}

function formatDueDate(date: string | null): string {
  if (!date) return 'No due date';
  const d = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`;
  if (daysUntilDue === 0) return 'Due today';
  if (daysUntilDue === 1) return 'Due tomorrow';
  return d.toLocaleDateString();
}

export default function AdminTasks() {
  const { tenant, profile, branding, primaryTenant } = useAuth();
  
  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const logoUrl = branding?.logo_url || defaultLogo;
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<AdminTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<AdminTask | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#C9A227');
  const [editingCategory, setEditingCategory] = useState<TaskCategory | null>(null);
  
  const [taskForm, setTaskForm] = useState<{
    title: string;
    description: string;
    category_id: string;
    assigned_to: string;
    priority: 'low' | 'medium' | 'high';
    due_date: string;
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    document_url: string;
    document_name: string;
    estimated_cost: string;
  }>({
    title: '',
    description: '',
    category_id: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    recurrence: 'none',
    document_url: '',
    document_name: '',
    estimated_cost: ''
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const withRetry = useCallback(async <T,>(
    operationFn: () => PromiseLike<T>,
    timeoutMs: number = 30000,
    retries: number = 2
  ): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
        });
        
        const result = await Promise.race([
          Promise.resolve(operationFn()),
          timeoutPromise
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        return result;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err as Error;
        const msg = lastError.message?.toLowerCase() || '';
        const isNetworkError = msg.includes('network') || msg.includes('fetch') || 
          msg.includes('load failed') || msg.includes('timeout') || msg.includes('connection');
        
        if (isNetworkError && attempt < retries) {
          console.log(`[AdminTasks] Retry attempt ${attempt + 1}/${retries}...`);
          await supabase.auth.refreshSession();
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError;
  }, []);
  
  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
  }, [tenant?.id]);
  
  const loadData = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    
    try {
      const [categoriesRes, usersRes, tasksRes] = await Promise.all([
        supabase.from('admin_task_categories').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('user_profiles').select('id, full_name, email, role').eq('tenant_id', tenant.id).eq('is_active', true),
        supabase.from('admin_tasks').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
      ]);
      
      if (categoriesRes.error) throw categoriesRes.error;
      if (usersRes.error) throw usersRes.error;
      if (tasksRes.error) throw tasksRes.error;
      
      setCategories(categoriesRes.data || []);
      setUsers(usersRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (error: any) {
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, toast]);
  
  // Refresh data when app resumes from background (iPad multitasking)
  useAppResume(() => {
    if (tenant?.id) {
      console.log('[AdminTasks] Refreshing data after app resume');
      loadData();
    }
  }, [tenant?.id, loadData]);
  
  // Refresh data when location changes
  useLocationChange(() => {
    console.log('[AdminTasks] Refreshing data after location change');
    loadData();
  }, [loadData]);
  
  const loadTaskDetails = async (taskId: string) => {
    try {
      const [commentsRes, historyRes] = await Promise.all([
        supabase.from('admin_task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
        supabase.from('admin_task_history').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
      ]);
      
      setComments(commentsRes.data || []);
      setHistory(historyRes.data || []);
    } catch (error: any) {
      console.error('Error loading task details:', error);
    }
  };
  
  const handleAddCategory = async () => {
    if (!tenant?.id || !newCategoryName.trim()) return;
    
    try {
      const { error } = await supabase.from('admin_task_categories').insert({
        tenant_id: tenant.id,
        name: newCategoryName.trim(),
        color: newCategoryColor,
        is_default: false
      });
      
      if (error) throw error;
      toast({ title: 'Category added' });
      setNewCategoryName('');
      setNewCategoryColor('#C9A227');
      loadData();
    } catch (error: any) {
      toast({ title: 'Error adding category', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    
    try {
      const { error } = await supabase.from('admin_task_categories')
        .update({ name: editingCategory.name, color: editingCategory.color })
        .eq('id', editingCategory.id);
      
      if (error) throw error;
      toast({ title: 'Category updated' });
      setEditingCategory(null);
      loadData();
    } catch (error: any) {
      toast({ title: 'Error updating category', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase.from('admin_task_categories').delete().eq('id', categoryId);
      if (error) throw error;
      toast({ title: 'Category deleted' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error deleting category', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id || !profile?.id || !taskForm.title.trim()) return;
    
    setIsSaving(true);
    setSaveError(null);
    try {
      const taskData = {
        tenant_id: tenant.id,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        category_id: taskForm.category_id || null,
        assigned_to: taskForm.assigned_to || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
        recurrence: taskForm.recurrence,
        document_url: taskForm.document_url || null,
        document_name: taskForm.document_name || null,
        estimated_cost: taskForm.estimated_cost ? parseFloat(taskForm.estimated_cost) : null,
        created_by: editingTask ? editingTask.created_by : profile.id
      };
      
      if (editingTask) {
        const { error } = await withRetry(() => supabase.from('admin_tasks')
          .update({ ...taskData, updated_at: new Date().toISOString() })
          .eq('id', editingTask.id));
        if (error) throw error;
        
        await logTaskHistory(editingTask.id, 'updated', null, null);
        toast({ title: 'Task updated' });
      } else {
        const { data, error } = await withRetry(() => supabase.from('admin_tasks')
          .insert(taskData)
          .select()
          .single());
        if (error) throw error;
        
        await logTaskHistory(data.id, 'created', null, null);
        toast({ title: 'Task created' });
      }
      
      resetTaskForm();
      loadData();
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error saving task', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleStatusChange = async (task: AdminTask, newStatus: string) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updates: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString() 
      };
      
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = profile?.id;
        
        if (task.recurrence !== 'none' && task.due_date) {
          const nextDate = calculateNextRecurrence(task.due_date, task.recurrence);
          const { error: insertError } = await withRetry(() => supabase.from('admin_tasks').insert({
            tenant_id: task.tenant_id,
            title: task.title,
            description: task.description,
            category_id: task.category_id,
            assigned_to: task.assigned_to,
            priority: task.priority,
            due_date: nextDate,
            recurrence: task.recurrence,
            parent_task_id: task.id,
            created_by: task.created_by
          }));
          if (insertError) console.error('Error creating recurring task:', insertError);
        }
      }
      
      const { error } = await withRetry(() => supabase.from('admin_tasks')
        .update(updates)
        .eq('id', task.id));
      
      if (error) throw error;
      
      await logTaskHistory(task.id, 'status_changed', task.status, newStatus);
      toast({ title: `Task marked as ${newStatus.replace('_', ' ')}` });
      loadData();
      if (selectedTask?.id === task.id) {
        setSelectedTask({ ...task, status: newStatus as any });
        loadTaskDetails(task.id);
      }
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const calculateNextRecurrence = (currentDue: string, recurrence: string): string => {
    const date = new Date(currentDue);
    switch (recurrence) {
      case 'daily': date.setDate(date.getDate() + 1); break;
      case 'weekly': date.setDate(date.getDate() + 7); break;
      case 'monthly': date.setMonth(date.getMonth() + 1); break;
      case 'quarterly': date.setMonth(date.getMonth() + 3); break;
      case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
    }
    return date.toISOString().split('T')[0];
  };
  
  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('admin_tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast({ title: 'Task deleted' });
      setSelectedTask(null);
      loadData();
    } catch (error: any) {
      toast({ title: 'Error deleting task', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleAddComment = async () => {
    if (!selectedTask || !profile?.id || !newComment.trim()) return;
    
    try {
      const { error } = await supabase.from('admin_task_comments').insert({
        tenant_id: tenant?.id,
        task_id: selectedTask.id,
        user_id: profile.id,
        content: newComment.trim()
      });
      
      if (error) throw error;
      
      await logTaskHistory(selectedTask.id, 'comment_added', null, newComment.trim().substring(0, 50));
      toast({ title: 'Comment added' });
      setNewComment('');
      loadTaskDetails(selectedTask.id);
    } catch (error: any) {
      toast({ title: 'Error adding comment', description: error.message, variant: 'destructive' });
    }
  };
  
  const logTaskHistory = async (taskId: string, action: string, oldValue: string | null, newValue: string | null) => {
    try {
      await supabase.from('admin_task_history').insert({
        tenant_id: tenant?.id,
        task_id: taskId,
        user_id: profile?.id,
        action,
        old_value: oldValue,
        new_value: newValue
      });
    } catch (error) {
      console.error('Error logging history:', error);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await uploadFile(file);
    if (result) {
      setTaskForm(prev => ({ ...prev, document_url: result.uploadURL, document_name: file.name }));
      toast({ title: 'Document uploaded' });
    }
  };
  
  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      category_id: '',
      assigned_to: '',
      priority: 'medium',
      due_date: '',
      recurrence: 'none',
      document_url: '',
      document_name: '',
      estimated_cost: ''
    });
    setEditingTask(null);
    setShowTaskForm(false);
  };
  
  const openEditTask = (task: AdminTask) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      category_id: task.category_id || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority,
      due_date: task.due_date || '',
      recurrence: task.recurrence,
      document_url: task.document_url || '',
      document_name: task.document_name || '',
      estimated_cost: task.estimated_cost?.toString() || ''
    });
    setShowTaskForm(true);
  };
  
  const openTaskDetails = (task: AdminTask) => {
    setSelectedTask(task);
    loadTaskDetails(task.id);
  };
  
  const filteredTasks = tasks.filter(task => {
    if (filterCategory !== 'all' && task.category_id !== filterCategory) return false;
    if (filterStatus === 'active' && (task.status === 'completed' || task.status === 'cancelled')) return false;
    if (filterStatus !== 'all' && filterStatus !== 'active' && task.status !== filterStatus) return false;
    if (filterAssignee !== 'all' && task.assigned_to !== filterAssignee) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  }).sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'due_date':
        if (!a.due_date && !b.due_date) comparison = 0;
        else if (!a.due_date) comparison = 1;
        else if (!b.due_date) comparison = -1;
        else comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        break;
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'created_at':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  const overdueTasks = tasks.filter(t => getTaskDueStatus(t) === 'overdue' && t.status !== 'completed' && t.status !== 'cancelled');
  const dueSoonTasks = tasks.filter(t => getTaskDueStatus(t) === 'due-soon' && t.status !== 'completed' && t.status !== 'cancelled');
  
  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.id === userId);
    return user?.full_name || user?.email || 'Unknown';
  };
  
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };
  
  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return colors.brownLight;
    const category = categories.find(c => c.id === categoryId);
    return category?.color || colors.brownLight;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 rounded-full mx-auto mb-4" style={{ borderColor: colors.gold, borderTopColor: 'transparent' }} />
          <p style={{ color: colors.brown }}>Loading tasks...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            style={{ borderColor: colors.gold, color: colors.brown }}
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </Button>
          <Button
            size="sm"
            onClick={() => { resetTaskForm(); setShowTaskForm(true); }}
            style={{ backgroundColor: colors.gold, color: colors.brown }}
            data-testid="button-new-task"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Task
          </Button>
        </div>
        <div className="max-w-7xl mx-auto text-center pt-10">
          <img
            src={logoUrl}
            alt={displayName}
            className="mx-auto mb-3"
            style={{ height: 80, width: 'auto' }}
          />
          <h2 className="text-xl font-bold" style={{ color: colors.gold }}>
            Administrative Tasks
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • Part of {orgName}
            </p>
          )}
        </div>
      </header>
      
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full space-y-4">
        {(overdueTasks.length > 0 || dueSoonTasks.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {overdueTasks.length > 0 && (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.red, borderWidth: 2 }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.red }}>
                    <AlertTriangle className="w-5 h-5" />
                    Overdue Tasks ({overdueTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {overdueTasks.slice(0, 3).map(task => (
                    <div 
                      key={task.id} 
                      className="p-2 rounded cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: colors.cream }}
                      onClick={() => openTaskDetails(task)}
                    >
                      <p className="font-medium text-sm" style={{ color: colors.brown }}>{task.title}</p>
                      <p className="text-xs" style={{ color: colors.red }}>{formatDueDate(task.due_date)}</p>
                    </div>
                  ))}
                  {overdueTasks.length > 3 && (
                    <p className="text-xs text-center" style={{ color: colors.brownLight }}>
                      +{overdueTasks.length - 3} more
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            {dueSoonTasks.length > 0 && (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.yellow, borderWidth: 2 }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.yellow }}>
                    <Clock className="w-5 h-5" />
                    Due Soon ({dueSoonTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dueSoonTasks.slice(0, 3).map(task => (
                    <div 
                      key={task.id} 
                      className="p-2 rounded cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: colors.cream }}
                      onClick={() => openTaskDetails(task)}
                    >
                      <p className="font-medium text-sm" style={{ color: colors.brown }}>{task.title}</p>
                      <p className="text-xs" style={{ color: colors.yellow }}>{formatDueDate(task.due_date)}</p>
                    </div>
                  ))}
                  {dueSoonTasks.length > 3 && (
                    <p className="text-xs text-center" style={{ color: colors.brownLight }}>
                      +{dueSoonTasks.length - 3} more
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {showSettings && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                <Settings className="w-5 h-5" />
                Category Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label style={{ color: colors.brown }}>New Category</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    style={{ backgroundColor: colors.inputBg }}
                    data-testid="input-new-category"
                  />
                </div>
                <div>
                  <Label style={{ color: colors.brown }}>Color</Label>
                  <Input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="w-16 h-9 p-1"
                    data-testid="input-category-color"
                  />
                </div>
                <Button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                  data-testid="button-add-category"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {categories.map(category => (
                  <div key={category.id} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: colors.cream }}>
                    {editingCategory?.id === category.id ? (
                      <>
                        <Input
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          className="flex-1"
                          style={{ backgroundColor: colors.inputBg }}
                        />
                        <Input
                          type="color"
                          value={editingCategory.color}
                          onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                          className="w-12 h-8 p-1"
                        />
                        <Button size="icon" variant="ghost" onClick={handleUpdateCategory}>
                          <Check className="w-4 h-4" style={{ color: colors.green }} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingCategory(null)}>
                          <X className="w-4 h-4" style={{ color: colors.red }} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: category.color }} />
                        <span className="flex-1" style={{ color: colors.brown }}>{category.name}</span>
                        {category.is_default && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setEditingCategory(category)}>
                          <Edit2 className="w-4 h-4" style={{ color: colors.brownLight }} />
                        </Button>
                        {!category.is_default && (
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteCategory(category.id)}>
                            <Trash2 className="w-4 h-4" style={{ color: colors.red }} />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {showTaskForm && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                <ListTodo className="w-5 h-5" />
                {editingTask ? 'Edit Task' : 'New Task'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitTask} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label style={{ color: colors.brown }}>Title *</Label>
                    <Input
                      value={taskForm.title}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Task title"
                      required
                      style={{ backgroundColor: colors.inputBg }}
                      data-testid="input-task-title"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label style={{ color: colors.brown }}>Description</Label>
                    <Textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Task description..."
                      rows={3}
                      style={{ backgroundColor: colors.inputBg }}
                      data-testid="input-task-description"
                    />
                  </div>
                  
                  <div>
                    <Label style={{ color: colors.brown }}>Category</Label>
                    <Select value={taskForm.category_id} onValueChange={(v) => setTaskForm(prev => ({ ...prev, category_id: v }))}>
                      <SelectTrigger style={{ backgroundColor: colors.inputBg }} data-testid="select-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label style={{ color: colors.brown }}>Assign To</Label>
                    <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm(prev => ({ ...prev, assigned_to: v }))}>
                      <SelectTrigger style={{ backgroundColor: colors.inputBg }} data-testid="select-assignee">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label style={{ color: colors.brown }}>Priority</Label>
                    <Select value={taskForm.priority} onValueChange={(v: any) => setTaskForm(prev => ({ ...prev, priority: v }))}>
                      <SelectTrigger style={{ backgroundColor: colors.inputBg }} data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label style={{ color: colors.brown }}>Due Date</Label>
                    <Input
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                      style={{ backgroundColor: colors.inputBg }}
                      data-testid="input-due-date"
                    />
                  </div>
                  
                  <div>
                    <Label style={{ color: colors.brown }}>Recurrence</Label>
                    <Select value={taskForm.recurrence} onValueChange={(v: any) => setTaskForm(prev => ({ ...prev, recurrence: v }))}>
                      <SelectTrigger style={{ backgroundColor: colors.inputBg }} data-testid="select-recurrence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label style={{ color: colors.brown }}>Estimated Cost</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: colors.brownLight }}>$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={taskForm.estimated_cost}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, estimated_cost: e.target.value }))}
                        placeholder="0.00"
                        className="pl-7"
                        style={{ backgroundColor: colors.inputBg }}
                        data-testid="input-estimated-cost"
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                      Approximate cost for expense forecasting
                    </p>
                  </div>
                  
                  <div>
                    <Label style={{ color: colors.brown }}>Attachment</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="flex-1"
                        style={{ backgroundColor: colors.inputBg }}
                        data-testid="input-attachment"
                      />
                    </div>
                    {taskForm.document_name && (
                      <p className="text-xs mt-1" style={{ color: colors.green }}>
                        <FileText className="w-3 h-3 inline mr-1" />
                        {taskForm.document_name}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    style={{ backgroundColor: colors.gold, color: colors.brown }}
                    data-testid="button-save-task"
                  >
                    {editingTask ? 'Update Task' : 'Create Task'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetTaskForm}
                    style={{ borderColor: colors.brown, color: colors.brown }}
                    data-testid="button-cancel-task"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                <ListTodo className="w-5 h-5" />
                Tasks ({filteredTasks.length})
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-32" style={{ backgroundColor: colors.inputBg }}>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-28" style={{ backgroundColor: colors.inputBg }}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-28" style={{ backgroundColor: colors.inputBg }}>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8">
                <ListTodo className="w-12 h-12 mx-auto mb-2" style={{ color: colors.brownLight }} />
                <p style={{ color: colors.brownLight }}>No tasks found</p>
                <Button
                  className="mt-2"
                  onClick={() => { resetTaskForm(); setShowTaskForm(true); }}
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create First Task
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map(task => {
                  const dueStatus = getTaskDueStatus(task);
                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded border cursor-pointer hover:shadow-md transition-shadow"
                      style={{ 
                        backgroundColor: colors.cream, 
                        borderColor: task.status === 'completed' ? colors.green : getStatusColor(dueStatus),
                        borderLeftWidth: 4
                      }}
                      onClick={() => openTaskDetails(task)}
                      data-testid={`task-item-${task.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span 
                              className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}
                              style={{ color: colors.brown }}
                            >
                              {task.title}
                            </span>
                            {task.estimated_cost != null && Number(task.estimated_cost) > 0 && (
                              <Badge 
                                variant="outline"
                                className="text-xs font-semibold"
                                style={{ 
                                  borderColor: colors.gold, 
                                  color: colors.brown,
                                  backgroundColor: colors.cream 
                                }}
                              >
                                ~${Number(task.estimated_cost).toFixed(2)}
                              </Badge>
                            )}
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: getCategoryColor(task.category_id), color: getCategoryColor(task.category_id) }}
                            >
                              {getCategoryName(task.category_id)}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: getPriorityColor(task.priority), color: getPriorityColor(task.priority) }}
                            >
                              {task.priority}
                            </Badge>
                            {task.recurrence !== 'none' && (
                              <Badge variant="secondary" className="text-xs">
                                <RefreshCw className="w-3 h-3 mr-1" />
                                {task.recurrence}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: colors.brownLight }}>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {getUserName(task.assigned_to)}
                            </span>
                            <span className="flex items-center gap-1" style={{ color: getStatusColor(dueStatus) }}>
                              <Calendar className="w-3 h-3" />
                              {formatDueDate(task.due_date)}
                            </span>
                            {task.document_url && (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                Attached
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {task.status !== 'completed' && task.status !== 'cancelled' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStatusChange(task, 'completed')}
                              title="Mark complete"
                              data-testid={`button-complete-${task.id}`}
                            >
                              <CheckCircle className="w-5 h-5" style={{ color: colors.green }} />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditTask(task)}
                            title="Edit"
                            data-testid={`button-edit-${task.id}`}
                          >
                            <Edit2 className="w-4 h-4" style={{ color: colors.brownLight }} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        
        {selectedTask && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                    {selectedTask.title}
                    {selectedTask.status === 'completed' && (
                      <Badge style={{ backgroundColor: colors.green }} className="text-white">Completed</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: colors.brownLight }}>
                    <Badge variant="outline" style={{ borderColor: getCategoryColor(selectedTask.category_id) }}>
                      {getCategoryName(selectedTask.category_id)}
                    </Badge>
                    <span>|</span>
                    <span>Assigned to: {getUserName(selectedTask.assigned_to)}</span>
                    <span>|</span>
                    <span style={{ color: getStatusColor(getTaskDueStatus(selectedTask)) }}>
                      {formatDueDate(selectedTask.due_date)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {selectedTask.status !== 'completed' && (
                    <>
                      <Select 
                        value={selectedTask.status} 
                        onValueChange={(v) => handleStatusChange(selectedTask, v)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setTaskToDelete(selectedTask)}
                    data-testid="button-delete-task"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: colors.red }} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedTask(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTask.description && (
                <div>
                  <Label style={{ color: colors.brown }}>Description</Label>
                  <p className="mt-1" style={{ color: colors.brownLight }}>{selectedTask.description}</p>
                </div>
              )}
              
              {selectedTask.document_url && (
                <div>
                  <Label style={{ color: colors.brown }}>Attachment</Label>
                  <a 
                    href={selectedTask.document_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm mt-1 hover:underline"
                    style={{ color: colors.gold }}
                  >
                    <FileText className="w-4 h-4" />
                    {selectedTask.document_name || 'Download'}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1" style={{ color: colors.brown }}>
                    <MessageSquare className="w-4 h-4" />
                    Comments ({comments.length})
                  </Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {comments.map(comment => (
                      <div key={comment.id} className="p-2 rounded text-sm" style={{ backgroundColor: colors.cream }}>
                        <div className="flex justify-between text-xs" style={{ color: colors.brownLight }}>
                          <span>{getUserName(comment.user_id)}</span>
                          <span>{new Date(comment.created_at).toLocaleString()}</span>
                        </div>
                        <p style={{ color: colors.brown }}>{comment.content}</p>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-sm" style={{ color: colors.brownLight }}>No comments yet</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      style={{ backgroundColor: colors.inputBg }}
                      data-testid="input-comment"
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      style={{ backgroundColor: colors.gold, color: colors.brown }}
                      data-testid="button-add-comment"
                    >
                      Add
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="flex items-center gap-1" style={{ color: colors.brown }}>
                    <History className="w-4 h-4" />
                    History
                  </Label>
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {history.map(entry => (
                      <div key={entry.id} className="text-xs p-1" style={{ color: colors.brownLight }}>
                        <span className="font-medium">{getUserName(entry.user_id)}</span>
                        {' '}{entry.action.replace('_', ' ')}
                        {entry.new_value && ` → ${entry.new_value}`}
                        <span className="ml-2 opacity-75">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <p className="text-sm" style={{ color: colors.brownLight }}>No history yet</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent style={{ backgroundColor: colors.cream }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: colors.brown }}>Delete Task</AlertDialogTitle>
            <AlertDialogDescription style={{ color: colors.brownLight }}>
              Are you sure you want to delete "{taskToDelete?.title}"? This action cannot be undone. 
              All comments and history for this task will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              style={{ borderColor: colors.gold, color: colors.brown }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToDelete) {
                  handleDeleteTask(taskToDelete.id);
                  setTaskToDelete(null);
                }
              }}
              style={{ backgroundColor: colors.red, color: 'white' }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Footer />
    </div>
  );
}
