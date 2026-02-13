import { X } from 'lucide-react';
import { useLocation } from 'wouter';

interface NudgeCardProps {
  icon: React.ReactNode;
  message: string;
  actionLabel: string;
  actionHref: string;
  onDismiss?: () => void;
}

export function NudgeCard({ icon, message, actionLabel, actionHref, onDismiss }: NudgeCardProps) {
  const [, setLocation] = useLocation();

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        background: 'var(--color-accent)',
        border: '1px solid var(--color-accent-dark)',
      }}
    >
      <div className="shrink-0" style={{ color: 'var(--color-primary)' }}>
        {icon}
      </div>
      <span className="flex-1 text-sm" style={{ color: 'var(--color-secondary)' }}>
        {message}
      </span>
      <button
        className="shrink-0 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-primary)' }}
        onClick={() => setLocation(actionHref)}
      >
        {actionLabel}
      </button>
      {onDismiss && (
        <button
          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
