import { useSetupProgress } from '@/hooks/use-setup-progress';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModuleIntroNudgeProps {
  moduleId: string;
  icon: ReactNode;
  message: string;
}

export function ModuleIntroNudge({
  moduleId,
  icon,
  message,
}: ModuleIntroNudgeProps) {
  const { setupProgress, isLoading, isOwner, markModuleIntroduced } = useSetupProgress();

  // Only show for owners who haven't seen this module intro yet
  if (!isOwner || isLoading || !setupProgress) return null;
  if (setupProgress.modulesIntroduced?.includes(moduleId)) return null;

  const handleDismiss = () => markModuleIntroduced(moduleId);

  return (
    <div
      className="flex items-start gap-3 rounded-lg px-4 py-3 mb-4"
      style={{
        background: 'var(--color-accent)',
        border: '1px solid var(--color-accent-dark)',
      }}
    >
      <div className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }}>
        {icon}
      </div>
      <span className="flex-1 text-sm leading-relaxed" style={{ color: 'var(--color-secondary)' }}>
        {message}
      </span>
      <button
        className="shrink-0 text-sm font-medium px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
        style={{ color: 'var(--color-primary)' }}
        onClick={handleDismiss}
      >
        Got it
      </button>
      <button
        className="shrink-0 opacity-40 hover:opacity-100 transition-opacity mt-0.5"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
