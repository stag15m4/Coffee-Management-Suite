import { AlertTriangle, Lightbulb, PartyPopper, X } from 'lucide-react';

interface SmartSuggestionProps {
  type: 'warning' | 'tip' | 'celebration';
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}

const config = {
  warning: { bg: 'bg-orange-50', accent: 'border-orange-500', text: 'text-orange-500', Icon: AlertTriangle },
  tip: { bg: 'bg-blue-50', accent: 'border-blue-500', text: 'text-blue-500', Icon: Lightbulb },
  celebration: { bg: 'bg-green-50', accent: 'border-green-500', text: 'text-green-500', Icon: PartyPopper },
};

export function SmartSuggestion({ type, title, body, action, onDismiss }: SmartSuggestionProps) {
  const { bg, accent, text, Icon } = config[type];

  return (
    <div className={`${bg} border-l-4 ${accent} rounded-lg p-4 max-w-full relative`}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 ${text} shrink-0 mt-0.5`} />
        <div className="min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--color-secondary)' }}>
            {title}
          </p>
          <p className="text-sm text-gray-600 mt-0.5">{body}</p>
          {action && (
            <button onClick={action.onClick} className={`text-sm font-medium ${text} mt-1.5 hover:underline`}>
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
