import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Award, X } from 'lucide-react';
import { colors } from '@/lib/colors';
import {
  useCertificationTypes,
  useCreateCertType,
  useUpdateCertType,
  useDeleteCertType,
  type CertificationType,
} from '@/hooks/use-training';

interface CertTypesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CertTypesManager({ open, onOpenChange }: CertTypesManagerProps) {
  const { toast } = useToast();
  const { data: certTypes = [], isLoading } = useCertificationTypes();
  const createMutation = useCreateCertType();
  const updateMutation = useUpdateCertType();
  const deleteMutation = useDeleteCertType();

  const [editing, setEditing] = useState<CertificationType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', default_validity_months: '', issuing_body: '' });

  function resetForm() {
    setForm({ name: '', description: '', default_validity_months: '', issuing_body: '' });
    setEditing(null);
    setShowForm(false);
  }

  function openEdit(ct: CertificationType) {
    setEditing(ct);
    setForm({
      name: ct.name,
      description: ct.description || '',
      default_validity_months: ct.default_validity_months?.toString() || '',
      issuing_body: ct.issuing_body || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const months = form.default_validity_months ? parseInt(form.default_validity_months, 10) : null;
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          default_validity_months: months,
          issuing_body: form.issuing_body.trim() || null,
        });
        toast({ title: 'Certification type updated' });
      } else {
        await createMutation.mutateAsync({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          default_validity_months: months,
          issuing_body: form.issuing_body.trim() || undefined,
        });
        toast({ title: 'Certification type created' });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: err.message || 'Failed to save', variant: 'destructive' });
    }
  }

  async function handleDelete(ct: CertificationType) {
    try {
      await deleteMutation.mutateAsync(ct.id);
      toast({ title: `"${ct.name}" removed` });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to delete', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" style={{ backgroundColor: colors.white }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
            <Award className="w-5 h-5" style={{ color: colors.gold }} />
            Manage Certification Types
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* List */}
          {certTypes.length === 0 && !isLoading && (
            <p className="text-sm text-center py-4" style={{ color: colors.brownLight }}>
              No certification types yet. Add one to get started.
            </p>
          )}
          {certTypes.map((ct) => (
            <Card key={ct.id} style={{ backgroundColor: colors.cream }}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: colors.brown }}>{ct.name}</p>
                  <div className="flex gap-3 text-xs" style={{ color: colors.brownLight }}>
                    {ct.issuing_body && <span>{ct.issuing_body}</span>}
                    {ct.default_validity_months && <span>{ct.default_validity_months} months</span>}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(ct)} className="h-8 w-8 p-0">
                    <Pencil className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(ct)}
                    disabled={deleteMutation.isPending}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: colors.red }} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Form */}
          {showForm ? (
            <div className="space-y-3 border rounded-lg p-3" style={{ borderColor: colors.gold }}>
              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Food Safety Handler"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>
              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>Issuing Body</label>
                <Input
                  value={form.issuing_body}
                  onChange={(e) => setForm({ ...form, issuing_body: e.target.value })}
                  placeholder="e.g., ServSafe"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>
              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>Validity (months)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.default_validity_months}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*$/.test(v)) setForm({ ...form, default_validity_months: v });
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="e.g., 24"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>
              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>Description</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {editing ? 'Update' : 'Add'}
                </Button>
                <Button variant="outline" onClick={resetForm} style={{ borderColor: colors.gold, color: colors.brown }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              className="w-full"
              style={{ borderColor: colors.gold, color: colors.brown }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Certification Type
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
