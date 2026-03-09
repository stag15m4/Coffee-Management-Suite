import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  Settings,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import {
  useTimeOffPolicies,
  useCreateTimeOffPolicy,
  useUpdateTimeOffPolicy,
  useDeleteTimeOffPolicy,
  type TimeOffPolicy,
  type InsertTimeOffPolicy,
  type PolicyType,
  type GrantMethod,
  type CarryoverType,
  type TimeOffCategory,
  type MilestoneTier,
} from '@/hooks/use-time-off-policies';
import { colors } from '@/lib/colors';

const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  none: 'No PTO',
  accrual: 'Accrual (Earn per Hours Worked)',
  fixed_annual: 'Fixed Annual Grant',
  milestone: 'Milestone-Based Accrual',
};

const CATEGORY_OPTIONS: { value: TimeOffCategory; label: string }[] = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'other', label: 'Other' },
];

const CARRYOVER_LABELS: Record<CarryoverType, string> = {
  none: 'Use It or Lose It',
  unlimited: 'Unlimited Rollover',
  capped: 'Rollover with Cap',
};

function getDefaultFormData(): InsertTimeOffPolicy & { milestone_tiers: MilestoneTier[] } {
  return {
    name: '',
    policy_type: 'accrual',
    categories: ['vacation'],
    accrual_hours: 1,
    accrual_per_hours_worked: 8,
    annual_hours: 40,
    grant_method: 'upfront' as GrantMethod,
    milestone_tiers: [],
    max_balance_hours: null,
    carryover_type: 'none' as CarryoverType,
    carryover_max_hours: 0,
    waiting_period_days: 0,
    eligible_roles: [],
  };
}

export function PolicyBuilder() {
  const { data: policies, isLoading } = useTimeOffPolicies();
  const createPolicy = useCreateTimeOffPolicy();
  const updatePolicy = useUpdateTimeOffPolicy();
  const deletePolicy = useDeleteTimeOffPolicy();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState(getDefaultFormData());

  const resetForm = useCallback(() => {
    setFormData(getDefaultFormData());
    setEditingId(null);
    setShowForm(false);
  }, []);

  const openEdit = useCallback((policy: TimeOffPolicy) => {
    setEditingId(policy.id);
    setFormData({
      name: policy.name,
      policy_type: policy.policy_type,
      categories: policy.categories,
      accrual_hours: policy.accrual_hours,
      accrual_per_hours_worked: policy.accrual_per_hours_worked,
      annual_hours: policy.annual_hours,
      grant_method: policy.grant_method,
      milestone_tiers: policy.milestone_tiers || [],
      max_balance_hours: policy.max_balance_hours,
      carryover_type: policy.carryover_type,
      carryover_max_hours: policy.carryover_max_hours,
      waiting_period_days: policy.waiting_period_days,
      eligible_roles: policy.eligible_roles,
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Policy name is required', variant: 'destructive' });
      return;
    }

    try {
      if (editingId) {
        await updatePolicy.mutateAsync({ id: editingId, updates: formData });
        toast({ title: 'Policy updated' });
      } else {
        await createPolicy.mutateAsync(formData);
        toast({ title: 'Policy created' });
      }
      resetForm();
    } catch {
      toast({ title: 'Error', description: 'Failed to save policy.', variant: 'destructive' });
    }
  }, [formData, editingId, createPolicy, updatePolicy, toast, resetForm]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deletePolicy.mutateAsync(id);
      toast({ title: 'Policy deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete policy. It may have balances assigned.', variant: 'destructive' });
    }
  }, [deletePolicy, toast]);

  const toggleCategory = useCallback((cat: TimeOffCategory) => {
    setFormData((f) => ({
      ...f,
      categories: f.categories?.includes(cat)
        ? (f.categories.filter((c) => c !== cat).length === 0 ? [cat] : f.categories.filter((c) => c !== cat))
        : [...(f.categories || []), cat],
    }));
  }, []);

  const addMilestoneTier = useCallback(() => {
    setFormData((f) => ({
      ...f,
      milestone_tiers: [...(f.milestone_tiers || []), { after_months: 12, accrual_hours: 1, accrual_per_hours_worked: 20 }],
    }));
  }, []);

  const updateMilestoneTier = useCallback((idx: number, field: keyof MilestoneTier, value: number) => {
    setFormData((f) => ({
      ...f,
      milestone_tiers: f.milestone_tiers.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }));
  }, []);

  const removeMilestoneTier = useCallback((idx: number) => {
    setFormData((f) => ({
      ...f,
      milestone_tiers: f.milestone_tiers.filter((_, i) => i !== idx),
    }));
  }, []);

  const policyTypeSummary = (p: TimeOffPolicy): string => {
    switch (p.policy_type) {
      case 'none':
        return 'No PTO accrual';
      case 'accrual':
        return `Earn ${p.accrual_hours}h per ${p.accrual_per_hours_worked}h worked`;
      case 'fixed_annual':
        return `${p.annual_hours}h/year (${p.grant_method === 'upfront' ? 'granted upfront' : 'per pay period'})`;
      case 'milestone': {
        const tiers = p.milestone_tiers || [];
        return tiers.length === 0
          ? 'Milestone-based (no tiers set)'
          : `${tiers.length} tier${tiers.length > 1 ? 's' : ''} based on tenure`;
      }
      default:
        return p.policy_type;
    }
  };

  if (isLoading) return null;

  return (
    <Card style={{ backgroundColor: colors.white }}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
          <Settings className="w-5 h-5" style={{ color: colors.gold }} />
          Time-Off Policies
        </CardTitle>
        <Button
          size="sm"
          onClick={() => { resetForm(); setShowForm(true); }}
          style={{ backgroundColor: colors.gold, color: colors.white }}
        >
          <Plus className="w-4 h-4 mr-1" /> New Policy
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Policy Form */}
        {showForm && (
          <Card style={{ backgroundColor: colors.cream }}>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label style={{ color: colors.brown }}>Policy Name <span style={{ color: colors.red }}>*</span></Label>
                <Input
                  value={formData.name}
                  placeholder='e.g. "Standard PTO", "Sick Leave"'
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: colors.brown }}>Policy Type</Label>
                <Select
                  value={formData.policy_type}
                  onValueChange={(v) => setFormData((f) => ({ ...f, policy_type: v as PolicyType }))}
                >
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POLICY_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categories this policy covers */}
              <div className="space-y-1.5">
                <Label style={{ color: colors.brown }}>Applies to Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <Badge
                      key={cat.value}
                      variant="outline"
                      className="cursor-pointer select-none"
                      onClick={() => toggleCategory(cat.value)}
                      style={
                        formData.categories?.includes(cat.value)
                          ? { backgroundColor: colors.gold, color: '#fff', borderColor: colors.gold }
                          : { borderColor: colors.creamDark, color: colors.brownLight }
                      }
                    >
                      {cat.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Accrual-specific fields */}
              {formData.policy_type === 'accrual' && (
                <div className="p-3 rounded-lg space-y-3" style={{ backgroundColor: colors.white }}>
                  <p className="text-sm font-medium" style={{ color: colors.brown }}>Accrual Rate</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm" style={{ color: colors.brownLight }}>Earn</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      value={formData.accrual_hours ?? 1}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setFormData((f) => ({ ...f, accrual_hours: v === '' ? 0 : Number(v) })); }}
                      className="w-20"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                    <span className="text-sm" style={{ color: colors.brownLight }}>hour(s) for every</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.accrual_per_hours_worked ?? 8}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setFormData((f) => ({ ...f, accrual_per_hours_worked: v === '' ? 1 : Number(v) })); }}
                      className="w-20"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                    <span className="text-sm" style={{ color: colors.brownLight }}>hours worked</span>
                  </div>
                </div>
              )}

              {/* Fixed annual fields */}
              {formData.policy_type === 'fixed_annual' && (
                <div className="p-3 rounded-lg space-y-3" style={{ backgroundColor: colors.white }}>
                  <p className="text-sm font-medium" style={{ color: colors.brown }}>Annual Grant</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.annual_hours ?? 40}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setFormData((f) => ({ ...f, annual_hours: v === '' ? 0 : Number(v) })); }}
                      className="w-24"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                    <span className="text-sm" style={{ color: colors.brownLight }}>hours per year</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label style={{ color: colors.brown }}>Grant Method</Label>
                    <Select
                      value={formData.grant_method}
                      onValueChange={(v) => setFormData((f) => ({ ...f, grant_method: v as GrantMethod }))}
                    >
                      <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upfront">All at once (start of year)</SelectItem>
                        <SelectItem value="per_pay_period">Split across pay periods</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Milestone fields */}
              {formData.policy_type === 'milestone' && (
                <div className="p-3 rounded-lg space-y-3" style={{ backgroundColor: colors.white }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: colors.brown }}>Tenure-Based Tiers</p>
                    <Button size="sm" variant="outline" onClick={addMilestoneTier}
                      style={{ borderColor: colors.gold, color: colors.brown }}>
                      <Plus className="w-3 h-3 mr-1" /> Add Tier
                    </Button>
                  </div>
                  {formData.milestone_tiers.length === 0 && (
                    <p className="text-xs" style={{ color: colors.brownLight }}>
                      Add tiers to define how accrual rates change based on employee tenure.
                    </p>
                  )}
                  {formData.milestone_tiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap p-2 rounded" style={{ backgroundColor: colors.cream }}>
                      <span className="text-xs" style={{ color: colors.brownLight }}>After</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={tier.after_months}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) updateMilestoneTier(idx, 'after_months', v === '' ? 0 : Number(v)); }}
                        className="w-16 h-8 text-sm"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                      />
                      <span className="text-xs" style={{ color: colors.brownLight }}>months: earn</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        value={tier.accrual_hours}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateMilestoneTier(idx, 'accrual_hours', v === '' ? 0 : Number(v)); }}
                        className="w-16 h-8 text-sm"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                      />
                      <span className="text-xs" style={{ color: colors.brownLight }}>h per</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={tier.accrual_per_hours_worked}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) updateMilestoneTier(idx, 'accrual_per_hours_worked', v === '' ? 1 : Number(v)); }}
                        className="w-16 h-8 text-sm"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                      />
                      <span className="text-xs" style={{ color: colors.brownLight }}>h worked</span>
                      <Button variant="ghost" size="sm" onClick={() => removeMilestoneTier(idx)}
                        className="h-8 w-8 p-0" style={{ color: colors.red }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* None type — just show explanation */}
              {formData.policy_type === 'none' && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: colors.white }}>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    No PTO will be accrued for this policy. Employees will not accumulate time-off hours.
                    Use this if your shop does not offer paid time off.
                  </p>
                </div>
              )}

              {/* Common fields for non-none types */}
              {formData.policy_type !== 'none' && (
                <>
                  {/* Balance cap */}
                  <div className="space-y-1.5">
                    <Label style={{ color: colors.brown }}>Maximum Balance (hours)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.max_balance_hours ?? ''}
                        placeholder="No cap"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setFormData((f) => ({ ...f, max_balance_hours: v === '' ? null : Number(v) })); }}
                        className="w-32"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      />
                      <span className="text-xs" style={{ color: colors.brownLight }}>Leave empty for no limit</span>
                    </div>
                  </div>

                  {/* Carryover */}
                  <div className="space-y-1.5">
                    <Label style={{ color: colors.brown }}>Year-End Carryover</Label>
                    <Select
                      value={formData.carryover_type}
                      onValueChange={(v) => setFormData((f) => ({ ...f, carryover_type: v as CarryoverType }))}
                    >
                      <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CARRYOVER_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.carryover_type === 'capped' && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm" style={{ color: colors.brownLight }}>Max rollover:</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={formData.carryover_max_hours ?? 0}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setFormData((f) => ({ ...f, carryover_max_hours: v === '' ? 0 : Number(v) })); }}
                          className="w-24"
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                        />
                        <span className="text-sm" style={{ color: colors.brownLight }}>hours</span>
                      </div>
                    )}
                  </div>

                  {/* Waiting period */}
                  <div className="space-y-1.5">
                    <Label style={{ color: colors.brown }}>Waiting Period</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.waiting_period_days ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setFormData((f) => ({ ...f, waiting_period_days: v === '' ? 0 : Number(v) })); }}
                        className="w-24"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      />
                      <span className="text-sm" style={{ color: colors.brownLight }}>days after hire before accrual starts</span>
                    </div>
                  </div>
                </>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={createPolicy.isPending || updatePolicy.isPending}
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {editingId ? 'Update Policy' : 'Create Policy'}
                </Button>
                <Button variant="outline" onClick={resetForm}
                  style={{ borderColor: colors.creamDark, color: colors.brown }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Policies List */}
        {(!policies || policies.length === 0) ? (
          <div className="py-6 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: colors.creamDark }} />
            <p className="text-sm" style={{ color: colors.brownLight }}>
              No time-off policies configured yet.
            </p>
            <p className="text-xs mt-1" style={{ color: colors.creamDark }}>
              Create a policy to define how your team earns and uses time off.
            </p>
          </div>
        ) : (
          policies.map((p) => (
            <div key={p.id} className="rounded-lg overflow-hidden" style={{ backgroundColor: colors.cream }}>
              <div
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium" style={{ color: colors.brown }}>{p.name}</p>
                    <Badge variant="outline" style={{
                      borderColor: p.is_active ? colors.green : colors.creamDark,
                      color: p.is_active ? colors.green : colors.brownLight,
                    }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline" style={{ borderColor: colors.gold, color: colors.gold }}>
                      {POLICY_TYPE_LABELS[p.policy_type]}
                    </Badge>
                  </div>
                  <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                    {policyTypeSummary(p)}
                  </p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {p.categories.map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: colors.creamDark, color: colors.brownLight }}>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                {expandedId === p.id ? (
                  <ChevronUp className="w-4 h-4 shrink-0" style={{ color: colors.brownLight }} />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0" style={{ color: colors.brownLight }} />
                )}
              </div>

              {expandedId === p.id && (
                <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: colors.creamDark }}>
                  {p.policy_type !== 'none' && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2" style={{ color: colors.brownLight }}>
                      {p.max_balance_hours !== null && (
                        <>
                          <span>Max balance:</span>
                          <span style={{ color: colors.brown }}>{p.max_balance_hours}h</span>
                        </>
                      )}
                      <span>Carryover:</span>
                      <span style={{ color: colors.brown }}>
                        {CARRYOVER_LABELS[p.carryover_type]}
                        {p.carryover_type === 'capped' && ` (${p.carryover_max_hours}h)`}
                      </span>
                      {p.waiting_period_days > 0 && (
                        <>
                          <span>Waiting period:</span>
                          <span style={{ color: colors.brown }}>{p.waiting_period_days} days</span>
                        </>
                      )}
                    </div>
                  )}
                  {p.policy_type === 'milestone' && p.milestone_tiers.length > 0 && (
                    <div className="text-xs space-y-1 pt-1">
                      <p className="font-medium" style={{ color: colors.brown }}>Tiers:</p>
                      {p.milestone_tiers
                        .sort((a, b) => a.after_months - b.after_months)
                        .map((t, i) => (
                          <p key={i} style={{ color: colors.brownLight }}>
                            After {t.after_months} months: {t.accrual_hours}h per {t.accrual_per_hours_worked}h worked
                          </p>
                        ))
                      }
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}
                      style={{ borderColor: colors.gold, color: colors.brown }}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updatePolicy.mutate({
                        id: p.id,
                        updates: { is_active: !p.is_active },
                      })}
                      style={{ borderColor: colors.creamDark, color: colors.brownLight }}
                    >
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}
                      disabled={deletePolicy.isPending}
                      style={{ color: colors.red }}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
