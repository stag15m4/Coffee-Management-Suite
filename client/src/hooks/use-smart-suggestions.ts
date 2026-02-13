import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface Suggestion {
  id: string;
  type: 'warning' | 'tip' | 'celebration';
  title: string;
  body: string;
  action?: { label: string; href: string };
}

interface Recipe {
  id: string;
  name: string;
  food_cost_percentage?: number;
}

interface CashDeposit {
  id: string;
  created_at: string;
}

interface Equipment {
  id: string;
  name: string;
  next_maintenance_date?: string;
}

const DISMISSED_KEY = 'smart-suggestions-dismissed';
const MAX_SUGGESTIONS = 2;

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function useSmartSuggestions(): Suggestion[] {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const suggestions: Suggestion[] = [];
    const dismissed = getDismissedIds();

    // Rule 1: High food cost recipe
    const recipes = queryClient.getQueryData<Recipe[]>(['recipes']);
    if (recipes) {
      for (const recipe of recipes) {
        if (recipe.food_cost_percentage && recipe.food_cost_percentage > 35) {
          suggestions.push({
            id: `high-cost-${recipe.id}`,
            type: 'warning',
            title: 'High food cost detected',
            body: `"${recipe.name}" has a ${recipe.food_cost_percentage.toFixed(1)}% food cost. Consider reviewing the price or ingredients.`,
            action: { label: 'Review recipe', href: `/recipes/${recipe.id}` },
          });
        }
      }

      // Rule 4: First recipe celebration
      if (recipes.length === 1) {
        suggestions.push({
          id: 'first-recipe',
          type: 'celebration',
          title: 'Your first recipe!',
          body: 'You created your first recipe. Keep going to build out your full menu!',
        });
      }
    }

    // Rule 2: No deposit in 2+ days
    const deposits = queryClient.getQueryData<CashDeposit[]>(['cash-deposits']);
    if (deposits && deposits.length > 0) {
      const sorted = [...deposits].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = new Date(sorted[0].created_at);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      if (latest < twoDaysAgo) {
        suggestions.push({
          id: 'stale-deposit',
          type: 'tip',
          title: 'Cash deposit reminder',
          body: "It's been over 2 days since your last cash deposit. Don't forget to log today's deposit.",
          action: { label: 'Log deposit', href: '/cash-deposits' },
        });
      }
    }

    // Rule 3: Equipment overdue maintenance
    const equipment = queryClient.getQueryData<Equipment[]>(['equipment']);
    if (equipment) {
      const today = new Date().toISOString().split('T')[0];
      for (const item of equipment) {
        if (item.next_maintenance_date && item.next_maintenance_date < today) {
          suggestions.push({
            id: `overdue-equip-${item.id}`,
            type: 'warning',
            title: 'Overdue maintenance',
            body: `"${item.name}" is past its scheduled maintenance date.`,
            action: { label: 'View equipment', href: '/equipment' },
          });
        }
      }
    }

    // Filter dismissed and limit
    return suggestions.filter((s) => !dismissed.has(s.id)).slice(0, MAX_SUGGESTIONS);
  }, [queryClient]);
}
