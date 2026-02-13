import { useVertical } from '@/contexts/VerticalContext';

/**
 * Convenience hook for vertical-aware terminology.
 *
 * Usage:
 *   const { term, termPlural } = useTerm();
 *   <h1>{termPlural('recipe')}</h1>        // "Recipes" (or vertical override)
 *   <p>Add a new {term('ingredient')}</p>   // "Ingredient" (or vertical override)
 */
export function useTerm() {
  const { term, termPlural } = useVertical();
  return { term, termPlural };
}
