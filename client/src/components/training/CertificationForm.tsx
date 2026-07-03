import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText } from 'lucide-react';
import { colors } from '@/lib/colors';
import { useUpload } from '@/hooks/use-upload';
import { ObjectUploader } from '@/components/ObjectUploader';
import {
  useCertificationTypes,
  useCreateCertification,
  useUpdateCertification,
  type EmployeeCertification,
} from '@/hooks/use-training';

interface CertificationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  existing?: EmployeeCertification | null;
  onSaved?: () => void;
}

export function CertificationForm({ open, onOpenChange, employeeId, existing, onSaved }: CertificationFormProps) {
  const { toast } = useToast();
  const { data: certTypes = [] } = useCertificationTypes();
  const createMutation = useCreateCertification();
  const updateMutation = useUpdateCertification();
  const { getUploadParameters } = useUpload();

  const [form, setForm] = useState(() => ({
    certification_type_id: existing?.certification_type_id || '',
    issue_date: existing?.issue_date || '',
    expiry_date: existing?.expiry_date || '',
    certificate_number: existing?.certificate_number || '',
    document_url: existing?.document_url || '',
    notes: existing?.notes || '',
    status: existing?.status || 'active',
  }));

  // When cert type changes, auto-fill expiry if issue_date exists
  function handleCertTypeChange(certTypeId: string) {
    setForm((prev) => {
      const ct = certTypes.find((c) => c.id === certTypeId);
      let expiry = prev.expiry_date;
      if (ct?.default_validity_months && prev.issue_date) {
        const d = new Date(prev.issue_date + 'T00:00:00');
        d.setMonth(d.getMonth() + ct.default_validity_months);
        expiry = d.toISOString().split('T')[0];
      }
      return { ...prev, certification_type_id: certTypeId, expiry_date: expiry };
    });
  }

  function handleIssueDateChange(date: string) {
    setForm((prev) => {
      const ct = certTypes.find((c) => c.id === prev.certification_type_id);
      let expiry = prev.expiry_date;
      if (ct?.default_validity_months && date) {
        const d = new Date(date + 'T00:00:00');
        d.setMonth(d.getMonth() + ct.default_validity_months);
        expiry = d.toISOString().split('T')[0];
      }
      return { ...prev, issue_date: date, expiry_date: expiry };
    });
  }

  async function handleSave() {
    if (!form.certification_type_id) {
      toast({ title: 'Select a certification type', variant: 'destructive' });
      return;
    }
    if (!form.issue_date) {
      toast({ title: 'Issue date is required', variant: 'destructive' });
      return;
    }
    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          certification_type_id: form.certification_type_id,
          issue_date: form.issue_date,
          expiry_date: form.expiry_date || null,
          certificate_number: form.certificate_number.trim() || null,
          document_url: form.document_url || null,
          notes: form.notes.trim() || null,
          status: form.status as any,
        });
        toast({ title: 'Certification updated' });
      } else {
        await createMutation.mutateAsync({
          certification_type_id: form.certification_type_id,
          employee_id: employeeId,
          issue_date: form.issue_date,
          expiry_date: form.expiry_date || null,
          certificate_number: form.certificate_number.trim() || null,
          document_url: form.document_url || null,
          notes: form.notes.trim() || null,
        });
        toast({ title: 'Certification added' });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: err.message || 'Failed to save', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" style={{ backgroundColor: colors.white }}>
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>
            {existing ? 'Edit Certification' : 'Add Certification'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cert Type */}
          <div>
            <label className="text-sm font-medium" style={{ color: colors.brown }}>
              Certification Type *
            </label>
            <Select value={form.certification_type_id} onValueChange={handleCertTypeChange}>
              <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                <SelectValue placeholder="Select certification type" />
              </SelectTrigger>
              <SelectContent>
                {certTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                    {ct.issuing_body ? ` (${ct.issuing_body})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Issue Date *
              </label>
              <Input
                type="date"
                value={form.issue_date}
                onChange={(e) => handleIssueDateChange(e.target.value)}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Expiry Date
              </label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
              />
            </div>
          </div>

          {/* Certificate Number */}
          <div>
            <label className="text-sm font-medium" style={{ color: colors.brown }}>
              Certificate Number
            </label>
            <Input
              value={form.certificate_number}
              onChange={(e) => setForm({ ...form, certificate_number: e.target.value })}
              placeholder="e.g., FSH-2026-12345"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
            />
          </div>

          {/* Document Upload */}
          <div>
            <label className="text-sm font-medium" style={{ color: colors.brown }}>
              Certificate Document
            </label>
            {form.document_url ? (
              <div className="flex items-center gap-2 mt-1">
                <FileText className="w-4 h-4" style={{ color: colors.gold }} />
                <a
                  href={form.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline flex-1 truncate"
                  style={{ color: colors.brown }}
                >
                  View document
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, document_url: '' })}
                  className="h-7 px-2"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10 * 1024 * 1024}
                onGetUploadParameters={getUploadParameters}
                onComplete={(result) => {
                  const file = result.successful?.[0];
                  if (file) {
                    // The objectPath is set via the upload response
                    const url = (file.response?.body as any)?.objectPath || file.uploadURL;
                    setForm((prev) => ({ ...prev, document_url: url }));
                  }
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Certificate
              </ObjectUploader>
            )}
          </div>

          {/* Status (edit only) */}
          {existing && (
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>
                Status
              </label>
              <Select
                value={form.status}
                onValueChange={(v: 'active' | 'expired' | 'revoked' | 'pending_renewal') =>
                  setForm({ ...form, status: v })
                }
              >
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium" style={{ color: colors.brown }}>
              Notes
            </label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes"
              rows={2}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              style={{ backgroundColor: colors.gold, color: colors.white }}
            >
              {existing ? 'Update' : 'Add Certification'}
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
