import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import {
  Users,
  ShoppingBasket,
  ChefHat,
  DollarSign,
  Check,
  X,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 'team',
    title: 'Add your team',
    description: 'Invite 1-3 team members to get them started.',
    href: '/admin/users',
    icon: Users,
  },
  {
    id: 'ingredients',
    title: 'Stock your pantry',
    description: 'Load starter ingredients or add your own.',
    href: '/recipe-costing?tab=ingredients',
    icon: ShoppingBasket,
  },
  {
    id: 'recipe',
    title: 'Build your first recipe',
    description: 'See what it really costs to make.',
    href: '/recipe-costing?tab=recipes',
    icon: ChefHat,
  },
  {
    id: 'drawer',
    title: 'Set your cash drawer',
    description: 'Enter your starting drawer amount.',
    href: '/cash-deposit',
    icon: DollarSign,
  },
];

interface SetupProgress {
  completedSteps?: string[];
  dismissed?: boolean;
}

export function SetupWizard() {
  const { tenant, hasRole } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Fetch stored setup_progress from tenant
  const { data: setupProgress } = useQuery<SetupProgress>({
    queryKey: ['tenant-setup', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return {};
      const { data } = await supabase
        .from('tenants')
        .select('setup_progress')
        .eq('id', tenant.id)
        .single();
      return (data?.setup_progress as SetupProgress) || {};
    },
    enabled: !!tenant?.id,
  });

  // Auto-detect completion from existing data
  const { data: autoComplete } = useQuery({
    queryKey: ['tenant-setup-auto', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return {} as Record<string, boolean>;
      const [profiles, assignments, ingredients, recipes, tenantRow] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
        supabase
          .from('user_tenant_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('is_active', true),
        supabase
          .from('ingredients')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
        supabase
          .from('recipes')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
        supabase
          .from('tenants')
          .select('starting_drawer_default')
          .eq('id', tenant.id)
          .single(),
      ]);
      return {
        team: ((profiles.count ?? 0) + (assignments.count ?? 0)) > 1,
        ingredients: (ingredients.count ?? 0) > 0,
        recipe: (recipes.count ?? 0) > 0,
        drawer: tenantRow.data?.starting_drawer_default != null,
      };
    },
    enabled: !!tenant?.id,
  });

  const completedStepIds = useMemo(() => {
    const stored = new Set(setupProgress?.completedSteps ?? []);
    if (autoComplete) {
      for (const [key, done] of Object.entries(autoComplete)) {
        if (done) stored.add(key);
      }
    }
    return stored;
  }, [setupProgress, autoComplete]);

  const completedCount = SETUP_STEPS.filter((s) => completedStepIds.has(s.id)).length;
  const allDone = completedCount === SETUP_STEPS.length;

  async function updateProgress(patch: Partial<SetupProgress>) {
    if (!tenant?.id) return;
    const current = setupProgress ?? {};
    const next = { ...current, ...patch };
    await supabase.from('tenants').update({ setup_progress: next }).eq('id', tenant.id);
    queryClient.setQueryData(['tenant-setup', tenant.id], next);
  }

  async function markStepComplete(stepId: string) {
    const current = setupProgress?.completedSteps ?? [];
    if (current.includes(stepId)) return;
    await updateProgress({ completedSteps: [...current, stepId] });
  }

  async function dismissWizard() {
    await updateProgress({ dismissed: true });
  }

  // Only show for owners
  if (!hasRole('owner')) return null;
  // Hide if dismissed or all done or still loading
  if (!setupProgress || setupProgress.dismissed || allDone) return null;

  const firstIncompleteId = SETUP_STEPS.find((s) => !completedStepIds.has(s.id))?.id;

  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden mb-6"
      style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent)' }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <Target className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
        <h3 className="font-semibold text-base flex-1" style={{ color: 'var(--color-secondary)' }}>
          Get set up
        </h3>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          {completedCount} of {SETUP_STEPS.length} complete
        </span>
        <button
          onClick={dismissWizard}
          className="p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Dismiss setup wizard"
        >
          <X className="w-4 h-4 opacity-40" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-5 mb-4 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-accent)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(completedCount / SETUP_STEPS.length) * 100}%`,
            backgroundColor: 'var(--color-primary)',
          }}
        />
      </div>

      {/* Steps */}
      <div className="px-5 pb-5 space-y-1">
        {SETUP_STEPS.map((step) => {
          const done = completedStepIds.has(step.id);
          const isActive = !done && step.id === firstIncompleteId;
          const Icon = step.icon;

          return (
            <div key={step.id} className="py-2">
              <div className="flex items-center gap-3">
                {done ? (
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  </div>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: isActive ? 'var(--color-primary)' : '#d1d5db' }}
                  >
                    <Icon
                      className="w-3 h-3"
                      style={{ color: isActive ? 'var(--color-primary)' : '#9ca3af' }}
                    />
                  </div>
                )}
                <span
                  className={`text-sm font-medium ${done ? 'line-through opacity-50' : ''}`}
                  style={{ color: 'var(--color-secondary)' }}
                >
                  {step.title}
                </span>
              </div>

              {isActive && (
                <div className="ml-9 mt-1.5 space-y-2">
                  <p className="text-sm opacity-60" style={{ color: 'var(--color-secondary)' }}>
                    {step.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(step.href)}
                      style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                    >
                      Set up &rarr;
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-50 hover:opacity-100"
                      onClick={() => markStepComplete(step.id)}
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
