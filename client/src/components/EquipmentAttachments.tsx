import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import {
  useEquipmentAttachments,
  useAddEquipmentAttachment,
  useDeleteEquipmentAttachment,
} from '@/lib/supabase-queries';
import { FileText, Globe, Trash2, Plus, Link, Loader2, Paperclip, ExternalLink } from 'lucide-react';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  inputBg: '#FDF8E8',
  red: '#DC2626',
};

interface EquipmentAttachmentsProps {
  equipmentId: string;
  tenantId: string;
  readOnly?: boolean;
}

export function EquipmentAttachments({ equipmentId, tenantId, readOnly }: EquipmentAttachmentsProps) {
  const { toast } = useToast();
  const { data: attachments = [], isLoading } = useEquipmentAttachments(equipmentId);
  const addAttachment = useAddEquipmentAttachment();
  const deleteAttachment = useDeleteEquipmentAttachment();

  const [showAddLink, setShowAddLink] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const response = await uploadFile(file);
    if (response) {
      try {
        await addAttachment.mutateAsync({
          tenant_id: tenantId,
          equipment_id: equipmentId,
          attachment_type: 'file',
          name: file.name,
          url: response.objectPath,
          file_type: file.type || undefined,
        });
        toast({ title: 'File attached' });
      } catch {
        toast({ title: 'Failed to save attachment', variant: 'destructive' });
      }
    }
    e.target.value = '';
  };

  const handleAddLink = async () => {
    if (!linkName.trim() || !linkUrl.trim()) {
      toast({ title: 'Please enter both a name and URL', variant: 'destructive' });
      return;
    }
    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    try {
      await addAttachment.mutateAsync({
        tenant_id: tenantId,
        equipment_id: equipmentId,
        attachment_type: 'link',
        name: linkName.trim(),
        url,
      });
      setLinkName('');
      setLinkUrl('');
      setShowAddLink(false);
      toast({ title: 'Link attached' });
    } catch {
      toast({ title: 'Failed to save link', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return;
    try {
      await deleteAttachment.mutateAsync(id);
    } catch {
      toast({ title: 'Failed to delete attachment', variant: 'destructive' });
    }
  };

  if (isLoading) return null;

  // Read-only mode for equipment card display
  if (readOnly) {
    if (attachments.length === 0) return null;
    return (
      <div className="mt-2 space-y-1">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-1.5">
            {att.attachment_type === 'file' ? (
              <FileText className="w-3 h-3 flex-shrink-0" style={{ color: colors.brownLight }} />
            ) : (
              <Globe className="w-3 h-3 flex-shrink-0" style={{ color: colors.brownLight }} />
            )}
            <a
              href={att.attachment_type === 'link' ? att.url : att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline truncate"
              style={{ color: colors.gold }}
            >
              {att.name}
              <ExternalLink className="w-2.5 h-2.5 inline ml-1" />
            </a>
          </div>
        ))}
      </div>
    );
  }

  // Full interactive mode for edit form
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4" style={{ color: colors.brown }} />
        <span className="text-sm font-medium" style={{ color: colors.brown }}>
          Attachments ({attachments.length})
        </span>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 p-2 rounded"
              style={{ backgroundColor: colors.inputBg }}
            >
              {att.attachment_type === 'file' ? (
                <FileText className="w-4 h-4 flex-shrink-0" style={{ color: colors.brownLight }} />
              ) : (
                <Globe className="w-4 h-4 flex-shrink-0" style={{ color: colors.brownLight }} />
              )}
              <a
                href={att.attachment_type === 'link' ? att.url : att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline truncate flex-1"
                style={{ color: colors.brown }}
              >
                {att.name}
              </a>
              <button
                type="button"
                onClick={() => handleDelete(att.id, att.name)}
                className="p-1 rounded hover:bg-red-50 flex-shrink-0"
                aria-label={`Remove ${att.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: colors.red }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add buttons */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.gif,.webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || addAttachment.isPending}
          style={{ borderColor: colors.creamDark, color: colors.brown }}
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5 mr-1.5" />
          )}
          Add File
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddLink(!showAddLink)}
          disabled={isUploading || addAttachment.isPending}
          style={{ borderColor: colors.creamDark, color: colors.brown }}
        >
          <Link className="w-3.5 h-3.5 mr-1.5" />
          Add Link
        </Button>
      </div>

      {/* Add link form */}
      {showAddLink && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Input
              placeholder="Name (e.g., Manual, Rep Contact)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
            />
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark, color: colors.brown }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAddLink}
            disabled={addAttachment.isPending}
            style={{ backgroundColor: colors.gold, color: colors.brown }}
          >
            {addAttachment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
