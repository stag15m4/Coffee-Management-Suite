import { useAuth, Tenant } from '@/contexts/AuthContext';

export interface TrialStatus {
  isTrial: boolean;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  trialProgress: number;
  trialUrgent: boolean;
}

/**
 * Centralizes trial period calculation logic.
 * Pass an override tenant to compute status for an arbitrary tenant (e.g. platform admin cards).
 * Otherwise defaults to the current auth context tenant.
 */
export function useTrialStatus(
  overrideTenant?: Pick<Tenant, 'subscription_plan' | 'trial_ends_at'> | null,
): TrialStatus {
  const { tenant: authTenant } = useAuth();
  const t = overrideTenant !== undefined ? overrideTenant : authTenant;

  const isTrial = t?.subscription_plan === 'free' || !t?.subscription_plan;
  const trialEndsAt = t?.trial_ends_at ? new Date(t.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const trialExpired = isTrial && trialDaysLeft === 0;
  const trialProgress = trialEndsAt && trialDaysLeft !== null
    ? Math.max(0, Math.min(100, ((14 - trialDaysLeft) / 14) * 100))
    : 0;
  const trialUrgent = trialDaysLeft !== null && trialDaysLeft <= 3;

  return { isTrial, trialEndsAt, trialDaysLeft, trialExpired, trialProgress, trialUrgent };
}

/**
 * Compute trial status from raw tenant data without requiring React context.
 * Useful in .map() renders like platform admin cards.
 */
export function getTrialStatus(
  tenant: { subscription_plan?: string | null; trial_ends_at?: string | null } | null,
): TrialStatus {
  const isTrial = tenant?.subscription_plan === 'free' || !tenant?.subscription_plan;
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const trialExpired = isTrial && trialDaysLeft === 0;
  const trialProgress = trialEndsAt && trialDaysLeft !== null
    ? Math.max(0, Math.min(100, ((14 - trialDaysLeft) / 14) * 100))
    : 0;
  const trialUrgent = trialDaysLeft !== null && trialDaysLeft <= 3;

  return { isTrial, trialEndsAt, trialDaysLeft, trialExpired, trialProgress, trialUrgent };
}
