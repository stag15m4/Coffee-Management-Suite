import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
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
import {
  useDocumentCategories,
  useCreateDocumentCategory,
  useDeleteDocumentCategory,
  useSeedDefaultCategories,
  useDocuments,
  useCreateDocument,
  useUpdateDocument,
  useDeleteDocument,
  useReviewDocument,
  useDocumentAcknowledgments,
  useAcknowledgeDocument,
  useTenantMembers,
  type Document,
  type DocumentCategory,
} from '@/hooks/use-documents';
import {
  FileText,
  Upload,
  Trash2,
  Edit2,
  Eye,
  X,
  Plus,
  Loader2,
  Check,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Settings,
  FileImage,
  FileSpreadsheet,
  File,
  Search,
  MoreVertical,
  Users,
  AlertTriangle,
  RotateCcw,
  Download,
  UserCheck,
  UserX,
} from 'lucide-react';

// Role hierarchy for display
const ROLE_OPTIONS = [
  { value: 'employee', label: 'All Employees' },
  { value: 'lead', label: 'Leads & Above' },
  { value: 'manager', label: 'Managers & Above' },
  { value: 'owner', label: 'Owners Only' },
] as const;

const REVIEW_INTERVAL_OPTIONS = [
  { value: '', label: 'No review cycle' },
  { value: '30', label: 'Every 30 days' },
  { value: '60', label: 'Every 60 days' },
  { value: '90', label: 'Every 90 days' },
  { value: '180', label: 'Every 6 months' },
  { value: '365', label: 'Every year' },
] as const;

function getRoleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function getReviewStatus(doc: Document): 'none' | 'current' | 'due' | 'overdue' {
  if (!doc.review_interval_days) return 'none';
  const baseDate = doc.last_reviewed_at || doc.created_at;
  const daysSince = Math.floor((Date.now() - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince > doc.review_interval_days + 14) return 'overdue';
  if (daysSince >= doc.review_interval_days) return 'due';
  return 'current';
}

function getReviewLabel(doc: Document): string {
  if (!doc.review_interval_days) return '';
  const baseDate = doc.last_reviewed_at || doc.created_at;
  const nextReview = new Date(new Date(baseDate).getTime() + doc.review_interval_days * 24 * 60 * 60 * 1000);
  const status = getReviewStatus(doc);
  if (status === 'overdue') return 'Overdue for review';
  if (status === 'due') return 'Due for review';
  return `Review by ${nextReview.toLocaleDateString()}`;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType === 'application/pdf') return FileText;
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Upload Document Dialog
// ---------------------------------------------------------------------------

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategory[];
  userId: string;
}

function UploadDocumentDialog({ open, onOpenChange, categories, userId }: UploadDialogProps) {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const createDocument = useCreateDocument();
  const { data: members = [] } = useTenantMembers();
  const { uploadFile, isUploading } = useUpload({
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [minRole, setMinRole] = useState<string>('employee');
  const [requiresAck, setRequiresAck] = useState(false);
  const [reviewInterval, setReviewInterval] = useState<string>('');
  const [reviewAssignee, setReviewAssignee] = useState<string>('none');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const leadPlusMembers = members.filter((m) => ['owner', 'manager', 'lead'].includes(m.role));

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setCategoryId('');
    setMinRole('employee');
    setRequiresAck(false);
    setReviewInterval('');
    setReviewAssignee('none');
    setSelectedFile(null);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !title.trim() || !tenant?.id) return;
    setIsSaving(true);
    try {
      const response = await uploadFile(selectedFile);
      if (!response) return;

      await createDocument.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        category_id: categoryId || null,
        file_url: response.objectPath,
        file_name: selectedFile.name,
        file_type: selectedFile.type || undefined,
        file_size: selectedFile.size,
        min_role_required: minRole as any,
        requires_acknowledgment: requiresAck,
        review_interval_days: reviewInterval && reviewInterval !== 'none' ? parseInt(reviewInterval) : null,
        review_assigned_to: reviewAssignee && reviewAssignee !== 'none' ? reviewAssignee : null,
        uploaded_by: userId,
      });
      toast({ title: 'Document uploaded' });
      resetForm();
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to save document', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>Upload Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* File picker */}
          <div>
            <Label style={{ color: colors.brown }}>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:opacity-80 transition-opacity"
              style={{ borderColor: colors.creamDark, backgroundColor: colors.inputBg }}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5" style={{ color: colors.gold }} />
                  <span className="text-sm font-medium" style={{ color: colors.brown }}>
                    {selectedFile.name}
                  </span>
                  <span className="text-xs" style={{ color: colors.brownLight }}>
                    ({formatFileSize(selectedFile.size)})
                  </span>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: colors.brownLight }} />
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Tap to select a file
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label style={{ color: colors.brown }}>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="mt-1"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
            />
          </div>

          {/* Description */}
          <div>
            <Label style={{ color: colors.brown }}>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="mt-1"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
            />
          </div>

          {/* Category */}
          <div>
            <Label style={{ color: colors.brown }}>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: colors.white }}>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visibility */}
          <div>
            <Label style={{ color: colors.brown }}>Who can view?</Label>
            <Select value={minRole} onValueChange={setMinRole}>
              <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: colors.white }}>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Requires acknowledgment */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm" style={{ color: colors.brown }}>Require read acknowledgment</span>
          </label>

          {/* Review cycle */}
          <div>
            <Label style={{ color: colors.brown }}>Review Cycle</Label>
            <Select value={reviewInterval} onValueChange={setReviewInterval}>
              <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                <SelectValue placeholder="No review cycle" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: colors.white }}>
                {REVIEW_INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || 'none'} value={opt.value || 'none'}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Review assignee — only when review cycle is set */}
          {reviewInterval && reviewInterval !== 'none' && (
            <div>
              <Label style={{ color: colors.brown }}>Assign Reviewer</Label>
              <Select value={reviewAssignee} onValueChange={setReviewAssignee}>
                <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: colors.white }}>
                  <SelectItem value="none">Anyone (lead+)</SelectItem>
                  {leadPlusMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || !title.trim() || isUploading || isSaving}
            className="w-full"
            style={{ backgroundColor: colors.gold, color: colors.white }}
          >
            {isUploading || isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : 'Upload Document'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit Document Dialog
// ---------------------------------------------------------------------------

interface EditDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategory[];
}

function EditDocumentDialog({ document, open, onOpenChange, categories }: EditDialogProps) {
  const { toast } = useToast();
  const updateDocument = useUpdateDocument();
  const { data: members = [] } = useTenantMembers();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [minRole, setMinRole] = useState<string>('employee');
  const [requiresAck, setRequiresAck] = useState(false);
  const [reviewInterval, setReviewInterval] = useState<string>('none');
  const [reviewAssignee, setReviewAssignee] = useState<string>('none');

  const leadPlusMembers = members.filter((m) => ['owner', 'manager', 'lead'].includes(m.role));

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setDescription(document.description || '');
      setCategoryId(document.category_id || '');
      setMinRole(document.min_role_required);
      setRequiresAck(document.requires_acknowledgment);
      setReviewInterval(document.review_interval_days ? String(document.review_interval_days) : 'none');
      setReviewAssignee(document.review_assigned_to || 'none');
    }
  }, [document]);

  const handleSave = async () => {
    if (!document || !title.trim()) return;
    try {
      await updateDocument.mutateAsync({
        id: document.id,
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId || null,
        min_role_required: minRole as any,
        requires_acknowledgment: requiresAck,
        review_interval_days: reviewInterval && reviewInterval !== 'none' ? parseInt(reviewInterval) : null,
        review_assigned_to: reviewAssignee && reviewAssignee !== 'none' ? reviewAssignee : null,
      });
      toast({ title: 'Document updated' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>Edit Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label style={{ color: colors.brown }}>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
            />
          </div>
          <div>
            <Label style={{ color: colors.brown }}>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
            />
          </div>
          <div>
            <Label style={{ color: colors.brown }}>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: colors.white }}>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label style={{ color: colors.brown }}>Who can view?</Label>
            <Select value={minRole} onValueChange={setMinRole}>
              <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: colors.white }}>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm" style={{ color: colors.brown }}>Require read acknowledgment</span>
          </label>
          <div>
            <Label style={{ color: colors.brown }}>Review Cycle</Label>
            <Select value={reviewInterval} onValueChange={setReviewInterval}>
              <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                <SelectValue placeholder="No review cycle" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: colors.white }}>
                {REVIEW_INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value || 'none'} value={opt.value || 'none'}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reviewInterval && reviewInterval !== 'none' && (
            <div>
              <Label style={{ color: colors.brown }}>Assign Reviewer</Label>
              <Select value={reviewAssignee} onValueChange={setReviewAssignee}>
                <SelectTrigger className="mt-1" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: colors.white }}>
                  <SelectItem value="none">Anyone (lead+)</SelectItem>
                  {leadPlusMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={!title.trim() || updateDocument.isPending}
            className="w-full"
            style={{ backgroundColor: colors.gold, color: colors.white }}
          >
            {updateDocument.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Manage Categories Dialog
// ---------------------------------------------------------------------------

interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategory[];
}

function ManageCategoriesDialog({ open, onOpenChange, categories }: ManageCategoriesDialogProps) {
  const { toast } = useToast();
  const createCategory = useCreateDocumentCategory();
  const deleteCategory = useDeleteDocumentCategory();
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createCategory.mutateAsync({ name: newName.trim() });
      setNewName('');
      toast({ title: 'Category added' });
    } catch {
      toast({ title: 'Failed to add category', variant: 'destructive' });
    }
  };

  const handleDelete = async (cat: DocumentCategory) => {
    if (cat.is_default) {
      toast({ title: 'Cannot delete default categories', variant: 'destructive' });
      return;
    }
    if (!confirm(`Delete "${cat.name}"? Documents in this category will become uncategorized.`)) return;
    try {
      await deleteCategory.mutateAsync(cat.id);
      toast({ title: 'Category deleted' });
    } catch {
      toast({ title: 'Failed to delete category', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>Manage Categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-2 rounded"
              style={{ backgroundColor: colors.inputBg }}
            >
              <span className="text-sm font-medium" style={{ color: colors.brown }}>
                {cat.name}
                {cat.is_default && (
                  <span className="text-xs ml-2" style={{ color: colors.brownLight }}>(default)</span>
                )}
              </span>
              {!cat.is_default && (
                <button
                  onClick={() => handleDelete(cat)}
                  className="p-1 rounded hover:bg-red-50"
                  disabled={deleteCategory.isPending}
                >
                  <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
            />
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || createCategory.isPending}
              style={{ backgroundColor: colors.gold, color: colors.white }}
            >
              {createCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Acknowledgment Detail Dialog (who read + who hasn't + export)
// ---------------------------------------------------------------------------

interface AckDetailDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AckDetailDialog({ document, open, onOpenChange }: AckDetailDialogProps) {
  const { data: acks = [] } = useDocumentAcknowledgments(document?.id);
  const { data: members = [] } = useTenantMembers();
  const [tab, setTab] = useState<'read' | 'unread'>('unread');

  const ackedUserIds = new Set(acks.map((a) => a.user_id));

  // Determine which roles are required to view/ack this document
  const roleHierarchy: Record<string, number> = { owner: 4, manager: 3, lead: 2, employee: 1 };
  const minRoleLevel = roleHierarchy[document?.min_role_required || 'employee'] || 1;
  const eligibleMembers = members.filter((m) => (roleHierarchy[m.role] || 0) >= minRoleLevel);
  const unreadMembers = eligibleMembers.filter((m) => !ackedUserIds.has(m.id));

  const handleExport = () => {
    if (!document) return;
    const rows = [['Employee', 'Status', 'Date Acknowledged']];

    // Add acknowledged
    for (const ack of acks) {
      rows.push([
        ack.user_name || 'Unknown',
        'Read',
        new Date(ack.acknowledged_at).toLocaleDateString(),
      ]);
    }
    // Add unread
    for (const m of unreadMembers) {
      rows.push([m.full_name, 'Not Read', '']);
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.title.replace(/[^a-z0-9]/gi, '_')}_acknowledgments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: colors.white, borderColor: colors.creamDark }} className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: colors.brown }}>Read Receipts — {document?.title}</DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1" style={{ color: colors.green }}>
            <UserCheck className="w-4 h-4" />
            <span className="font-medium">{acks.length}</span> read
          </div>
          <div className="flex items-center gap-1" style={{ color: unreadMembers.length > 0 ? '#DC2626' : colors.brownLight }}>
            <UserX className="w-4 h-4" />
            <span className="font-medium">{unreadMembers.length}</span> not read
          </div>
          <div className="flex-1" />
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-70"
            style={{ color: colors.gold }}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: colors.creamDark }}>
          <button
            onClick={() => setTab('unread')}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === 'unread' ? colors.gold : colors.inputBg,
              color: tab === 'unread' ? colors.white : colors.brown,
            }}
          >
            Not Read ({unreadMembers.length})
          </button>
          <button
            onClick={() => setTab('read')}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === 'read' ? colors.gold : colors.inputBg,
              color: tab === 'read' ? colors.white : colors.brown,
            }}
          >
            Read ({acks.length})
          </button>
        </div>

        {/* List */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {tab === 'unread' ? (
            unreadMembers.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: colors.green }}>
                Everyone has read this document.
              </p>
            ) : (
              unreadMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded"
                  style={{ backgroundColor: '#FEF2F2' }}
                >
                  <span className="text-sm" style={{ color: colors.brown }}>{m.full_name}</span>
                  <span className="text-xs font-medium" style={{ color: '#DC2626' }}>Not read</span>
                </div>
              ))
            )
          ) : (
            acks.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: colors.brownLight }}>
                No one has acknowledged this document yet.
              </p>
            ) : (
              acks.map((ack) => (
                <div
                  key={ack.id}
                  className="flex items-center justify-between p-2 rounded"
                  style={{ backgroundColor: colors.inputBg }}
                >
                  <span className="text-sm" style={{ color: colors.brown }}>{ack.user_name || 'Unknown'}</span>
                  <span className="text-xs" style={{ color: colors.brownLight }}>
                    {new Date(ack.acknowledged_at).toLocaleDateString()} {new Date(ack.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Document Card
// ---------------------------------------------------------------------------

interface DocumentCardProps {
  doc: Document;
  canManage: boolean;
  currentUserId: string;
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  onPreview: (doc: Document) => void;
  onViewAcks: (doc: Document) => void;
}

function DocumentCard({ doc, canManage, currentUserId, onEdit, onDelete, onPreview, onViewAcks }: DocumentCardProps) {
  const { toast } = useToast();
  const acknowledge = useAcknowledgeDocument();
  const reviewDocument = useReviewDocument();
  const { data: acks = [] } = useDocumentAcknowledgments(doc.requires_acknowledgment ? doc.id : undefined);
  const [showActions, setShowActions] = useState(false);

  const hasAcknowledged = acks.some((a) => a.user_id === currentUserId);
  const FileIcon = getFileIcon(doc.file_type);
  const reviewStatus = getReviewStatus(doc);

  const handleAcknowledge = async () => {
    try {
      await acknowledge.mutateAsync(doc.id);
      toast({ title: 'Marked as read' });
    } catch {
      toast({ title: 'Already acknowledged', variant: 'destructive' });
    }
  };

  return (
    <div
      className="rounded-lg border p-4 relative"
      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.goldLight }}
        >
          <FileIcon className="w-5 h-5" style={{ color: colors.gold }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-medium text-sm truncate cursor-pointer hover:underline"
            style={{ color: colors.brown }}
            onClick={() => onPreview(doc)}
          >
            {doc.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {doc.category_name && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.goldLight, color: colors.gold }}
              >
                {doc.category_name}
              </span>
            )}
            <span className="text-xs" style={{ color: colors.brownLight }}>
              {getRoleLabel(doc.min_role_required)}
            </span>
            {(reviewStatus === 'due' || reviewStatus === 'overdue') && (
              <span
                className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  backgroundColor: reviewStatus === 'overdue' ? '#FEE2E2' : '#FEF3C7',
                  color: reviewStatus === 'overdue' ? '#DC2626' : '#D97706',
                }}
              >
                <AlertTriangle className="w-3 h-3" />
                {reviewStatus === 'overdue' ? 'Overdue' : 'Due for Review'}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded hover:opacity-70"
            >
              <MoreVertical className="w-4 h-4" style={{ color: colors.brownLight }} />
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                <div
                  className="absolute right-0 top-8 z-50 rounded-lg border shadow-lg py-1 min-w-[140px]"
                  style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                >
                  <button
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:opacity-70"
                    style={{ color: colors.brown }}
                    onClick={() => { onEdit(doc); setShowActions(false); }}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  {doc.review_interval_days && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:opacity-70"
                      style={{ color: colors.green }}
                      onClick={async () => {
                        setShowActions(false);
                        try {
                          await reviewDocument.mutateAsync(doc.id);
                          toast({ title: 'Marked as reviewed' });
                        } catch {
                          toast({ title: 'Failed to mark as reviewed', variant: 'destructive' });
                        }
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Mark Reviewed
                    </button>
                  )}
                  <button
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:opacity-70"
                    style={{ color: '#DC2626' }}
                    onClick={() => { onDelete(doc); setShowActions(false); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {doc.description && (
        <p className="text-xs mt-2 line-clamp-2" style={{ color: colors.brownLight }}>
          {doc.description}
        </p>
      )}

      {/* Review info */}
      {doc.review_interval_days && (
        <div className="flex items-center gap-1 mt-2 text-xs flex-wrap" style={{ color: reviewStatus === 'overdue' ? '#DC2626' : reviewStatus === 'due' ? '#D97706' : colors.brownLight }}>
          <RotateCcw className="w-3 h-3" />
          {getReviewLabel(doc)}
          {doc.assignee_name && <span> — assigned to {doc.assignee_name}</span>}
          {doc.last_reviewed_at && doc.reviewer_name && (
            <span> — last by {doc.reviewer_name} on {new Date(doc.last_reviewed_at).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: colors.creamDark }}>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: colors.brownLight }}>
            {doc.uploader_name || 'Unknown'}
          </span>
          <span className="text-xs" style={{ color: colors.brownLight }}>
            {new Date(doc.created_at).toLocaleDateString()}
          </span>
          {doc.file_size && (
            <span className="text-xs" style={{ color: colors.brownLight }}>
              {formatFileSize(doc.file_size)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {doc.requires_acknowledgment && (
            <button
              onClick={() => onViewAcks(doc)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-70"
              style={{ color: colors.brownLight }}
            >
              <Users className="w-3 h-3" />
              {acks.length}
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPreview(doc)}
            className="h-7 px-2"
          >
            <Eye className="w-3.5 h-3.5" style={{ color: colors.gold }} />
          </Button>
        </div>
      </div>

      {/* Acknowledgment banner */}
      {doc.requires_acknowledgment && !hasAcknowledged && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: colors.creamDark }}>
          <Button
            size="sm"
            onClick={handleAcknowledge}
            disabled={acknowledge.isPending}
            className="w-full h-8 text-xs"
            style={{ backgroundColor: colors.gold, color: colors.white }}
          >
            {acknowledge.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3 mr-1" />
            )}
            Mark as Read
          </Button>
        </div>
      )}
      {doc.requires_acknowledgment && hasAcknowledged && (
        <div className="mt-2 pt-2 border-t flex items-center gap-1 justify-center" style={{ borderColor: colors.creamDark }}>
          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: colors.green }} />
          <span className="text-xs" style={{ color: colors.green }}>Acknowledged</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DocumentLibrary() {
  const { hasRole, user, tenant } = useAuth();
  const { toast } = useToast();
  const { data: categories = [], isLoading: catLoading } = useDocumentCategories();
  const seedDefaults = useSeedDefaultCategories();
  const deleteDocument = useDeleteDocument();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date-new' | 'date-old' | 'category' | 'review'>('name');
  const { data: documents = [], isLoading: docsLoading } = useDocuments(selectedCategory);

  // Dialogs
  const [showUpload, setShowUpload] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [ackDetailDoc, setAckDetailDoc] = useState<Document | null>(null);

  const canManage = hasRole('lead');
  const isOwner = hasRole('owner');

  // Seed default categories on first load if none exist
  useEffect(() => {
    if (!catLoading && categories.length === 0 && tenant?.id && isOwner) {
      seedDefaults.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catLoading, categories.length, tenant?.id]);

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await deleteDocument.mutateAsync(doc.id);
      toast({ title: 'Document deleted' });
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  // Filter documents by search
  const searchedDocs = searchQuery
    ? documents.filter(
        (d) =>
          d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.category_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  // Sort
  const filteredDocs = [...searchedDocs].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.title.localeCompare(b.title);
      case 'date-new':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'date-old':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'category':
        return (a.category_name || 'zzz').localeCompare(b.category_name || 'zzz');
      case 'review': {
        const priority = { overdue: 0, due: 1, current: 2, none: 3 };
        return priority[getReviewStatus(a)] - priority[getReviewStatus(b)];
      }
      default:
        return 0;
    }
  });

  const isLoading = catLoading || docsLoading;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.brown }}>
            Document Library
          </h1>
          <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
            Policies, procedures, forms, and more
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setShowUpload(true)}
            style={{ backgroundColor: colors.gold, color: colors.white }}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        )}
      </div>

      {/* Search bar + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.brownLight }} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="pl-10"
            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[150px] shrink-0" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: colors.white }}>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="date-new">Newest First</SelectItem>
            <SelectItem value="date-old">Oldest First</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="review">Review Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
          style={{
            backgroundColor: selectedCategory === null ? colors.gold : colors.inputBg,
            color: selectedCategory === null ? colors.white : colors.brown,
          }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: selectedCategory === cat.id ? colors.gold : colors.inputBg,
              color: selectedCategory === cat.id ? colors.white : colors.brown,
            }}
          >
            {cat.name}
          </button>
        ))}
        {isOwner && (
          <button
            onClick={() => setShowCategories(true)}
            className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1"
            style={{ color: colors.brownLight }}
          >
            <Settings className="w-3.5 h-3.5" />
            Manage
          </button>
        )}
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.gold }} />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto mb-3" style={{ color: colors.creamDark }} />
          <p className="font-medium" style={{ color: colors.brown }}>No documents found</p>
          <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
            {canManage ? 'Upload your first document to get started.' : 'No documents have been shared with you yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              canManage={canManage}
              currentUserId={user?.id || ''}
              onEdit={setEditDoc}
              onDelete={handleDelete}
              onPreview={setPreviewDoc}
              onViewAcks={setAckDetailDoc}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <UploadDocumentDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        categories={categories}
        userId={user?.id || ''}
      />

      <EditDocumentDialog
        document={editDoc}
        open={!!editDoc}
        onOpenChange={(v) => { if (!v) setEditDoc(null); }}
        categories={categories}
      />

      <ManageCategoriesDialog
        open={showCategories}
        onOpenChange={setShowCategories}
        categories={categories}
      />

      <AckDetailDialog
        document={ackDetailDoc}
        open={!!ackDetailDoc}
        onOpenChange={(v) => { if (!v) setAckDetailDoc(null); }}
      />

      {/* File preview overlay */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col"
          onClick={() => setPreviewDoc(null)}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-medium text-sm truncate mr-4">{previewDoc.title}</h3>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href={previewDoc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in New Tab
              </a>
              <button
                className="text-white hover:text-gray-300"
                onClick={() => setPreviewDoc(null)}
              >
                <X className="w-7 h-7" />
              </button>
            </div>
          </div>

          {/* Content area — fills remaining space */}
          <div
            className="flex-1 min-h-0 px-2 pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            {previewDoc.file_type?.startsWith('image/') ? (
              <div className="h-full flex items-center justify-center">
                <img
                  src={previewDoc.file_url}
                  alt={previewDoc.title}
                  className="max-w-full max-h-full rounded-lg object-contain"
                />
              </div>
            ) : previewDoc.file_type === 'application/pdf' ? (
              <iframe
                src={previewDoc.file_url}
                title={previewDoc.title}
                className="w-full h-full rounded-lg bg-white"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <FileText className="w-16 h-16 text-white/70" />
                <p className="text-white text-lg">{previewDoc.title}</p>
                <p className="text-white/60 text-sm">{previewDoc.file_name}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
