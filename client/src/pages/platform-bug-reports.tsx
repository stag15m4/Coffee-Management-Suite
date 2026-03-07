import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Bug,
  Loader2,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Filter,
  Building2,
  User,
  Mail,
  ImagePlus,
  Clipboard,
  Check,
  Lightbulb,
  MessageSquarePlus,
} from 'lucide-react';
import { colors } from '@/lib/colors';

type ReportType = 'bug' | 'suggestion' | 'feedback';

interface BugReport {
  id: string;
  tenant_id: string;
  submitted_by: string;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  report_type: ReportType;
  title: string;
  description: string;
  severity: string;
  status: string;
  admin_notes: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
  tenant_name?: string;
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

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: colors.blue, icon: Clock },
  in_progress: { label: 'In Progress', color: colors.orange, icon: AlertTriangle },
  resolved: { label: 'Resolved', color: colors.green, icon: CheckCircle },
  closed: { label: 'Closed', color: colors.brownLight, icon: XCircle },
};

export default function PlatformBugReports() {
  const { isPlatformAdmin } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const [selected, setSelected] = useState<BugReport | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function fetchReports() {
    // Fetch bug reports — platform admin RLS policy gives access to all
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bug reports:', error);
      setLoading(false);
      return;
    }

    // Fetch tenant names for display
    const tenantIds = Array.from(new Set((data || []).map(r => r.tenant_id)));
    let tenantMap: Record<string, string> = {};
    if (tenantIds.length > 0) {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds);
      if (tenants) {
        tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));
      }
    }

    setReports((data || []).map(r => ({ ...r, tenant_name: tenantMap[r.tenant_id] || 'Unknown' })));
    setLoading(false);
  }

  useEffect(() => {
    if (isPlatformAdmin) fetchReports();
  }, [isPlatformAdmin]);

  function openDetail(report: BugReport) {
    setSelected(report);
    setEditStatus(report.status);
    setEditNotes(report.admin_notes || '');
    setCopied(false);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);

    const { error } = await supabase
      .from('bug_reports')
      .update({ status: editStatus, admin_notes: editNotes.trim() || null })
      .eq('id', selected.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update bug report.', variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: 'Bug report updated successfully.' });
      setSelected(null);
      fetchReports();
    }
    setSaving(false);
  }

  const filtered = reports.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
    return true;
  });

  // Sort: open/in_progress first, then by severity, then by date
  const sorted = [...filtered].sort((a, b) => {
    const statusOrder: Record<string, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };
    const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (sd !== 0) return sd;
    const sevD = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
    if (sevD !== 0) return sevD;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const counts = {
    open: reports.filter(r => r.status === 'open').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    total: reports.length,
  };

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: colors.brownLight }}>Access denied.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: colors.brown }}>Bugs & Feedback</h1>
        <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
          Triage and manage reports and feedback from all tenants
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: counts.open, color: colors.blue },
          { label: 'In Progress', value: counts.in_progress, color: colors.orange },
          { label: 'Resolved', value: counts.resolved, color: colors.green },
          { label: 'Total', value: counts.total, color: colors.brown },
        ].map(s => (
          <Card key={s.label} style={{ backgroundColor: colors.white }}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: colors.brownLight }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4" style={{ color: colors.brownLight }} />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[150px]" style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs ml-auto" style={{ color: colors.brownLight }}>
          Showing {sorted.length} of {reports.length} reports
        </span>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.gold }} />
        </div>
      ) : sorted.length === 0 ? (
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="py-12 text-center">
            <Bug className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {reports.length === 0 ? 'No bug reports submitted yet.' : 'No reports match the current filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(report => {
            const sc = statusConfig[report.status] || statusConfig.open;
            const StatusIcon = sc.icon;
            return (
              <Card
                key={report.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                style={{ backgroundColor: colors.white }}
                onClick={() => openDetail(report)}
              >
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
                        <div className="flex items-center gap-1">
                          <StatusIcon className="w-3 h-3" style={{ color: sc.color }} />
                          <span className="text-[10px] font-medium" style={{ color: sc.color }}>{sc.label}</span>
                        </div>
                      </div>
                      <p className="text-xs mt-1 line-clamp-1" style={{ color: colors.brownLight }}>
                        {report.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: colors.brownLight }}>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {report.tenant_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {report.submitted_by_name || 'Unknown'}
                        </span>
                        {report.screenshot_url && (
                          <span className="flex items-center gap-1">
                            <ImagePlus className="w-3 h-3" />
                            Screenshot
                          </span>
                        )}
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail / Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: colors.white }}>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle style={{ color: colors.brown }}>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: colors.brownLight }}>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{selected.tenant_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{selected.submitted_by_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{selected.submitted_by_email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(selected.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Type & Severity badges */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const rt = reportTypeConfig[selected.report_type] || reportTypeConfig.bug;
                    return (
                      <Badge variant="outline" style={{ borderColor: rt.color, color: rt.color }}>
                        {rt.label}
                      </Badge>
                    );
                  })()}
                  {selected.report_type === 'bug' && (
                  <Badge
                    variant="outline"
                    style={{ borderColor: severityColors[selected.severity], color: severityColors[selected.severity] }}
                  >
                    {selected.severity} severity
                  </Badge>
                  )}
                </div>

                {/* Description */}
                <div>
                  <Label className="text-xs font-semibold" style={{ color: colors.brown }}>Description</Label>
                  <div
                    className="mt-1 p-3 rounded text-sm whitespace-pre-wrap"
                    style={{ backgroundColor: colors.cream, color: colors.brown }}
                  >
                    {selected.description}
                  </div>
                </div>

                {/* Screenshot */}
                {selected.screenshot_url && (
                  <div>
                    <Label className="text-xs font-semibold" style={{ color: colors.brown }}>Screenshot</Label>
                    <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={selected.screenshot_url}
                        alt="Bug screenshot"
                        className="mt-1 max-h-48 rounded border object-contain cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ borderColor: colors.gold }}
                      />
                    </a>
                  </div>
                )}

                {/* Status update */}
                <div className="space-y-2">
                  <Label style={{ color: colors.brown }}>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Admin notes */}
                <div className="space-y-2">
                  <Label style={{ color: colors.brown }}>Admin Notes</Label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Add notes about triage, resolution, or context for the next session with Claude..."
                    className="w-full min-h-[100px] rounded-md border px-3 py-2 text-sm resize-y"
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                  />
                  <p className="text-[10px]" style={{ color: colors.brownLight }}>
                    These notes are visible to the tenant who submitted the report.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2 flex-wrap">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const rtLabel = (reportTypeConfig[selected.report_type] || reportTypeConfig.bug).label;
                      const lines = [
                        `${rtLabel} Report: ${selected.title}`,
                        ...(selected.report_type === 'bug' ? [`Severity: ${selected.severity}`] : []),
                        `Tenant: ${selected.tenant_name}`,
                        `Submitted by: ${selected.submitted_by_name || 'Unknown'} (${selected.submitted_by_email || 'N/A'})`,
                        `Date: ${new Date(selected.created_at).toLocaleString()}`,
                        '',
                        'Description:',
                        selected.description,
                      ];
                      if (selected.admin_notes) {
                        lines.push('', 'Admin Notes:', selected.admin_notes);
                      }
                      if (selected.screenshot_url) {
                        lines.push('', `Screenshot: ${selected.screenshot_url}`);
                      }
                      lines.push('', `Report ID: ${selected.id}`);
                      navigator.clipboard.writeText(lines.join('\n'));
                      setCopied(true);
                      toast({ title: 'Copied to clipboard', description: 'Paste into a Claude Code session to start fixing.' });
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{ borderColor: colors.brown, color: colors.brown }}
                  >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Clipboard className="w-4 h-4 mr-2" />}
                    {copied ? 'Copied!' : 'Copy for Claude'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelected(null)}
                    style={{ borderColor: colors.gold, color: colors.gold }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
