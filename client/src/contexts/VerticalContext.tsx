import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types — matches the DB `verticals` table JSONB columns
// ---------------------------------------------------------------------------

export interface VerticalTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  logoUrl: string | null;
  iconEmoji: string;
  loadingText: string;
}

export interface VerticalTerm {
  singular: string;
  plural: string;
}

export interface VerticalConfig {
  id: string;
  slug: string;
  productName: string;
  displayName: string;
  theme: VerticalTheme;
  terms: Record<string, VerticalTerm>;
  workflows: Record<string, boolean>;
  suggestedModules: string[];
  landingContent: {
    headline?: string;
    subheadline?: string;
    heroImage?: string | null;
    ctaText?: string;
  };
}

export interface VerticalContextType {
  vertical: VerticalConfig | null;
  loading: boolean;
  term: (key: string, options?: { plural?: boolean; capitalize?: boolean }) => string;
  termPlural: (key: string, options?: { capitalize?: boolean }) => string;
  hasWorkflow: (flag: string) => boolean;
}

// ---------------------------------------------------------------------------
// Default terms — used when the vertical doesn't define a given key
// ---------------------------------------------------------------------------

const DEFAULT_TERMS: Record<string, VerticalTerm> = {
  recipe: { singular: 'Recipe', plural: 'Recipes' },
  ingredient: { singular: 'Ingredient', plural: 'Ingredients' },
  recipeUnit: { singular: 'item', plural: 'items' },
  menuItem: { singular: 'Menu Item', plural: 'Menu Items' },
  vendor: { singular: 'Vendor', plural: 'Vendors' },
  equipment: { singular: 'Equipment', plural: 'Equipment' },
  deposit: { singular: 'Cash Deposit', plural: 'Cash Deposits' },
  tipPayout: { singular: 'Tip Payout', plural: 'Tip Payouts' },
  employee: { singular: 'Team Member', plural: 'Team Members' },
  location: { singular: 'Location', plural: 'Locations' },
  task: { singular: 'Task', plural: 'Tasks' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a raw DB row (snake_case JSONB) into a typed VerticalConfig. */
function parseVerticalRow(row: any): VerticalConfig {
  return {
    id: row.id,
    slug: row.slug,
    productName: row.product_name ?? row.productName ?? '',
    displayName: row.display_name ?? row.displayName ?? '',
    theme: row.theme ?? {
      primaryColor: '#C9A227',
      secondaryColor: '#4A3728',
      accentColor: '#6B5344',
      backgroundColor: '#FFFFFF',
      logoUrl: null,
      iconEmoji: '',
      loadingText: 'Loading...',
    },
    terms: row.terms ?? {},
    workflows: row.workflows ?? {},
    suggestedModules: row.suggested_modules ?? row.suggestedModules ?? [],
    landingContent: row.landing_content ?? row.landingContent ?? {},
  };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const VerticalContext = createContext<VerticalContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface VerticalProviderProps {
  children: React.ReactNode;
  /** Override the vertical ID to load (useful for testing or landing pages). */
  verticalId?: string;
}

export function VerticalProvider({ children, verticalId: verticalIdProp }: VerticalProviderProps) {
  const { tenant } = useAuth();

  const [vertical, setVertical] = useState<VerticalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVertical() {
      // 1. Determine the vertical ID to query
      const explicitId = verticalIdProp ?? (tenant as any)?.vertical_id;

      // 2. Try domain-based lookup first (for branded product domains)
      const hostname = window.location.hostname;

      // Skip domain lookup for localhost / dev environments
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');

      if (!isLocal && !explicitId) {
        try {
          const { data: domainRow, error: domainError } = await supabase
            .from('verticals')
            .select('*')
            .contains('domains', [hostname])
            .single();

          if (!domainError && domainRow && !cancelled) {
            const config = parseVerticalRow(domainRow);
            setVertical(config);
            fetchedRef.current = config.id;
            setLoading(false);
            return;
          }
        } catch {
          // Domain lookup failed — fall through to ID-based lookup
        }
      }

      // 3. Fall back to ID-based lookup
      if (explicitId) {
        // Avoid re-fetching the same vertical
        if (fetchedRef.current === explicitId) {
          setLoading(false);
          return;
        }

        try {
          const { data: row, error } = await supabase
            .from('verticals')
            .select('*')
            .eq('id', explicitId)
            .single();

          if (!error && row && !cancelled) {
            const config = parseVerticalRow(row);
            setVertical(config);
            fetchedRef.current = config.id;
            setLoading(false);
            return;
          }
        } catch {
          // Query failed — fall through to defaults
        }
      }

      // 4. No vertical found — that's fine, use defaults
      if (!cancelled) {
        setVertical(null);
        setLoading(false);
      }
    }

    loadVertical();

    return () => {
      cancelled = true;
    };
  }, [verticalIdProp, tenant]);

  // -----------------------------------------------------------------------
  // term() — look up a terminology key, fall back to DEFAULT_TERMS
  // -----------------------------------------------------------------------
  const term = useCallback(
    (key: string, options?: { plural?: boolean; capitalize?: boolean }): string => {
      const termEntry = vertical?.terms[key] ?? DEFAULT_TERMS[key];

      if (!termEntry) {
        // Unknown key — return the key itself as a readable fallback
        return options?.capitalize ? capitalize(key) : key;
      }

      const value = options?.plural ? termEntry.plural : termEntry.singular;

      if (options?.capitalize) {
        return capitalize(value);
      }

      return value;
    },
    [vertical],
  );

  // -----------------------------------------------------------------------
  // termPlural() — convenience wrapper
  // -----------------------------------------------------------------------
  const termPlural = useCallback(
    (key: string, options?: { capitalize?: boolean }): string => {
      return term(key, { plural: true, ...options });
    },
    [term],
  );

  // -----------------------------------------------------------------------
  // hasWorkflow() — check a workflow flag, defaulting to false
  // -----------------------------------------------------------------------
  const hasWorkflow = useCallback(
    (flag: string): boolean => {
      return vertical?.workflows[flag] ?? false;
    },
    [vertical],
  );

  return (
    <VerticalContext.Provider value={{ vertical, loading, term, termPlural, hasWorkflow }}>
      {children}
    </VerticalContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVertical(): VerticalContextType {
  const context = useContext(VerticalContext);
  if (context === undefined) {
    throw new Error('useVertical must be used within a VerticalProvider');
  }
  return context;
}
