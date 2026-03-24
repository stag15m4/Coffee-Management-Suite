import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Award, GraduationCap, Plus, Pencil, Trash2, Settings, FileText, Calendar } from 'lucide-react';
import { colors } from '@/lib/colors';
import {
  useEmployeeCertifications,
  useEmployeeTrainingHistory,
  useDeleteCertification,
  type EmployeeCertification,
} from '@/hooks/use-training';
import { CertificationForm } from './CertificationForm';
import { TrainingClassForm } from './TrainingClassForm';
import { CertTypesManager } from './CertTypesManager';

interface TrainingSectionProps {
  employeeId: string;
  canEdit: boolean;
}

function getCertStatusColor(cert: EmployeeCertification): { bg: string; text: string; label: string } {
  if (cert.status === 'revoked') return { bg: '#DC2626', text: colors.white, label: 'Revoked' };
  if (cert.status === 'expired') return { bg: colors.red, text: colors.white, label: 'Expired' };
  if (cert.status === 'pending_renewal') return { bg: '#F59E0B', text: colors.white, label: 'Pending Renewal' };

  // Check if expiring soon (within 90 days)
  if (cert.expiry_date) {
    const now = new Date();
    const expiry = new Date(cert.expiry_date + 'T00:00:00');
    const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { bg: colors.red, text: colors.white, label: 'Expired' };
    if (daysUntil <= 30) return { bg: '#DC2626', text: colors.white, label: `${daysUntil}d left` };
    if (daysUntil <= 90) return { bg: '#F59E0B', text: colors.white, label: `${daysUntil}d left` };
  }

  return { bg: '#16A34A', text: colors.white, label: 'Active' };
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TrainingSection({ employeeId, canEdit }: TrainingSectionProps) {
  const { toast } = useToast();
  const { data: certifications = [], isLoading: certsLoading } = useEmployeeCertifications(employeeId);
  const { data: trainingHistory = [], isLoading: trainingLoading } = useEmployeeTrainingHistory(employeeId);
  const deleteCert = useDeleteCertification();

  const [showCertForm, setShowCertForm] = useState(false);
  const [editingCert, setEditingCert] = useState<EmployeeCertification | null>(null);
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [showCertTypes, setShowCertTypes] = useState(false);

  async function handleDeleteCert(cert: EmployeeCertification) {
    try {
      await deleteCert.mutateAsync(cert.id);
      toast({ title: 'Certification removed' });
    } catch (err: any) {
      toast({ title: err.message || 'Failed to delete', variant: 'destructive' });
    }
  }

  const isLoading = certsLoading || trainingLoading;

  return (
    <div className="border-t pt-4" style={{ borderColor: colors.creamDark }}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold flex items-center gap-2" style={{ color: colors.brown }}>
          <GraduationCap className="w-4 h-4" style={{ color: colors.gold }} />
          Training & Certifications
        </h4>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCertTypes(true)}
            className="h-7 px-2"
            title="Manage Certification Types"
          >
            <Settings className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
          </Button>
        )}
      </div>

      {/* Certifications */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium flex items-center gap-1.5" style={{ color: colors.brown }}>
            <Award className="w-3.5 h-3.5" style={{ color: colors.gold }} />
            Certifications
          </h5>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditingCert(null); setShowCertForm(true); }}
              className="h-7 px-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" style={{ color: colors.gold }} />
              <span className="text-xs" style={{ color: colors.brown }}>Add</span>
            </Button>
          )}
        </div>

        {certifications.length === 0 && !isLoading ? (
          <p className="text-xs py-2" style={{ color: colors.brownLight }}>No certifications on file</p>
        ) : (
          certifications.map((cert) => {
            const status = getCertStatusColor(cert);
            return (
              <Card key={cert.id} style={{ backgroundColor: colors.cream }}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: colors.brown }}>
                          {cert.certification_type?.name || 'Unknown'}
                        </span>
                        <Badge style={{ backgroundColor: status.bg, color: status.text }} className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs flex-wrap" style={{ color: colors.brownLight }}>
                        <span>Issued: {formatDate(cert.issue_date)}</span>
                        {cert.expiry_date && <span>Expires: {formatDate(cert.expiry_date)}</span>}
                        {cert.certificate_number && <span>#{cert.certificate_number}</span>}
                      </div>
                      {cert.certification_type?.issuing_body && (
                        <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>
                          {cert.certification_type.issuing_body}
                        </p>
                      )}
                      {cert.training_class && (
                        <p className="text-xs mt-0.5 italic" style={{ color: colors.brownLight }}>
                          From: {cert.training_class.name} ({formatDate(cert.training_class.class_date)})
                        </p>
                      )}
                      {cert.document_url && (
                        <a
                          href={cert.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs mt-1 underline"
                          style={{ color: colors.gold }}
                        >
                          <FileText className="w-3 h-3" />
                          View document
                        </a>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingCert(cert); setShowCertForm(true); }}
                          className="h-7 w-7 p-0"
                        >
                          <Pencil className="w-3 h-3" style={{ color: colors.brownLight }} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCert(cert)}
                          disabled={deleteCert.isPending}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3 h-3" style={{ color: colors.red }} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Training History */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium flex items-center gap-1.5" style={{ color: colors.brown }}>
            <Calendar className="w-3.5 h-3.5" style={{ color: colors.gold }} />
            Training History
          </h5>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTrainingForm(true)}
              className="h-7 px-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" style={{ color: colors.gold }} />
              <span className="text-xs" style={{ color: colors.brown }}>Add</span>
            </Button>
          )}
        </div>

        {trainingHistory.length === 0 && !isLoading ? (
          <p className="text-xs py-2" style={{ color: colors.brownLight }}>No training records</p>
        ) : (
          trainingHistory.map((att) => {
            const tc = att.training_class;
            return (
              <Card key={att.id} style={{ backgroundColor: colors.cream }}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium" style={{ color: colors.brown }}>
                        {tc?.name || 'Unknown class'}
                      </span>
                      <div className="flex gap-3 mt-1 text-xs flex-wrap" style={{ color: colors.brownLight }}>
                        {tc?.class_date && <span>{formatDate(tc.class_date)}</span>}
                        {tc?.provider && <span>{tc.provider}</span>}
                        {tc?.duration_hours && <span>{tc.duration_hours}h</span>}
                      </div>
                      {tc?.certification_type?.name && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs" style={{ borderColor: colors.gold, color: colors.brown }}>
                            <Award className="w-3 h-3 mr-1" />
                            {tc.certification_type.name}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs capitalize flex-shrink-0"
                      style={{ borderColor: colors.creamDark, color: colors.brownLight }}
                    >
                      {att.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialogs */}
      {showCertForm && (
        <CertificationForm
          open={showCertForm}
          onOpenChange={setShowCertForm}
          employeeId={employeeId}
          existing={editingCert}
          onSaved={() => setEditingCert(null)}
        />
      )}
      {showTrainingForm && (
        <TrainingClassForm
          open={showTrainingForm}
          onOpenChange={setShowTrainingForm}
          preselectedEmployeeId={employeeId}
        />
      )}
      {showCertTypes && (
        <CertTypesManager
          open={showCertTypes}
          onOpenChange={setShowCertTypes}
        />
      )}
    </div>
  );
}
