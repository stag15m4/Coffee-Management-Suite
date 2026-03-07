import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useUpload } from '@/hooks/use-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bug, Plus, Loader2, Clock, CheckCircle, AlertTriangle, XCircle, ImagePlus, X, ExternalLink, MessageSquarePlus, Lightbulb } from 'lucide-react';
import { colors } from '@/lib/colors';

type ReportType = 'bug' | 'suggestion' | 'feedback';

interface BugReport {
  id: string;
  report_type: ReportType;
  title: string;
  description: string;
  severity: string;
  status: string;
  admin_notes: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
}

const reportTypeConfig: Record<ReportType, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: 'Bug', icon: Bug, color: colors.red },
  suggestion: { label: 'Suggestion', icon: Lightbulb, color: colors.gold },
  feedback: { label: 'Feedback', icon: MessageSquarePlus, color: colors.blue },
};

const severityColors: Record<string, string> = {
  low: colors.blue,
  medium: colors.gold,
  high: colors.orange,
  critical: colors.red,
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: colors.blue, icon: Clock },
  in_progress: { label: 'In Progress', color: colors.orange, icon: AlertTriangle },
  resolved: { label: 'Resolved', color: colors.green, icon: CheckCircle },
  closed: { label: 'Closed', color: colors.brownLight, icon: XCircle },
};

export default function BugReports() {
  const { user, profile, tenant } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [reportType, setReportType] = useState<ReportType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const screenshotRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading: uploadingScreenshot } = useUpload({
    onSuccess: (response) => {
      const serveUrl = `${window.location.origin}${response.objectPath}`;
      setScreenshotUrl(serveUrl);
      toast({ title: 'Screenshot uploaded' });
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  async function handleScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Image must be under 10MB', variant: 'destructive' });
      return;
    }
    await uploadFile(file);
    e.target.value = '';
  }

  async function fetchReports() {
    if (!tenant?.id) return;
    const { data, error } = await supabase
      .from('bug_reports')
      .select('id, report_type, title, description, severity, status, admin_notes, screenshot_url, created_at, updated_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[BugReports] fetch error:', error, 'tenant_id:', tenant.id);
    }
    if (!error && data) setReports(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchReports();
  }, [tenant?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !tenant?.id || !user?.id) return;

    setSubmitting(true);
    const { error } = await supabase.from('bug_reports').insert({
      tenant_id: tenant.id,
      submitted_by: user.id,
      submitted_by_name: profile?.full_name || null,
      submitted_by_email: user.email || null,
      report_type: reportType,
      title: title.trim(),
      description: description.trim(),
      severity,
      screenshot_url: screenshotUrl || null,
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to submit bug report. Please try again.', variant: 'destructive' });
    } else {
      toast({ title: 'Submitted', description: 'Your report has been sent to the team.' });
      setReportType('bug');
      setTitle('');
      setDescription('');
      setSeverity('medium');
      setScreenshotUrl('');
      setShowForm(false);
      fetchReports();
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.brown }}>Bugs & Feedback</h1>
          <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
            Report bugs, suggest improvements, or share feedback
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          style={{ backgroundColor: colors.gold, color: colors.white }}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Report
        </Button>
      </div>

      {showForm && (
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              {(() => { const Icon = reportTypeConfig[reportType].icon; return <Icon className="w-5 h-5" />; })()}
              New {reportTypeConfig[reportType].label} Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Type</Label>
                <Select value={reportType} onValueChange={(v: ReportType) => setReportType(v)}>
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="suggestion">Suggestion</SelectItem>
                    <SelectItem value="feedback">General Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Title</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Description</Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={
                    reportType === 'bug'
                      ? "Describe the bug in detail. Include steps to reproduce, what you expected, and what actually happened."
                      : reportType === 'suggestion'
                      ? "What improvement would you like to see? How would it help you?"
                      : "Share your thoughts with us..."
                  }
                  className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm resize-y"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  required
                />
              </div>
              {reportType === 'bug' && (
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                    <SelectItem value="medium">Medium - Affects workflow</SelectItem>
                    <SelectItem value="high">High - Major functionality broken</SelectItem>
                    <SelectItem value="critical">Critical - Cannot use the system</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}
              <div className="space-y-2">
                <Label style={{ color: colors.brown }}>Screenshot (optional)</Label>
                <input
                  ref={screenshotRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotSelect}
                  className="hidden"
                />
                {screenshotUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={screenshotUrl}
                      alt="Screenshot preview"
                      className="h-20 rounded border object-cover"
                      style={{ borderColor: colors.gold }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setScreenshotUrl('')}
                      style={{ borderColor: colors.red, color: colors.red }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => screenshotRef.current?.click()}
                    disabled={uploadingScreenshot}
                    style={{ borderColor: colors.gold, color: colors.gold }}
                  >
                    {uploadingScreenshot ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ImagePlus className="w-4 h-4 mr-2" />
                    )}
                    {uploadingScreenshot ? 'Uploading...' : 'Attach Screenshot'}
                  </Button>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={submitting || uploadingScreenshot || !title.trim() || !description.trim()}
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  style={{ borderColor: colors.gold, color: colors.gold }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.gold }} />
        </div>
      ) : reports.length === 0 ? (
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="py-12 text-center">
            <MessageSquarePlus className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
            <p className="text-sm" style={{ color: colors.brownLight }}>
              No reports yet. Click "New Report" to submit one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const sc = statusConfig[report.status] || statusConfig.open;
            const StatusIcon = sc.icon;
            return (
              <Card key={report.id} style={{ backgroundColor: colors.white }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm" style={{ color: colors.brown }}>
                          {report.title}
                        </h3>
                        {(() => {
                          const rt = reportTypeConfig[report.report_type] || reportTypeConfig.bug;
                          return (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                              style={{ borderColor: rt.color, color: rt.color }}
                            >
                              {rt.label}
                            </Badge>
                          );
                        })()}
                        {report.report_type === 'bug' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ borderColor: severityColors[report.severity], color: severityColors[report.severity] }}
                        >
                          {report.severity}
                        </Badge>
                        )}
                      </div>
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: colors.brownLight }}>
                        {report.description}
                      </p>
                      {report.screenshot_url && (
                        <a href={report.screenshot_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium"
                          style={{ color: colors.gold }}
                        >
                          <ImagePlus className="w-3 h-3" /> View Screenshot <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {report.admin_notes && (
                        <div className="mt-2 p-2 rounded text-xs" style={{ backgroundColor: colors.cream, color: colors.brown }}>
                          <span className="font-semibold">Admin response:</span> {report.admin_notes}
                        </div>
                      )}
                      <p className="text-[10px] mt-2" style={{ color: colors.brownLight }}>
                        Submitted {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <StatusIcon className="w-3.5 h-3.5" style={{ color: sc.color }} />
                      <span className="text-xs font-medium" style={{ color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
