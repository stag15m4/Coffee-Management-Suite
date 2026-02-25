import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';

export interface EmployeeOnboardingProgress {
  welcomeSeen?: boolean;
  modulesIntroduced?: string[];
}

/**
 * Per-user onboarding progress for non-owner roles.
 * Mirrors the owner-level useSetupProgress pattern but stores state
 * on user_profiles.onboarding_progress instead of tenants.setup_progress.
 */
export function useEmployeeOnboarding() {
  const { user, profile, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const isOwner = hasRole?.('owner') ?? false;

  const { data: onboardingProgress, isLoading } = useQuery<EmployeeOnboardingProgress>({
    queryKey: ['employee-onboarding', userId],
    queryFn: async () => {
      if (!userId) return {};
      const { data } = await supabase
        .from('user_profiles')
        .select('onboarding_progress')
        .eq('id', userId)
        .single();
      return (data?.onboarding_progress as EmployeeOnboardingProgress) || {};
    },
    enabled: !!userId && !isOwner,
    staleTime: 5 * 60 * 1000,
  });

  const updateProgress = useCallback(
    async (patch: Partial<EmployeeOnboardingProgress>) => {
      if (!userId) return;
      const current =
        queryClient.getQueryData<EmployeeOnboardingProgress>(['employee-onboarding', userId]) ?? {};
      const next = { ...current, ...patch };
      // Optimistic update
      queryClient.setQueryData(['employee-onboarding', userId], next);
      await supabase
        .from('user_profiles')
        .update({ onboarding_progress: next })
        .eq('id', userId);
    },
    [userId, queryClient],
  );

  const dismissWelcome = useCallback(async () => {
    await updateProgress({ welcomeSeen: true });
  }, [updateProgress]);

  const markModuleIntroduced = useCallback(
    async (moduleId: string) => {
      const current = onboardingProgress?.modulesIntroduced ?? [];
      if (current.includes(moduleId)) return;
      await updateProgress({ modulesIntroduced: [...current, moduleId] });
    },
    [onboardingProgress, updateProgress],
  );

  return {
    onboardingProgress,
    isLoading,
    isOwner,
    updateProgress,
    dismissWelcome,
    markModuleIntroduced,
  };
}
