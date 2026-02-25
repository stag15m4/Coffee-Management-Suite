import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeOnboarding } from '@/hooks/use-employee-onboarding';
import { Clock, CalendarDays, Wrench, FileText, ListTodo, ArrowRight } from 'lucide-react';
import type { ModuleId } from '@/contexts/AuthContext';

interface FeatureItem {
  icon: React.ReactNode;
  label: string;
  moduleId?: ModuleId; // undefined = always shown
}

const FEATURES: FeatureItem[] = [
  { icon: <Clock size={16} />, label: 'Clock in/out and track your hours' },
  { icon: <CalendarDays size={16} />, label: 'View your schedule and upcoming shifts', moduleId: 'calendar-workforce' },
  { icon: <Wrench size={16} />, label: 'Report equipment issues', moduleId: 'equipment-maintenance' },
  { icon: <FileText size={16} />, label: 'Access team documents', moduleId: 'document-library' },
  { icon: <ListTodo size={16} />, label: 'Check your assigned tasks', moduleId: 'admin-tasks' },
];

export function EmployeeWelcomeCard() {
  const { profile, tenant, canAccessModule } = useAuth();
  const { onboardingProgress, isLoading, isOwner, dismissWelcome } = useEmployeeOnboarding();

  // Only for non-owners who haven't seen the welcome yet
  if (isOwner || isLoading) return null;
  if (onboardingProgress?.welcomeSeen) return null;

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const shopName = tenant?.name || 'the team';

  // Filter features to what this user can actually access
  const availableFeatures = FEATURES.filter(
    (f) => !f.moduleId || canAccessModule(f.moduleId),
  );

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{ background: 'var(--color-background)' }}
    >
      <h2
        className="text-lg font-bold mb-1"
        style={{ color: 'var(--color-secondary)' }}
      >
        Welcome to {shopName}, {firstName}!
      </h2>
      <p
        className="text-sm mb-4 opacity-70"
        style={{ color: 'var(--color-secondary)' }}
      >
        Here's what you can do from your dashboard:
      </p>

      <div className="space-y-2.5 mb-5">
        {availableFeatures.map((feature, i) => (
          <div
            key={i}
            className="flex items-center gap-3 text-sm"
            style={{ color: 'var(--color-secondary)' }}
          >
            <span style={{ color: 'var(--color-primary)' }}>{feature.icon}</span>
            <span>{feature.label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={dismissWelcome}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-transform active:scale-95"
        style={{ background: 'var(--color-primary)' }}
      >
        Got it, let's go
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
