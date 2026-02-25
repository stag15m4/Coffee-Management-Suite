import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useVertical } from '@/contexts/VerticalContext';
import { supabase, queryKeys } from '@/lib/supabase-queries';

export interface SetupProgress {
  completedSteps?: string[];
  dismissed?: boolean;
  welcomeSeen?: boolean;
  modulesIntroduced?: string[];
  currentPhase?: number;
  celebrationSeen?: boolean;
}

export interface SetupStepDef {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string; // lucide icon name — resolved in the component
  phase: number;
}

export const SETUP_PHASES = [
  { id: 1, title: 'The Basics', description: 'Team & operations' },
  { id: 2, title: 'Your Menu', description: 'Ingredients & recipes' },
  { id: 3, title: 'Daily Operations', description: 'Cash & overhead' },
] as const;

export const SETUP_STEPS: SetupStepDef[] = [
  // Phase 1 — The Basics
  {
    id: 'team',
    title: 'Invite your team',
    description:
      'Add managers and employees so they can clock in, receive tips, and see their schedules.',
    href: '/admin/users',
    icon: 'Users',
    phase: 1,
  },
  {
    id: 'hours',
    title: 'Set your store profile',
    description:
      'Add your address, phone number, and operating hours so your team and reports have the right info.',
    href: '/store/:tenantId',
    icon: 'Clock',
    phase: 1,
  },
  // Phase 2 — Your Menu
  {
    id: 'ingredients',
    title: 'Stock your pantry',
    description:
      'Add the ingredients you use daily. This is the foundation for accurate recipe costing.',
    href: '/recipe-costing?tab=ingredients',
    icon: 'ShoppingBasket',
    phase: 2,
  },
  {
    id: 'sizes',
    title: 'Set your cup sizes',
    description:
      'Define the sizes you sell (Small, Medium, Large) so recipes can cost per size.',
    href: '/recipe-costing?tab=sizes',
    icon: 'CupSoda',
    phase: 2,
  },
  {
    id: 'recipe',
    title: 'Build your first recipe',
    description:
      "See exactly what it costs to make each drink — you'll be surprised!",
    href: '/recipe-costing?tab=recipes',
    icon: 'ChefHat',
    phase: 2,
  },
  // Phase 3 — Daily Operations
  {
    id: 'drawer',
    title: 'Set your cash drawer',
    description:
      'Enter your starting drawer amount so daily deposits calculate correctly.',
    href: '/cash-deposit',
    icon: 'DollarSign',
    phase: 3,
  },
  {
    id: 'overhead',
    title: 'Add overhead expenses',
    description:
      'Rent, utilities, insurance — knowing your overhead reveals your true profit per drink.',
    href: '/recipe-costing?tab=overhead',
    icon: 'Building2',
    phase: 3,
  },
];

export function useSetupProgress() {
  const { tenant, hasRole } = useAuth();
  const { vertical } = useVertical();
  const queryClient = useQueryClient();
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const isOwner = hasRole?.('owner') ?? false;

  // Fetch stored setup_progress from tenant
  const { data: setupProgress, isLoading } = useQuery<SetupProgress>({
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
    enabled: !!tenant?.id && isOwner,
  });

  // Auto-detect completion from existing data
  const { data: autoComplete } = useQuery({
    queryKey: ['tenant-setup-auto', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return {} as Record<string, boolean>;
      const [profiles, assignments, ingredients, sizes, recipes, tenantRow, overheadItems, storeHours] =
        await Promise.all([
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
            .from('product_sizes')
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
          supabase
            .from('overhead_items')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id),
          supabase
            .from('store_operating_hours')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id),
        ]);
      return {
        team: (profiles.count ?? 0) + (assignments.count ?? 0) > 1,
        hours: (storeHours.count ?? 0) > 0,
        ingredients: (ingredients.count ?? 0) > 0,
        sizes: (sizes.count ?? 0) > 0,
        recipe: (recipes.count ?? 0) > 0,
        drawer: tenantRow.data?.starting_drawer_default != null,
        overhead: (overheadItems.count ?? 0) > 0,
      };
    },
    enabled: !!tenant?.id && isOwner,
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

  const updateProgress = useCallback(
    async (patch: Partial<SetupProgress>) => {
      if (!tenant?.id) return;
      // Read latest from cache to avoid stale overwrites
      const current =
        (queryClient.getQueryData<SetupProgress>(['tenant-setup', tenant.id]) as SetupProgress) ??
        {};
      const next = { ...current, ...patch };
      // Optimistic update
      queryClient.setQueryData(['tenant-setup', tenant.id], next);
      await supabase.from('tenants').update({ setup_progress: next }).eq('id', tenant.id);
    },
    [tenant?.id, queryClient],
  );

  const markStepComplete = useCallback(
    async (stepId: string) => {
      const current = setupProgress?.completedSteps ?? [];
      if (current.includes(stepId)) return;
      await updateProgress({ completedSteps: [...current, stepId] });
    },
    [setupProgress, updateProgress],
  );

  const markModuleIntroduced = useCallback(
    async (moduleId: string) => {
      const current = setupProgress?.modulesIntroduced ?? [];
      if (current.includes(moduleId)) return;
      await updateProgress({ modulesIntroduced: [...current, moduleId] });
    },
    [setupProgress, updateProgress],
  );

  const dismissWizard = useCallback(async () => {
    await updateProgress({ dismissed: true });
  }, [updateProgress]);

  const loadStarterData = useCallback(
    async (templateType: 'ingredient' | 'recipe') => {
      if (!tenant?.id || !vertical?.id) return;
      setLoadingTemplates(true);
      try {
        const { data: templates } = await supabase
          .from('vertical_templates')
          .select('name, data')
          .eq('vertical_id', vertical.id)
          .eq('template_type', templateType)
          .eq('is_active', true)
          .order('sort_order');

        if (!templates || templates.length === 0) return;

        if (templateType === 'ingredient') {
          const rows = templates.map((t) => {
            const d = t.data as Record<string, any>;
            return {
              name: d.name || t.name,
              unit: d.unit || 'each',
              cost: d.typical_cost ?? 0,
              quantity: d.typical_quantity ?? 1,
              ingredient_type: d.category === 'Supplies' ? 'Supply' : 'FOH Ingredient',
              tenant_id: tenant.id,
            };
          });
          await supabase.from('ingredients').insert(rows);
          queryClient.invalidateQueries({ queryKey: queryKeys.ingredients });
        }

        queryClient.invalidateQueries({ queryKey: ['tenant-setup-auto', tenant.id] });
        await markStepComplete(templateType === 'ingredient' ? 'ingredients' : 'recipe');
      } finally {
        setLoadingTemplates(false);
      }
    },
    [tenant?.id, vertical?.id, queryClient, markStepComplete],
  );

  return {
    setupProgress,
    isLoading,
    isOwner,
    autoComplete,
    completedStepIds,
    completedCount,
    allDone,
    updateProgress,
    markStepComplete,
    markModuleIntroduced,
    dismissWizard,
    loadStarterData,
    loadingTemplates,
    hasVerticalTemplates: !!vertical?.id,
  };
}
