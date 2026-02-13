import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhotoCapture } from '@/components/PhotoCapture';
import { colors } from '@/lib/colors';
import type { MaintenanceTask } from '@/lib/supabase-queries';

// ── Log Maintenance (mark-as-done) modal ─────────────────────────

interface LogMaintenanceModalProps {
  completingTask: MaintenanceTask;
  completionUsage: string;
  setCompletionUsage: (v: string) => void;
  completionCost: string;
  setCompletionCost: (v: string) => void;
  completionNotes: string;
  setCompletionNotes: (v: string) => void;
  completionDate: string;
  setCompletionDate: (v: string) => void;
  isHistoricalEntry: boolean;
  setIsHistoricalEntry: (v: boolean) => void;
  handleCompleteTask: () => Promise<void>;
  logMaintenanceMutationIsPending: boolean;
  onClose: () => void;
}

export function LogMaintenanceModal({
  completingTask,
  completionUsage,
  setCompletionUsage,
  completionCost,
  setCompletionCost,
  completionNotes,
  setCompletionNotes,
  completionDate,
  setCompletionDate,
  isHistoricalEntry,
  setIsHistoricalEntry,
  handleCompleteTask,
  logMaintenanceMutationIsPending,
  onClose,
}: LogMaintenanceModalProps) {
  return (
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
                inputMode="numeric"
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
              inputMode="decimal"
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
              disabled={logMaintenanceMutationIsPending}
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-confirm-completion"
            >
              {logMaintenanceMutationIsPending ? 'Saving...' : 'Mark Complete'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-cancel-completion"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Edit Last Serviced Date modal ────────────────────────────────

interface EditLastServicedModalProps {
  editingTaskLastServiced: MaintenanceTask;
  editLastServicedDate: string;
  setEditLastServicedDate: (v: string) => void;
  handleUpdateLastServiced: () => Promise<void>;
  updateTaskMutationIsPending: boolean;
  onClose: () => void;
}

export function EditLastServicedModal({
  editingTaskLastServiced,
  editLastServicedDate,
  setEditLastServicedDate,
  handleUpdateLastServiced,
  updateTaskMutationIsPending,
  onClose,
}: EditLastServicedModalProps) {
  return (
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
              disabled={updateTaskMutationIsPending}
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-save-last-serviced"
            >
              {updateTaskMutationIsPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-cancel-edit-last-serviced"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Edit Task modal ──────────────────────────────────────────────

interface EditTaskModalProps {
  editingTask: MaintenanceTask;
  editTaskName: string;
  setEditTaskName: (v: string) => void;
  editTaskDescription: string;
  setEditTaskDescription: (v: string) => void;
  editTaskImageUrl: string | null;
  setEditTaskImageUrl: (v: string | null) => void;
  editTaskIntervalType: 'time' | 'usage';
  setEditTaskIntervalType: (v: 'time' | 'usage') => void;
  editTaskIntervalDays: string;
  setEditTaskIntervalDays: (v: string) => void;
  editTaskIntervalUnits: string;
  setEditTaskIntervalUnits: (v: string) => void;
  editTaskUsageLabel: string;
  setEditTaskUsageLabel: (v: string) => void;
  editTaskEstimatedCost: string;
  setEditTaskEstimatedCost: (v: string) => void;
  isUploadingEditTaskPhoto: boolean;
  handleTaskPhotoUpload: (file: File, mode: 'new' | 'edit') => Promise<void>;
  handleSaveEditedTask: () => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

export function EditTaskModal({
  editingTask,
  editTaskName,
  setEditTaskName,
  editTaskDescription,
  setEditTaskDescription,
  editTaskImageUrl,
  setEditTaskImageUrl,
  editTaskIntervalType,
  setEditTaskIntervalType,
  editTaskIntervalDays,
  setEditTaskIntervalDays,
  editTaskIntervalUnits,
  setEditTaskIntervalUnits,
  editTaskUsageLabel,
  setEditTaskUsageLabel,
  editTaskEstimatedCost,
  setEditTaskEstimatedCost,
  isUploadingEditTaskPhoto,
  handleTaskPhotoUpload,
  handleSaveEditedTask,
  isSaving,
  onClose,
}: EditTaskModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }} className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={{ color: colors.brown }}>Edit Maintenance Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Equipment: {editingTask.equipment?.name}
            </p>
          </div>

          <div>
            <Label style={{ color: colors.brown }}>Task Name *</Label>
            <Input
              value={editTaskName}
              onChange={e => setEditTaskName(e.target.value)}
              placeholder="e.g., Clean burrs, Descale"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
              data-testid="input-edit-task-name"
            />
          </div>

          <div>
            <Label style={{ color: colors.brown }}>Description</Label>
            <Input
              value={editTaskDescription}
              onChange={e => setEditTaskDescription(e.target.value)}
              placeholder="Optional details"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
              data-testid="input-edit-task-description"
            />
          </div>

          <div>
            <Label style={{ color: colors.brown }}>Task Photo</Label>
            <p className="text-xs mb-1" style={{ color: colors.brownLight }}>Optional — use a specific photo for this task instead of the equipment photo</p>
            <PhotoCapture
              currentPhotoUrl={editTaskImageUrl}
              onPhotoSelected={async (file) => handleTaskPhotoUpload(file, 'edit')}
              onPhotoRemoved={() => setEditTaskImageUrl(null)}
              isUploading={isUploadingEditTaskPhoto}
              shape="square"
              size={80}
            />
          </div>

          <div>
            <Label style={{ color: colors.brown }}>Interval Type</Label>
            <Select value={editTaskIntervalType} onValueChange={(v: 'time' | 'usage') => setEditTaskIntervalType(v)}>
              <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }} data-testid="select-edit-task-interval-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="time">Time-based (every X days)</SelectItem>
                <SelectItem value="usage">Usage-based (every X units)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {editTaskIntervalType === 'time' ? (
            <div>
              <Label style={{ color: colors.brown }}>Interval (days) *</Label>
              <Input
                type="number"
                value={editTaskIntervalDays}
                onChange={e => setEditTaskIntervalDays(e.target.value)}
                placeholder="e.g., 14"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-edit-task-interval-days"
                inputMode="numeric"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label style={{ color: colors.brown }}>Unit Label *</Label>
                <Input
                  value={editTaskUsageLabel}
                  onChange={e => setEditTaskUsageLabel(e.target.value)}
                  placeholder="e.g., lbs, shots"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-edit-task-usage-label"
                />
              </div>
              <div>
                <Label style={{ color: colors.brown }}>Interval *</Label>
                <Input
                  type="number"
                  value={editTaskIntervalUnits}
                  onChange={e => setEditTaskIntervalUnits(e.target.value)}
                  placeholder="e.g., 1000"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-edit-task-interval-units"
                  inputMode="numeric"
                />
              </div>
            </div>
          )}

          <div>
            <Label style={{ color: colors.brown }}>Estimated Cost ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={editTaskEstimatedCost}
              onChange={e => setEditTaskEstimatedCost(e.target.value)}
              placeholder="e.g., 25.00"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
              data-testid="input-edit-task-estimated-cost"
              inputMode="decimal"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveEditedTask}
              disabled={isSaving}
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-save-edit-task"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="button-cancel-edit-task"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
