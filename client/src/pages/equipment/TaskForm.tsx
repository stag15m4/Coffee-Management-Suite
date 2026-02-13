import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhotoCapture } from '@/components/PhotoCapture';
import { colors } from '@/lib/colors';
import type { Equipment } from '@/lib/supabase-queries';

interface TaskFormProps {
  equipment: Equipment[];
  newTaskEquipmentId: string;
  setNewTaskEquipmentId: (v: string) => void;
  newTaskName: string;
  setNewTaskName: (v: string) => void;
  newTaskDescription: string;
  setNewTaskDescription: (v: string) => void;
  newTaskIntervalType: 'time' | 'usage';
  setNewTaskIntervalType: (v: 'time' | 'usage') => void;
  newTaskIntervalDays: string;
  setNewTaskIntervalDays: (v: string) => void;
  newTaskIntervalUnits: string;
  setNewTaskIntervalUnits: (v: string) => void;
  newTaskUsageLabel: string;
  setNewTaskUsageLabel: (v: string) => void;
  newTaskLastServiced: string;
  setNewTaskLastServiced: (v: string) => void;
  newTaskEstimatedCost: string;
  setNewTaskEstimatedCost: (v: string) => void;
  newTaskImageUrl: string;
  setNewTaskImageUrl: (v: string) => void;
  isUploadingNewTaskPhoto: boolean;
  handleTaskPhotoUpload: (file: File, mode: 'new' | 'edit') => Promise<void>;
  handleAddTask: () => Promise<void>;
  addTaskMutationIsPending: boolean;
  setShowAddTask: (show: boolean) => void;
}

export function TaskForm({
  equipment,
  newTaskEquipmentId,
  setNewTaskEquipmentId,
  newTaskName,
  setNewTaskName,
  newTaskDescription,
  setNewTaskDescription,
  newTaskIntervalType,
  setNewTaskIntervalType,
  newTaskIntervalDays,
  setNewTaskIntervalDays,
  newTaskIntervalUnits,
  setNewTaskIntervalUnits,
  newTaskUsageLabel,
  setNewTaskUsageLabel,
  newTaskLastServiced,
  setNewTaskLastServiced,
  newTaskEstimatedCost,
  setNewTaskEstimatedCost,
  newTaskImageUrl,
  setNewTaskImageUrl,
  isUploadingNewTaskPhoto,
  handleTaskPhotoUpload,
  handleAddTask,
  addTaskMutationIsPending,
  setShowAddTask,
}: TaskFormProps) {
  return (
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
          <Label style={{ color: colors.brown }}>Task Photo</Label>
          <p className="text-xs mb-1" style={{ color: colors.brownLight }}>Optional — use a specific photo for this task (e.g. burr assembly) instead of the equipment photo</p>
          <PhotoCapture
            currentPhotoUrl={newTaskImageUrl || null}
            onPhotoSelected={async (file) => handleTaskPhotoUpload(file, 'new')}
            onPhotoRemoved={() => setNewTaskImageUrl('')}
            isUploading={isUploadingNewTaskPhoto}
            shape="square"
            size={80}
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
                inputMode="numeric"
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
                inputMode="numeric"
              />
            </div>
          </>
        )}

        <div>
          <Label style={{ color: colors.brown }}>Estimated Cost</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: colors.brownLight }}>$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newTaskEstimatedCost}
              onChange={e => setNewTaskEstimatedCost(e.target.value)}
              placeholder="0.00"
              className="pl-7"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
              data-testid="input-estimated-cost"
              inputMode="decimal"
            />
          </div>
          <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
            Approximate cost for expense forecasting
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleAddTask}
            disabled={addTaskMutationIsPending}
            style={{ backgroundColor: colors.gold, color: colors.white }}
            data-testid="button-save-task"
          >
            {addTaskMutationIsPending ? 'Saving...' : 'Save Task'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowAddTask(false);
              setNewTaskEquipmentId('');
              setNewTaskName('');
              setNewTaskDescription('');
              setNewTaskImageUrl('');
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
  );
}
