import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, Award } from 'lucide-react';
import { colors } from '@/lib/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useAllEmployees, type UnifiedEmployee } from '@/hooks/use-all-employees';
import { useCertificationTypes, useCreateTrainingClass, useBulkAddAttendees } from '@/hooks/use-training';

interface TrainingClassFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this employee in the attendee list */
  preselectedEmployeeId?: string;
  onSaved?: () => void;
}

export function TrainingClassForm({ open, onOpenChange, preselectedEmployeeId, onSaved }: TrainingClassFormProps) {
  const { toast } = useToast();
  const { tenant } = useAuth();
  const { data: employees = [] } = useAllEmployees(tenant?.id);
  const { data: certTypes = [] } = useCertificationTypes();
  const createClass = useCreateTrainingClass();
  const bulkAdd = useBulkAddAttendees();

  const [form, setForm] = useState({
    name: '',
    provider: '',
    location: '',
    class_date: '',
    end_date: '',
    duration_hours: '',
    cost: '',
    cost_per_person: false,
    grants_certification: false,
    certification_type_id: '',
    description: '',
    notes: '',
  });

  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (preselectedEmployeeId) s.add(`profile:${preselectedEmployeeId}`);
    return s;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Build a stable employee key for the set
  function empKey(emp: UnifiedEmployee): string {
    return emp.user_profile_id ? `profile:${emp.user_profile_id}` : `tip:${emp.tip_employee_id}`;
  }

  const activeEmployees = useMemo(
    () =>
      employees.filter((e) => {
        const q = searchQuery.toLowerCase();
        return !q || e.name.toLowerCase().includes(q);
      }),
    [employees, searchQuery]
  );

  function toggleEmployee(key: string) {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelectedEmployees(new Set(activeEmployees.map(empKey)));
  }

  function clearAll() {
    setSelectedEmployees(new Set());
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Class name is required', variant: 'destructive' });
      return;
    }
    if (!form.class_date) {
      toast({ title: 'Class date is required', variant: 'destructive' });
      return;
    }
    if (selectedEmployees.size === 0) {
      toast({ title: 'Select at least one attendee', variant: 'destructive' });
      return;
    }
    if (form.grants_certification && !form.certification_type_id) {
      toast({ title: 'Select a certification type', variant: 'destructive' });
      return;
    }

    try {
      // 1. Create the class
      const trainingClass = await createClass.mutateAsync({
        name: form.name.trim(),
        provider: form.provider.trim() || undefined,
        location: form.location.trim() || undefined,
        class_date: form.class_date,
        end_date: form.end_date || null,
        duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        cost_per_person: form.cost_per_person,
        certification_type_id: form.grants_certification ? form.certification_type_id : null,
        description: form.description.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });

      // 2. Bulk-add attendees (and auto-create certs if applicable)
      const attendees = Array.from(selectedEmployees).map((key) => {
        const [source, id] = key.split(':');
        return source === 'profile'
          ? { employee_id: id, tip_employee_id: null }
          : { employee_id: null, tip_employee_id: id };
      });

      const certType = certTypes.find((c) => c.id === form.certification_type_id);
      await bulkAdd.mutateAsync({
        training_class_id: trainingClass.id,
        attendees,
        grants_certification: form.grants_certification,
        certification_type_id: form.grants_certification ? form.certification_type_id : null,
        class_date: form.class_date,
        default_validity_months: certType?.default_validity_months || null,
      });

      toast({
        title: 'Training class created',
        description: `${attendees.length} attendee${attendees.length > 1 ? 's' : ''} added${form.grants_certification ? ' with certifications' : ''}`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: err.message || 'Failed to create training class', variant: 'destructive' });
    }
  }

  const isSaving = createClass.isPending || bulkAdd.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto" style={{ backgroundColor: colors.white }}>
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>Add Training Class</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Class Name */}
          <div>
            <label className="text-sm font-medium" style={{ color: colors.brown }}>
              Class Name *
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Food Safety Training"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
            />
          </div>

          {/* Provider & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Provider
              </label>
              <Input
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="e.g., ServSafe"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Location
              </label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Main store"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Class Date *
              </label>
              <Input
                type="date"
                value={form.class_date}
                onChange={(e) => setForm({ ...form, class_date: e.target.value })}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                End Date
              </label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
          </div>

          {/* Duration & Cost */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Hours
              </label>
              <Input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={form.duration_hours}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setForm({ ...form, duration_hours: v });
                }}
                onFocus={(e) => e.target.select()}
                placeholder="e.g., 8"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Cost ($)
              </label>
              <Input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={form.cost}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setForm({ ...form, cost: v });
                }}
                onFocus={(e) => e.target.select()}
                placeholder="e.g., 150"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                <Checkbox
                  checked={form.cost_per_person}
                  onCheckedChange={(v) => setForm({ ...form, cost_per_person: !!v })}
                />
                Per person
              </label>
            </div>
          </div>

          {/* Grants Certification */}
          <Card style={{ backgroundColor: colors.cream }}>
            <CardContent className="p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: colors.brown }}>
                <Checkbox
                  checked={form.grants_certification}
                  onCheckedChange={(v) => setForm({ ...form, grants_certification: !!v })}
                />
                <Award className="w-4 h-4" style={{ color: colors.gold }} />
                This class grants a certification
              </label>
              {form.grants_certification && (
                <Select
                  value={form.certification_type_id}
                  onValueChange={(v) => setForm({ ...form, certification_type_id: v })}
                >
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                    <SelectValue placeholder="Select certification type" />
                  </SelectTrigger>
                  <SelectContent>
                    {certTypes.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.name}
                        {ct.default_validity_months ? ` (${ct.default_validity_months}mo)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-2" style={{ color: colors.brown }}>
                <Users className="w-4 h-4" style={{ color: colors.gold }} />
                Attendees *
                <Badge style={{ backgroundColor: colors.gold, color: colors.white }} className="ml-1">
                  {selectedEmployees.size}
                </Badge>
              </label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="h-7 px-2 text-xs"
                  style={{ color: colors.brown }}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 px-2 text-xs"
                  style={{ color: colors.brownLight }}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: colors.brownLight }}
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employees..."
                className="pl-8"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>

            {/* Employee list */}
            <div className="border rounded-lg overflow-y-auto max-h-48" style={{ borderColor: colors.creamDark }}>
              {activeEmployees.map((emp) => {
                const key = empKey(emp);
                const checked = selectedEmployees.has(key);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-opacity-50"
                    style={{
                      backgroundColor: checked ? `${colors.gold}15` : 'transparent',
                      borderBottom: `1px solid ${colors.creamDark}`,
                      minHeight: '44px', // iPad touch target
                    }}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleEmployee(key)} />
                    <span className="text-sm flex-1" style={{ color: colors.brown }}>
                      {emp.name}
                    </span>
                    {emp.role && (
                      <Badge
                        variant="outline"
                        className="text-xs capitalize"
                        style={{ borderColor: colors.creamDark, color: colors.brownLight }}
                      >
                        {emp.role}
                      </Badge>
                    )}
                  </label>
                );
              })}
              {activeEmployees.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: colors.brownLight }}>
                  {searchQuery ? 'No employees match' : 'No employees found'}
                </p>
              )}
            </div>
          </div>

          {/* Description / Notes */}
          <div>
            <label className="text-sm font-medium" style={{ color: colors.brown }}>
              Notes
            </label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes about the class"
              rows={2}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              style={{ backgroundColor: colors.gold, color: colors.white }}
            >
              {isSaving ? 'Saving...' : 'Create Training Class'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              style={{ borderColor: colors.gold, color: colors.brown }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
