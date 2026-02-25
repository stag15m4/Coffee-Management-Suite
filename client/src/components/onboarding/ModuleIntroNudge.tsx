import { useSetupProgress } from '@/hooks/use-setup-progress';
import { useEmployeeOnboarding } from '@/hooks/use-employee-onboarding';
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
  // Owner path: tenant-level setup_progress
  const ownerData = useSetupProgress();
  // Non-owner path: per-user onboarding_progress
  const employeeData = useEmployeeOnboarding();

  const isOwner = ownerData.isOwner;

  if (isOwner) {
    // Owner: use tenant-level tracking (existing behavior)
    if (ownerData.isLoading || !ownerData.setupProgress) return null;
    if (ownerData.setupProgress.modulesIntroduced?.includes(moduleId)) return null;
  } else {
    // Non-owner: use per-user tracking
    if (employeeData.isLoading) return null;
    if (employeeData.onboardingProgress?.modulesIntroduced?.includes(moduleId)) return null;
  }

  const handleDismiss = () => {
    if (isOwner) {
      ownerData.markModuleIntroduced(moduleId);
    } else {
      employeeData.markModuleIntroduced(moduleId);
    }
  };

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
