import { useVertical } from '@/contexts/VerticalContext';

/**
 * Convenience hook for checking vertical workflow flags.
 *
 * Usage:
 *   const { hasWorkflow } = useWorkflow();
 *   if (hasWorkflow('uses-bases')) { ... }
 */
export function useWorkflow() {
  const { hasWorkflow } = useVertical();
  return { hasWorkflow };
}

/**
 * Targeted hook that returns a single boolean for one workflow flag.
 *
 * Usage:
 *   const usesBases = useHasWorkflow('uses-bases');
 *   if (usesBases) { ... }
 */
export function useHasWorkflow(flag: string): boolean {
  const { hasWorkflow } = useVertical();
  return hasWorkflow(flag);
}
