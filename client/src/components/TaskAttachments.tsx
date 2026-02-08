import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import {
  useTaskAttachments,
  useAddTaskAttachment,
  useDeleteTaskAttachment,
} from '@/lib/supabase-queries';
import { VideoCapture } from './VideoCapture';
import { FileText, Globe, Video, Trash2, Plus, Link, Loader2, Paperclip, ExternalLink, Play, X, Eye } from 'lucide-react';

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

interface TaskAttachmentsProps {
  taskId: string;
  tenantId: string;
  userName?: string;
}

export function TaskAttachments({ taskId, tenantId, userName }: TaskAttachmentsProps) {
  const { toast } = useToast();
  const { data: attachments = [], isLoading } = useTaskAttachments(taskId);
  const addAttachment = useAddTaskAttachment();
  const deleteAttachment = useDeleteTaskAttachment();

  const [showAddLink, setShowAddLink] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [fullscreenVideoUrl, setFullscreenVideoUrl] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; url: string; file_type: string | null } | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
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
        const isVideo = file.type.startsWith('video/');
        await addAttachment.mutateAsync({
          tenant_id: tenantId,
          task_id: taskId,
          attachment_type: isVideo ? 'video' : 'file',
          name: file.name,
          url: response.objectPath,
          file_type: file.type || undefined,
        });
        toast({ title: isVideo ? 'Video attached' : 'File attached' });
      } catch {
        toast({ title: 'Failed to save attachment', variant: 'destructive' });
      }
    }
    e.target.value = '';
  };

  const handleVideoRecorded = async (file: File) => {
    setIsUploadingVideo(true);
    try {
      const response = await uploadFile(file);
      if (response) {
        await addAttachment.mutateAsync({
          tenant_id: tenantId,
          task_id: taskId,
          attachment_type: 'video',
          name: file.name,
          url: response.objectPath,
          file_type: file.type || 'video/webm',
        });
        toast({ title: 'Tutorial video saved' });
      }
    } catch {
      toast({ title: 'Failed to save video', variant: 'destructive' });
    } finally {
      setIsUploadingVideo(false);
    }
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
        task_id: taskId,
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

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4" style={{ color: colors.brown }} />
        <span className="text-sm font-medium" style={{ color: colors.brown }}>
          Attachments & Tutorials ({attachments.length})
        </span>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id}>
              {att.attachment_type === 'video' ? (
                <div
                  className="rounded overflow-hidden"
                  style={{ backgroundColor: colors.inputBg }}
                >
                  <div
                    className="relative w-full max-w-md aspect-video bg-black rounded-t cursor-pointer group"
                    onClick={() => setFullscreenVideoUrl(att.url)}
                  >
                    <video
                      src={att.url}
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 ml-0.5" style={{ color: colors.brown }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Video className="w-4 h-4 flex-shrink-0" style={{ color: colors.brownLight }} />
                      <span className="text-sm truncate" style={{ color: colors.brown }}>{att.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(att.id, att.name)}
                      className="p-1 rounded hover:bg-red-50 flex-shrink-0"
                      aria-label={`Remove ${att.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" style={{ color: colors.red }} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 p-2 rounded"
                  style={{ backgroundColor: colors.inputBg }}
                >
                  {att.attachment_type === 'file' ? (
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: colors.brownLight }} />
                  ) : (
                    <Globe className="w-4 h-4 flex-shrink-0" style={{ color: colors.brownLight }} />
                  )}
                  {att.attachment_type === 'file' ? (
                    <button
                      type="button"
                      onClick={() => setPreviewAttachment({ name: att.name, url: att.url, file_type: att.file_type || null })}
                      className="text-sm hover:underline truncate flex-1 text-left flex items-center gap-1"
                      style={{ color: colors.brown }}
                    >
                      {att.name}
                      <Eye className="w-3 h-3 inline flex-shrink-0" style={{ color: colors.brownLight }} />
                    </button>
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline truncate flex-1"
                      style={{ color: colors.brown }}
                    >
                      {att.name}
                      <ExternalLink className="w-3 h-3 inline ml-1" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(att.id, att.name)}
                    className="p-1 rounded hover:bg-red-50 flex-shrink-0"
                    aria-label={`Remove ${att.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: colors.red }} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <VideoCapture
          onVideoRecorded={handleVideoRecorded}
          isUploading={isUploadingVideo}
          recorderName={userName}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.gif,.webp,.mp4,.webm,.mov"
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
              placeholder="Name (e.g., YouTube Tutorial)"
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

      {/* File preview overlay */}
      {previewAttachment && (
        <div
          className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50"
          onClick={() => setPreviewAttachment(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            onClick={() => setPreviewAttachment(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div
            className="flex flex-col items-center gap-4 max-w-[95vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {previewAttachment.file_type?.startsWith('image/') ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-w-[95vw] max-h-[75vh] rounded-lg object-contain"
              />
            ) : previewAttachment.file_type === 'application/pdf' ? (
              <iframe
                src={previewAttachment.url}
                title={previewAttachment.name}
                className="w-[90vw] h-[75vh] rounded-lg bg-white"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 p-8">
                <FileText className="w-16 h-16 text-white/70" />
                <p className="text-white text-lg">{previewAttachment.name}</p>
              </div>
            )}
            <a
              href={previewAttachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: colors.gold, color: colors.brown }}
            >
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </a>
          </div>
        </div>
      )}

      {/* Fullscreen video overlay */}
      {fullscreenVideoUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setFullscreenVideoUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            onClick={() => setFullscreenVideoUrl(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <video
            src={fullscreenVideoUrl}
            controls
            autoPlay
            className="max-w-[95vw] max-h-[90vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
