import { useState, useCallback, useMemo, useRef } from 'react';
import { useSearch, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, queryKeys } from '@/lib/supabase-queries';
import { useAppResume } from '@/hooks/use-app-resume';
import { useLocationChange } from '@/hooks/use-location-change';
import { queryClient } from '@/lib/queryClient';
import { CoffeeLoader } from '@/components/CoffeeLoader';
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
  type MaintenanceTask,
} from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Settings, X } from 'lucide-react';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { showDeleteUndoToast } from '@/hooks/use-delete-with-undo';
import { colors } from '@/lib/colors';

import { getTaskStatus, isVehicle, type TaskStatus } from './equipment-utils';
import { MaintenanceDue } from './MaintenanceDue';
import { EquipmentList } from './EquipmentList';
import { EquipmentForm } from './EquipmentForm';
import { TaskForm } from './TaskForm';
import {
  LogMaintenanceModal,
  EditLastServicedModal,
  EditTaskModal,
} from './LogMaintenanceModal';

export default function EquipmentMaintenance() {
  const { profile, tenant, branding, primaryTenant } = useAuth();

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const { data: equipment = [], isLoading: loadingEquipment, error: equipmentError, isError: equipmentHasError } = useEquipment(tenant?.id);
  const { data: tasks = [], isLoading: loadingTasks, error: tasksError, isError: tasksHasError } = useMaintenanceTasks(tenant?.id);

  // Log any query errors for debugging
  if (equipmentError) console.error('Equipment query error:', equipmentError);
  if (tasksError) console.error('Tasks query error:', tasksError);

  const addEquipmentMutation = useAddEquipment();
  const updateEquipmentMutation = useUpdateEquipment();
  const deleteEquipmentMutation = useDeleteEquipment();
  const addTaskMutation = useAddMaintenanceTask();
  const updateTaskMutation = useUpdateMaintenanceTask();
  const deleteTaskMutation = useDeleteMaintenanceTask();
  const logMaintenanceMutation = useLogMaintenance();
  const updateUsageMutation = useUpdateUsage();

  // Refresh data when app resumes from background (iPad multitasking)
  useAppResume(() => {
    if (tenant?.id) {
      console.log('[EquipmentMaintenance] Refreshing data after app resume');
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    }
  }, [tenant?.id]);

  // Refresh data when location changes
  useLocationChange(() => {
    console.log('[EquipmentMaintenance] Refreshing data after location change');
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
    queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
  }, []);

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
          console.log(`[Save] Retry attempt ${attempt + 1}/${retries}...`);
          await supabase.auth.refreshSession();
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError;
  }, []);

  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const activeTab = (new URLSearchParams(searchString).get('tab') || 'dashboard') as 'dashboard' | 'equipment';
  const setActiveTab = useCallback((tab: 'dashboard' | 'equipment') => {
    setLocation(`/equipment-maintenance?tab=${tab}`);
  }, [setLocation]);
  const [showAddEquipment, setShowAddEquipment] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editingEquipment, setEditingEquipmentRaw] = useState<Equipment | null>(null);
  const originalEquipmentRef = useRef<Equipment | null>(null);

  // Wrap setEditingEquipment to track original state
  const setEditingEquipment = useCallback((eq: Equipment | null | ((prev: Equipment | null) => Equipment | null)) => {
    setEditingEquipmentRaw((prev) => {
      const next = typeof eq === 'function' ? eq(prev) : eq;
      // When starting to edit (null -> item), save the original
      if (prev === null && next !== null) {
        originalEquipmentRef.current = { ...next };
      }
      // When stopping edit (item -> null), clear original
      if (next === null) {
        originalEquipmentRef.current = null;
      }
      return next;
    });
  }, []);

  const hasUnsavedEquipmentChanges = useCallback(() => {
    if (!editingEquipment || !originalEquipmentRef.current) return false;
    const orig = originalEquipmentRef.current;
    return (
      editingEquipment.name !== orig.name ||
      editingEquipment.category !== orig.category ||
      editingEquipment.notes !== orig.notes ||
      editingEquipment.has_warranty !== orig.has_warranty ||
      editingEquipment.purchase_date !== orig.purchase_date ||
      editingEquipment.warranty_duration_months !== orig.warranty_duration_months ||
      editingEquipment.warranty_notes !== orig.warranty_notes ||
      editingEquipment.photo_url !== orig.photo_url ||
      editingEquipment.in_service_date !== orig.in_service_date
    );
  }, [editingEquipment]);

  const [completingTask, setCompletingTask] = useState<MaintenanceTask | null>(null);
  const [editingTaskLastServiced, setEditingTaskLastServiced] = useState<MaintenanceTask | null>(null);
  const [editLastServicedDate, setEditLastServicedDate] = useState('');
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');
  const [editTaskIntervalType, setEditTaskIntervalType] = useState<'time' | 'usage'>('time');
  const [editTaskIntervalDays, setEditTaskIntervalDays] = useState('');
  const [editTaskIntervalUnits, setEditTaskIntervalUnits] = useState('');
  const [editTaskUsageLabel, setEditTaskUsageLabel] = useState('');
  const [editTaskEstimatedCost, setEditTaskEstimatedCost] = useState('');
  const [editTaskImageUrl, setEditTaskImageUrl] = useState<string | null>(null);
  const [isUploadingEditTaskPhoto, setIsUploadingEditTaskPhoto] = useState(false);

  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentCategory, setNewEquipmentCategory] = useState('');
  const [newEquipmentNotes, setNewEquipmentNotes] = useState('');
  const [newEquipmentHasWarranty, setNewEquipmentHasWarranty] = useState(false);
  const [newEquipmentPurchaseDate, setNewEquipmentPurchaseDate] = useState('');
  const [newEquipmentWarrantyMonths, setNewEquipmentWarrantyMonths] = useState('');
  const [newEquipmentWarrantyNotes, setNewEquipmentWarrantyNotes] = useState('');
  const [newEquipmentInServiceDate, setNewEquipmentInServiceDate] = useState('');
  const [newEquipmentPhotoUrl, setNewEquipmentPhotoUrl] = useState('');
  const [newEquipmentLicenseState, setNewEquipmentLicenseState] = useState('');
  const [newEquipmentLicensePlate, setNewEquipmentLicensePlate] = useState('');
  const [newEquipmentVin, setNewEquipmentVin] = useState('');
  const [isUploadingNewPhoto, setIsUploadingNewPhoto] = useState(false);
  const [isUploadingEditPhoto, setIsUploadingEditPhoto] = useState(false);

  const handleEquipmentPhotoUpload = async (file: File, mode: 'new' | 'edit') => {
    const setUploading = mode === 'new' ? setIsUploadingNewPhoto : setIsUploadingEditPhoto;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${profile?.tenant_id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('equipment-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('equipment-photos')
        .getPublicUrl(fileName);
      if (mode === 'new') {
        setNewEquipmentPhotoUrl(publicUrl);
      } else if (editingEquipment) {
        setEditingEquipment({ ...editingEquipment, photo_url: publicUrl });
      }
      toast({ title: 'Photo uploaded' });
    } catch (error: any) {
      toast({ title: 'Photo upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const [newTaskEquipmentId, setNewTaskEquipmentId] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskIntervalType, setNewTaskIntervalType] = useState<'time' | 'usage'>('time');
  const [newTaskIntervalDays, setNewTaskIntervalDays] = useState('');
  const [newTaskIntervalUnits, setNewTaskIntervalUnits] = useState('');
  const [newTaskUsageLabel, setNewTaskUsageLabel] = useState('');
  const [newTaskLastServiced, setNewTaskLastServiced] = useState('');
  const [newTaskEstimatedCost, setNewTaskEstimatedCost] = useState('');
  const [newTaskImageUrl, setNewTaskImageUrl] = useState('');
  const [isUploadingNewTaskPhoto, setIsUploadingNewTaskPhoto] = useState(false);

  const handleTaskPhotoUpload = async (file: File, mode: 'new' | 'edit') => {
    const setUploading = mode === 'new' ? setIsUploadingNewTaskPhoto : setIsUploadingEditTaskPhoto;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${profile?.tenant_id}/tasks/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('equipment-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('equipment-photos')
        .getPublicUrl(fileName);
      if (mode === 'new') {
        setNewTaskImageUrl(publicUrl);
      } else {
        setEditTaskImageUrl(publicUrl);
      }
      toast({ title: 'Task photo uploaded' });
    } catch (error: any) {
      toast({ title: 'Photo upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const [completionNotes, setCompletionNotes] = useState('');
  const [completionUsage, setCompletionUsage] = useState('');
  const [completionCost, setCompletionCost] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [isHistoricalEntry, setIsHistoricalEntry] = useState(false);

  // Sort tasks: overdue first, then due-soon, then good. Within each group, earlier due dates first.
  const sortedTasks = useMemo(() => {
    const statusPriority: Record<TaskStatus, number> = { 'overdue': 0, 'due-soon': 1, 'good': 2 };
    return [...tasks].sort((a, b) => {
      const aPriority = statusPriority[getTaskStatus(a)];
      const bPriority = statusPriority[getTaskStatus(b)];
      if (aPriority !== bPriority) return aPriority - bPriority;
      // Within same status group, sort by next_due_at (earliest first, nulls last)
      if (a.next_due_at && b.next_due_at) return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime();
      if (a.next_due_at) return -1;
      if (b.next_due_at) return 1;
      return 0;
    });
  }, [tasks]);

  const overdueCount = sortedTasks.filter(t => getTaskStatus(t) === 'overdue').length;
  const dueSoonCount = sortedTasks.filter(t => getTaskStatus(t) === 'due-soon').length;

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

    setIsSaving(true);
    setSaveError(null);
    try {
      await withRetry(() => addEquipmentMutation.mutateAsync({
        tenant_id: tenant.id,
        name: newEquipmentName.trim(),
        category: newEquipmentCategory.trim() || undefined,
        notes: newEquipmentNotes.trim() || undefined,
        has_warranty: newEquipmentHasWarranty,
        purchase_date: newEquipmentHasWarranty && newEquipmentPurchaseDate ? newEquipmentPurchaseDate : undefined,
        warranty_duration_months: newEquipmentHasWarranty && newEquipmentWarrantyMonths ? parseInt(newEquipmentWarrantyMonths) : undefined,
        warranty_notes: newEquipmentHasWarranty && newEquipmentWarrantyNotes.trim() ? newEquipmentWarrantyNotes.trim() : undefined,
        photo_url: newEquipmentPhotoUrl || undefined,
        in_service_date: newEquipmentInServiceDate || undefined,
        license_state: isVehicle(newEquipmentCategory) && newEquipmentLicenseState ? newEquipmentLicenseState : undefined,
        license_plate: isVehicle(newEquipmentCategory) && newEquipmentLicensePlate ? newEquipmentLicensePlate : undefined,
        vin: isVehicle(newEquipmentCategory) && newEquipmentVin ? newEquipmentVin : undefined,
      }));

      setNewEquipmentName('');
      setNewEquipmentCategory('');
      setNewEquipmentNotes('');
      setNewEquipmentHasWarranty(false);
      setNewEquipmentPurchaseDate('');
      setNewEquipmentWarrantyMonths('');
      setNewEquipmentWarrantyNotes('');
      setNewEquipmentInServiceDate('');
      setNewEquipmentPhotoUrl('');
      setNewEquipmentLicenseState('');
      setNewEquipmentLicensePlate('');
      setNewEquipmentVin('');
      setShowAddEquipment(false);
      toast({ title: 'Equipment added successfully' });
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error adding equipment', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveEquipment = useCallback(async (closeAfterSave: boolean) => {
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

    setIsSaving(true);
    setSaveError(null);
    try {
      await withRetry(() => updateEquipmentMutation.mutateAsync({
        id: editingEquipment.id,
        updates: {
          name: editingEquipment.name,
          category: editingEquipment.category,
          notes: editingEquipment.notes,
          has_warranty: editingEquipment.has_warranty,
          purchase_date: editingEquipment.has_warranty ? editingEquipment.purchase_date : null,
          warranty_duration_months: editingEquipment.has_warranty ? editingEquipment.warranty_duration_months : null,
          warranty_notes: editingEquipment.has_warranty ? editingEquipment.warranty_notes : null,
          photo_url: editingEquipment.photo_url,
          in_service_date: editingEquipment.in_service_date,
          license_state: isVehicle(editingEquipment.category) ? editingEquipment.license_state : null,
          license_plate: isVehicle(editingEquipment.category) ? editingEquipment.license_plate : null,
          vin: isVehicle(editingEquipment.category) ? editingEquipment.vin : null,
        }
      }));

      // Update original ref so changes are no longer "unsaved"
      originalEquipmentRef.current = { ...editingEquipment };

      if (closeAfterSave) {
        setEditingEquipment(null);
      }
      toast({ title: 'Equipment updated successfully' });
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error updating equipment', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [editingEquipment, toast, withRetry, updateEquipmentMutation, setEditingEquipment]);

  const handleUpdateEquipment = useCallback(() => saveEquipment(true), [saveEquipment]);

  const handleAutoSaveEquipment = useCallback(() => {
    if (hasUnsavedEquipmentChanges()) {
      saveEquipment(false);
    }
  }, [hasUnsavedEquipmentChanges, saveEquipment]);

  const handleCancelEditEquipment = useCallback(async () => {
    if (hasUnsavedEquipmentChanges()) {
      const shouldSave = await confirm({
        title: 'Unsaved Changes',
        description: 'You have unsaved changes to this equipment. Would you like to save them?',
        confirmLabel: 'Save',
        cancelLabel: 'Discard',
      });
      if (shouldSave) {
        await saveEquipment(true);
        return;
      }
    }
    setEditingEquipment(null);
  }, [hasUnsavedEquipmentChanges, saveEquipment, confirm, setEditingEquipment]);

  const handleEditEquipment = useCallback(async (item: Equipment) => {
    if (editingEquipment && editingEquipment.id !== item.id && hasUnsavedEquipmentChanges()) {
      const shouldSave = await confirm({
        title: 'Unsaved Changes',
        description: `You have unsaved changes to "${editingEquipment.name}". Would you like to save them?`,
        confirmLabel: 'Save',
        cancelLabel: 'Discard',
      });
      if (shouldSave) {
        await saveEquipment(false);
      }
    }
    setEditingEquipment(item);
  }, [editingEquipment, hasUnsavedEquipmentChanges, confirm, saveEquipment, setEditingEquipment]);

  const handleDeleteEquipment = async (id: string) => {
    const name = equipment.find(e => e.id === id)?.name || 'this equipment';
    if (!await confirm({ title: `Remove ${name}?`, description: 'All related maintenance tasks will also be removed.', confirmLabel: 'Remove', variant: 'destructive' })) return;

    try {
      await deleteEquipmentMutation.mutateAsync(id);
      showDeleteUndoToast({
        itemName: name,
        undo: { type: 'soft-reactivate', table: 'equipment', id },
        invalidateKeys: [queryKeys.equipment, queryKeys.maintenanceTasks],
      });
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

    setIsSaving(true);
    setSaveError(null);
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

      await withRetry(() => addTaskMutation.mutateAsync({
        tenant_id: tenant.id,
        equipment_id: newTaskEquipmentId,
        name: newTaskName.trim(),
        description: newTaskDescription.trim() || undefined,
        image_url: newTaskImageUrl || undefined,
        interval_type: newTaskIntervalType,
        interval_days: newTaskIntervalType === 'time' ? parseInt(newTaskIntervalDays) : undefined,
        interval_units: newTaskIntervalType === 'usage' ? parseInt(newTaskIntervalUnits) : undefined,
        usage_unit_label: newTaskIntervalType === 'usage' ? newTaskUsageLabel.trim() : undefined,
        current_usage: 0,
        last_completed_at,
        next_due_at,
        estimated_cost: newTaskEstimatedCost ? parseFloat(newTaskEstimatedCost) : undefined,
      }));

      setNewTaskEquipmentId('');
      setNewTaskName('');
      setNewTaskDescription('');
      setNewTaskIntervalType('time');
      setNewTaskIntervalDays('');
      setNewTaskIntervalUnits('');
      setNewTaskUsageLabel('');
      setNewTaskLastServiced('');
      setNewTaskEstimatedCost('');
      setNewTaskImageUrl('');
      setShowAddTask(false);
      toast({ title: 'Maintenance task added successfully' });
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error adding task', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!completingTask) return;

    if (!tenant?.id) {
      toast({ title: 'No tenant context', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await withRetry(() => logMaintenanceMutation.mutateAsync({
        tenantId: tenant.id,
        taskId: completingTask.id,
        completedBy: profile?.full_name || profile?.email,
        notes: completionNotes.trim() || undefined,
        usageAtCompletion: completingTask.interval_type === 'usage' && completionUsage
          ? parseInt(completionUsage)
          : undefined,
        cost: completionCost ? parseFloat(completionCost) : undefined,
        completedAt: isHistoricalEntry && completionDate ? new Date(completionDate).toISOString() : undefined,
      }));

      setCompletingTask(null);
      setCompletionNotes('');
      setCompletionUsage('');
      setCompletionCost('');
      setCompletionDate('');
      setIsHistoricalEntry(false);
      toast({ title: 'Maintenance logged successfully' });
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error logging maintenance', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    const name = task?.name || 'this maintenance task';
    if (!await confirm({ title: `Remove ${name}?`, description: 'This cannot be undone.', confirmLabel: 'Remove', variant: 'destructive' })) return;

    try {
      await deleteTaskMutation.mutateAsync(id);
      showDeleteUndoToast({
        itemName: name,
        undo: { type: 'soft-reactivate', table: 'maintenance_tasks', id },
        invalidateKeys: [queryKeys.maintenanceTasks],
      });
    } catch (error: any) {
      toast({ title: 'Error removing task', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateLastServiced = async () => {
    if (!editingTaskLastServiced || !editLastServicedDate) {
      toast({ title: 'Please enter a date', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const lastServiced = new Date(editLastServicedDate);
      let next_due_at: string | null = null;

      // Calculate next due date for time-based tasks
      if (editingTaskLastServiced.interval_type === 'time' && editingTaskLastServiced.interval_days) {
        const dueDate = new Date(lastServiced);
        dueDate.setDate(dueDate.getDate() + editingTaskLastServiced.interval_days);
        next_due_at = dueDate.toISOString();
      }

      await withRetry(() => updateTaskMutation.mutateAsync({
        id: editingTaskLastServiced.id,
        updates: {
          last_completed_at: lastServiced.toISOString(),
          next_due_at,
        }
      }));

      setEditingTaskLastServiced(null);
      setEditLastServicedDate('');
      toast({ title: 'Last serviced date updated' });
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error updating date', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditTask = (task: MaintenanceTask) => {
    setEditingTask(task);
    setEditTaskName(task.name);
    setEditTaskDescription(task.description || '');
    setEditTaskImageUrl(task.image_url || null);
    setEditTaskIntervalType(task.interval_type as 'time' | 'usage');
    setEditTaskIntervalDays(task.interval_days?.toString() || '');
    setEditTaskIntervalUnits(task.interval_units?.toString() || '');
    setEditTaskUsageLabel(task.usage_unit_label || '');
    setEditTaskEstimatedCost(task.estimated_cost != null ? Number(task.estimated_cost).toString() : '');
  };

  const handleSaveEditedTask = async () => {
    if (!editingTask) return;

    if (!editTaskName.trim()) {
      toast({ title: 'Please enter a task name', variant: 'destructive' });
      return;
    }

    if (editTaskIntervalType === 'time' && !editTaskIntervalDays) {
      toast({ title: 'Please enter the interval in days', variant: 'destructive' });
      return;
    }

    if (editTaskIntervalType === 'usage' && (!editTaskIntervalUnits || !editTaskUsageLabel)) {
      toast({ title: 'Please enter both usage interval and unit label', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      // Calculate new due date if interval changed for time-based tasks
      let next_due_at: string | undefined | null = undefined;
      const originalIntervalDays = editingTask.interval_days;
      const newIntervalDays = parseInt(editTaskIntervalDays);

      if (editTaskIntervalType === 'time') {
        // If task has a last completion date, calculate from that
        if (editingTask.last_completed_at) {
          const lastServiced = new Date(editingTask.last_completed_at);
          const dueDate = new Date(lastServiced);
          dueDate.setDate(dueDate.getDate() + newIntervalDays);
          next_due_at = dueDate.toISOString();
        }
        // If no last completion but has existing next_due_at and interval changed, recalculate
        else if (editingTask.next_due_at && originalIntervalDays && originalIntervalDays !== newIntervalDays) {
          // Calculate the original start date (next_due - old interval)
          const oldNextDue = new Date(editingTask.next_due_at);
          const startDate = new Date(oldNextDue);
          startDate.setDate(startDate.getDate() - originalIntervalDays);
          // Calculate new due date from start date
          const newDueDate = new Date(startDate);
          newDueDate.setDate(newDueDate.getDate() + newIntervalDays);
          next_due_at = newDueDate.toISOString();
        }
        // If neither exists, set due date from today
        else if (!editingTask.next_due_at) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + newIntervalDays);
          next_due_at = dueDate.toISOString();
        }
      } else {
        // Usage-based tasks don't have time-based due dates
        next_due_at = null;
      }

      await withRetry(() => updateTaskMutation.mutateAsync({
        id: editingTask.id,
        updates: {
          name: editTaskName.trim(),
          description: editTaskDescription.trim() || null,
          image_url: editTaskImageUrl || null,
          interval_type: editTaskIntervalType,
          interval_days: editTaskIntervalType === 'time' ? parseInt(editTaskIntervalDays) : null,
          interval_units: editTaskIntervalType === 'usage' ? parseInt(editTaskIntervalUnits) : null,
          usage_unit_label: editTaskIntervalType === 'usage' ? editTaskUsageLabel.trim() : null,
          estimated_cost: editTaskEstimatedCost ? parseFloat(editTaskEstimatedCost) : null,
          next_due_at,
        }
      }));

      setEditingTask(null);
      toast({ title: 'Task updated successfully' });
    } catch (error: any) {
      setSaveError(error.message);
      toast({ title: 'Error updating task', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const categories = Array.from(new Set(equipment.map(e => e.category).filter(Boolean))) as string[];

  // Don't stay in loading state if there's an error - show content anyway
  const isLoading = (loadingEquipment && !equipmentHasError) || (loadingTasks && !tasksHasError);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
              Equipment Maintenance
            </h2>
            {isChildLocation && orgName && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {displayName} • {orgName}
              </p>
            )}
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
            style={activeTab === 'dashboard' ? { backgroundColor: colors.gold, color: colors.white } : { borderColor: colors.gold, color: colors.brown }}
            data-testid="tab-dashboard"
          >
            <Wrench className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'equipment' ? 'default' : 'outline'}
            onClick={() => setActiveTab('equipment')}
            style={activeTab === 'equipment' ? { backgroundColor: colors.gold, color: colors.white } : { borderColor: colors.gold, color: colors.brown }}
            data-testid="tab-equipment"
          >
            <Settings className="w-4 h-4 mr-2" />
            Equipment
          </Button>
        </div>

        {isLoading ? (
          <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
            <CardContent className="p-8">
              <CoffeeLoader text="Brewing..." />
            </CardContent>
          </Card>
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-4">
            <MaintenanceDue
              tasks={tasks}
              sortedTasks={sortedTasks}
              equipment={equipment}
              overdueCount={overdueCount}
              dueSoonCount={dueSoonCount}
              expandedTaskId={expandedTaskId}
              setExpandedTaskId={setExpandedTaskId}
              setLightboxUrl={setLightboxUrl}
              setShowAddTask={setShowAddTask}
              setActiveTab={setActiveTab}
              setCompletingTask={setCompletingTask}
              setCompletionUsage={setCompletionUsage}
              setEditingTaskLastServiced={setEditingTaskLastServiced}
              setEditLastServicedDate={setEditLastServicedDate}
              openEditTask={openEditTask}
              handleDeleteTask={handleDeleteTask}
              profileFullName={profile?.full_name || undefined}
            />

            {/* Add Task form */}
            {showAddTask && (
              <TaskForm
                equipment={equipment}
                newTaskEquipmentId={newTaskEquipmentId}
                setNewTaskEquipmentId={setNewTaskEquipmentId}
                newTaskName={newTaskName}
                setNewTaskName={setNewTaskName}
                newTaskDescription={newTaskDescription}
                setNewTaskDescription={setNewTaskDescription}
                newTaskIntervalType={newTaskIntervalType}
                setNewTaskIntervalType={setNewTaskIntervalType}
                newTaskIntervalDays={newTaskIntervalDays}
                setNewTaskIntervalDays={setNewTaskIntervalDays}
                newTaskIntervalUnits={newTaskIntervalUnits}
                setNewTaskIntervalUnits={setNewTaskIntervalUnits}
                newTaskUsageLabel={newTaskUsageLabel}
                setNewTaskUsageLabel={setNewTaskUsageLabel}
                newTaskLastServiced={newTaskLastServiced}
                setNewTaskLastServiced={setNewTaskLastServiced}
                newTaskEstimatedCost={newTaskEstimatedCost}
                setNewTaskEstimatedCost={setNewTaskEstimatedCost}
                newTaskImageUrl={newTaskImageUrl}
                setNewTaskImageUrl={setNewTaskImageUrl}
                isUploadingNewTaskPhoto={isUploadingNewTaskPhoto}
                handleTaskPhotoUpload={handleTaskPhotoUpload}
                handleAddTask={handleAddTask}
                addTaskMutationIsPending={addTaskMutation.isPending}
                setShowAddTask={setShowAddTask}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {showAddEquipment && (
              <EquipmentForm
                categories={categories}
                newEquipmentName={newEquipmentName}
                setNewEquipmentName={setNewEquipmentName}
                newEquipmentCategory={newEquipmentCategory}
                setNewEquipmentCategory={setNewEquipmentCategory}
                newEquipmentNotes={newEquipmentNotes}
                setNewEquipmentNotes={setNewEquipmentNotes}
                newEquipmentHasWarranty={newEquipmentHasWarranty}
                setNewEquipmentHasWarranty={setNewEquipmentHasWarranty}
                newEquipmentPurchaseDate={newEquipmentPurchaseDate}
                setNewEquipmentPurchaseDate={setNewEquipmentPurchaseDate}
                newEquipmentWarrantyMonths={newEquipmentWarrantyMonths}
                setNewEquipmentWarrantyMonths={setNewEquipmentWarrantyMonths}
                newEquipmentWarrantyNotes={newEquipmentWarrantyNotes}
                setNewEquipmentWarrantyNotes={setNewEquipmentWarrantyNotes}
                newEquipmentInServiceDate={newEquipmentInServiceDate}
                setNewEquipmentInServiceDate={setNewEquipmentInServiceDate}
                newEquipmentPhotoUrl={newEquipmentPhotoUrl}
                setNewEquipmentPhotoUrl={setNewEquipmentPhotoUrl}
                newEquipmentLicenseState={newEquipmentLicenseState}
                setNewEquipmentLicenseState={setNewEquipmentLicenseState}
                newEquipmentLicensePlate={newEquipmentLicensePlate}
                setNewEquipmentLicensePlate={setNewEquipmentLicensePlate}
                newEquipmentVin={newEquipmentVin}
                setNewEquipmentVin={setNewEquipmentVin}
                isUploadingNewPhoto={isUploadingNewPhoto}
                handleEquipmentPhotoUpload={handleEquipmentPhotoUpload}
                handleAddEquipment={handleAddEquipment}
                addEquipmentMutationIsPending={addEquipmentMutation.isPending}
                setShowAddEquipment={setShowAddEquipment}
              />
            )}

            <EquipmentList
              equipment={equipment}
              tasks={tasks}
              categories={categories}
              editingEquipment={editingEquipment}
              setEditingEquipment={setEditingEquipment}
              isUploadingEditPhoto={isUploadingEditPhoto}
              handleEquipmentPhotoUpload={handleEquipmentPhotoUpload}
              handleEditEquipment={handleEditEquipment}
              handleUpdateEquipment={handleUpdateEquipment}
              handleAutoSaveEquipment={handleAutoSaveEquipment}
              handleCancelEditEquipment={handleCancelEditEquipment}
              handleDeleteEquipment={handleDeleteEquipment}
              updateEquipmentMutation={updateEquipmentMutation}
              setShowAddEquipment={setShowAddEquipment}
            />
          </div>
        )}

        {/* Photo lightbox */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300"
              onClick={() => setLightboxUrl(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={lightboxUrl}
              alt="Equipment photo"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {completingTask && (
          <LogMaintenanceModal
            completingTask={completingTask}
            completionUsage={completionUsage}
            setCompletionUsage={setCompletionUsage}
            completionCost={completionCost}
            setCompletionCost={setCompletionCost}
            completionNotes={completionNotes}
            setCompletionNotes={setCompletionNotes}
            completionDate={completionDate}
            setCompletionDate={setCompletionDate}
            isHistoricalEntry={isHistoricalEntry}
            setIsHistoricalEntry={setIsHistoricalEntry}
            handleCompleteTask={handleCompleteTask}
            logMaintenanceMutationIsPending={logMaintenanceMutation.isPending}
            onClose={() => {
              setCompletingTask(null);
              setCompletionNotes('');
              setCompletionUsage('');
              setCompletionCost('');
              setCompletionDate('');
              setIsHistoricalEntry(false);
            }}
          />
        )}

        {editingTaskLastServiced && (
          <EditLastServicedModal
            editingTaskLastServiced={editingTaskLastServiced}
            editLastServicedDate={editLastServicedDate}
            setEditLastServicedDate={setEditLastServicedDate}
            handleUpdateLastServiced={handleUpdateLastServiced}
            updateTaskMutationIsPending={updateTaskMutation.isPending}
            onClose={() => {
              setEditingTaskLastServiced(null);
              setEditLastServicedDate('');
            }}
          />
        )}

        {editingTask && (
          <EditTaskModal
            editingTask={editingTask}
            editTaskName={editTaskName}
            setEditTaskName={setEditTaskName}
            editTaskDescription={editTaskDescription}
            setEditTaskDescription={setEditTaskDescription}
            editTaskImageUrl={editTaskImageUrl}
            setEditTaskImageUrl={setEditTaskImageUrl}
            editTaskIntervalType={editTaskIntervalType}
            setEditTaskIntervalType={setEditTaskIntervalType}
            editTaskIntervalDays={editTaskIntervalDays}
            setEditTaskIntervalDays={setEditTaskIntervalDays}
            editTaskIntervalUnits={editTaskIntervalUnits}
            setEditTaskIntervalUnits={setEditTaskIntervalUnits}
            editTaskUsageLabel={editTaskUsageLabel}
            setEditTaskUsageLabel={setEditTaskUsageLabel}
            editTaskEstimatedCost={editTaskEstimatedCost}
            setEditTaskEstimatedCost={setEditTaskEstimatedCost}
            isUploadingEditTaskPhoto={isUploadingEditTaskPhoto}
            handleTaskPhotoUpload={handleTaskPhotoUpload}
            handleSaveEditedTask={handleSaveEditedTask}
            isSaving={isSaving}
            onClose={() => setEditingTask(null)}
          />
        )}
      </main>
      {ConfirmDialog}
    </div>
  );
}
