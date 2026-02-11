import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import { Camera, Upload, SwitchCamera, RotateCcw, Loader2, X } from 'lucide-react';

interface PhotoCaptureProps {
  currentPhotoUrl: string | null;
  onPhotoSelected: (file: File) => Promise<void>;
  onPhotoRemoved?: () => void;
  isUploading: boolean;
  shape: 'circle' | 'square';
  size?: number;
  placeholderIcon?: ReactNode;
  label?: string;
}

export function PhotoCapture({
  currentPhotoUrl,
  onPhotoSelected,
  onPhotoRemoved,
  isUploading,
  shape,
  size = 128,
  placeholderIcon,
  label,
}: PhotoCaptureProps) {
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isCircle = shape === 'circle';
  const borderRadius = isCircle ? 'rounded-full' : 'rounded-lg';

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid file type', description: 'Please select an image file', variant: 'destructive' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Image size must be less than 5MB', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
        setSelectedFile(file);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const handleCancelPreview = () => {
    setPreviewImage(null);
    setSelectedFile(null);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    await onPhotoSelected(selectedFile);
    setPreviewImage(null);
    setSelectedFile(null);
  };

  const startCamera = async (deviceId?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 1280 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(cameras);
      const activeTrack = mediaStream.getVideoTracks()[0];
      const activeDeviceId = activeTrack?.getSettings()?.deviceId || '';
      setSelectedDeviceId(activeDeviceId);
      setStream(mediaStream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch {
      toast({ title: 'Camera access denied', description: 'Please allow camera access to take a photo', variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const switchCamera = () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    startCamera(videoDevices[nextIndex].deviceId);
  };

  const retakePhoto = () => {
    setPreviewImage(null);
    setSelectedFile(null);
    startCamera();
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Crop to square from center
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - minDim) / 2;
    const sy = (video.videoHeight - minDim) / 2;
    canvas.width = minDim;
    canvas.height = minDim;
    context.drawImage(video, sx, sy, minDim, minDim, 0, 0, minDim, minDim);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
        setSelectedFile(file);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }, 'image/jpeg', 0.9);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium" style={{ color: colors.brown }}>{label}</p>}

      <div className="flex items-center gap-4">
        {/* Photo display */}
        <div className="relative">
          <div
            className={`${borderRadius} overflow-hidden flex items-center justify-center flex-shrink-0`}
            style={{
              width: size,
              height: size,
              backgroundColor: colors.cream,
              border: `2px solid ${colors.creamDark}`,
            }}
          >
            {currentPhotoUrl ? (
              <img src={currentPhotoUrl} alt="Photo" className="w-full h-full object-cover" />
            ) : (
              placeholderIcon || <Camera className="w-8 h-8" style={{ color: colors.brownLight }} />
            )}
          </div>
          {isUploading && (
            <div
              className={`absolute inset-0 ${borderRadius} flex items-center justify-center`}
              style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          )}
          {currentPhotoUrl && onPhotoRemoved && !isUploading && (
            <button
              onClick={onPhotoRemoved}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-white shadow"
              style={{ border: `1px solid ${colors.creamDark}` }}
            >
              <X className="w-3 h-3" style={{ color: colors.brown }} />
            </button>
          )}
        </div>

        {/* Upload buttons */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            variant="outline"
            size="sm"
            style={{ borderColor: colors.gold, color: colors.gold }}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload Photo
          </Button>
          <Button
            type="button"
            onClick={() => startCamera()}
            disabled={isUploading}
            variant="outline"
            size="sm"
            style={{ borderColor: colors.brown, color: colors.brown }}
          >
            <Camera className="w-3.5 h-3.5 mr-1.5" />
            Take Photo
          </Button>
        </div>
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="max-w-2xl" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Take Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {isCircle
                ? 'Position your face within the circle and click capture when ready.'
                : 'Position the subject in frame and click capture when ready.'}
            </p>

            {videoDevices.length > 1 && (
              <Select value={selectedDeviceId} onValueChange={(deviceId) => startCamera(deviceId)}>
                <SelectTrigger className="w-full" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  {videoDevices.map((device, index) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative flex justify-center">
              <div className="relative w-full max-w-md aspect-square bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

                {isCircle && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="absolute inset-0 w-full h-full">
                      <defs>
                        <mask id="circleMask">
                          <rect width="100%" height="100%" fill="white" />
                          <circle cx="50%" cy="50%" r="40%" fill="black" />
                        </mask>
                      </defs>
                      <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.6)" mask="url(#circleMask)" />
                    </svg>
                    <div className="w-4/5 aspect-square rounded-full border-4" style={{ borderColor: colors.gold }} />
                  </div>
                )}

                {!isCircle && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="w-[90%] h-[90%] rounded-lg border-4"
                      style={{ borderColor: colors.gold, opacity: 0.6 }}
                    />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={stopCamera} style={{ borderColor: colors.creamDark, color: colors.brown }}>
                Cancel
              </Button>
              {videoDevices.length > 1 && (
                <Button variant="outline" onClick={switchCamera} style={{ borderColor: colors.brown, color: colors.brown }}>
                  <SwitchCamera className="w-4 h-4 mr-2" />
                  Switch Camera
                </Button>
              )}
              <Button onClick={capturePhoto} style={{ backgroundColor: colors.gold, color: colors.brown }}>
                <Camera className="w-4 h-4 mr-2" />
                Capture Photo
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && handleCancelPreview()}>
        <DialogContent className="max-w-md" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Confirm Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <div
                className={`overflow-hidden flex items-center justify-center ${borderRadius}`}
                style={{
                  width: 192,
                  height: 192,
                  backgroundColor: colors.cream,
                  border: `3px solid ${colors.gold}`,
                }}
              >
                {previewImage && (
                  <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                )}
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleCancelPreview}
                disabled={isUploading}
                style={{ borderColor: colors.creamDark, color: colors.brown }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={retakePhoto}
                disabled={isUploading}
                style={{ borderColor: colors.brown, color: colors.brown }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button
                onClick={handleConfirmUpload}
                disabled={isUploading}
                style={{ backgroundColor: colors.gold, color: colors.brown }}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Confirm & Upload'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
