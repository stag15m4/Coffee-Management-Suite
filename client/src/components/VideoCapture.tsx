import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Video, Square, SwitchCamera, RotateCcw, Loader2, Play } from 'lucide-react';

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

const MAX_DURATION = 120; // 2 minutes max

interface VideoCaptureProps {
  onVideoRecorded: (file: File) => Promise<void>;
  isUploading: boolean;
  recorderName?: string;
}

export function VideoCapture({ onVideoRecorded, isUploading, recorderName }: VideoCaptureProps) {
  const { toast } = useToast();
  const [showCamera, setShowCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      setVideoDevices(cameras);
      const activeTrack = mediaStream.getVideoTracks()[0];
      setSelectedDeviceId(activeTrack?.getSettings()?.deviceId || '');
      setStream(mediaStream);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch {
      toast({ title: 'Camera access denied', description: 'Please allow camera and microphone access', variant: 'destructive' });
    }
  }, [stream, toast]);

  const stopCamera = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setShowCamera(false);
  }, [stream]);

  const switchCamera = () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    startCamera(videoDevices[nextIndex].deviceId);
  };

  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];
    setElapsed(0);

    // Prefer webm, fall back to mp4
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
      const type = mimeType.includes('webm') ? 'video/webm' : 'video/mp4';
      const blob = new Blob(chunksRef.current, { type });
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const namepart = recorderName ? recorderName.split(' ')[0] : 'Tutorial';
      const file = new File([blob], `${namepart} ${date}.${ext}`, { type });

      if (file.size > 100 * 1024 * 1024) {
        toast({ title: 'Video too large', description: 'Maximum video size is 100MB', variant: 'destructive' });
        return;
      }

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setRecordedFile(file);

      // Stop camera stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setShowCamera(false);
    };

    recorder.start(1000); // collect data every second
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= MAX_DURATION - 1) {
          // Auto-stop at max duration
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          if (timerRef.current) clearInterval(timerRef.current);
          setIsRecording(false);
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleConfirm = async () => {
    if (!recordedFile) return;
    await onVideoRecorded(recordedFile);
    handleCancel();
  };

  const handleCancel = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedFile(null);
    setElapsed(0);
  };

  const handleRetake = () => {
    handleCancel();
    startCamera();
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stream, previewUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => startCamera()}
        disabled={isUploading}
        style={{ borderColor: colors.creamDark, color: colors.brown }}
      >
        <Video className="w-3.5 h-3.5 mr-1.5" />
        Record Video
      </Button>

      {/* Recording Dialog */}
      <Dialog open={showCamera} onOpenChange={(open) => { if (!open) stopCamera(); }}>
        <DialogContent className="max-w-2xl" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Record Tutorial Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Record a quick tutorial showing how to perform this task. Audio is included for narration.
            </p>

            {videoDevices.length > 1 && !isRecording && (
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
              <div className="relative w-full max-w-lg aspect-video bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {isRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-sm font-mono">{formatTime(elapsed)} / {formatTime(MAX_DURATION)}</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={stopCamera} style={{ borderColor: colors.creamDark, color: colors.brown }}>
                Cancel
              </Button>
              {videoDevices.length > 1 && !isRecording && (
                <Button variant="outline" onClick={switchCamera} style={{ borderColor: colors.brown, color: colors.brown }}>
                  <SwitchCamera className="w-4 h-4 mr-2" />
                  Switch Camera
                </Button>
              )}
              {!isRecording ? (
                <Button onClick={startRecording} style={{ backgroundColor: colors.red, color: 'white' }}>
                  <div className="w-4 h-4 rounded-full bg-white mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button onClick={stopRecording} style={{ backgroundColor: colors.red, color: 'white' }}>
                  <Square className="w-4 h-4 mr-2 fill-current" />
                  Stop Recording
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Review Recording</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
                {previewUrl && (
                  <video
                    ref={previewVideoRef}
                    src={previewUrl}
                    controls
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
            <div className="text-sm text-center" style={{ color: colors.brownLight }}>
              {recordedFile && `${(recordedFile.size / (1024 * 1024)).toFixed(1)} MB • ${formatTime(elapsed)}`}
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUploading}
                style={{ borderColor: colors.creamDark, color: colors.brown }}
              >
                Discard
              </Button>
              <Button
                variant="outline"
                onClick={handleRetake}
                disabled={isUploading}
                style={{ borderColor: colors.brown, color: colors.brown }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isUploading}
                style={{ backgroundColor: colors.gold, color: colors.brown }}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Save Video
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
