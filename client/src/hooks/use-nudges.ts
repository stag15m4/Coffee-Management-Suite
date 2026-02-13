import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Receipt, DollarSign, Wrench, type LucideIcon } from 'lucide-react';

export interface Nudge {
  id: string;
  icon: LucideIcon;
  message: string;
  actionLabel: string;
  actionHref: string;
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

const MAX_NUDGES = 2;

function getDismissedKey(): string {
  const today = new Date().toISOString().split('T')[0];
  return `nudges-dismissed-${today}`;
}

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(getDismissedKey());
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function dismissNudge(id: string): void {
  const key = getDismissedKey();
  const dismissed = getDismissedIds();
  dismissed.add(id);
  localStorage.setItem(key, JSON.stringify(Array.from(dismissed)));
}

export function useNudges(): Nudge[] {
  const queryClient = useQueryClient();
  const { canAccessModule } = useAuth();

  return useMemo(() => {
    const nudges: Nudge[] = [];
    const dismissed = getDismissedIds();

    // Rule 1: Deposit reminder
    if (canAccessModule('cash-deposit')) {
      const deposits = queryClient.getQueryData<CashDeposit[]>(['cash-deposits']);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      if (!deposits || deposits.length === 0) {
        nudges.push({
          id: 'deposit-reminder',
          icon: Receipt,
          message: "Don't forget to log yesterday's cash deposit.",
          actionLabel: 'Log deposit',
          actionHref: '/cash-deposit',
        });
      } else {
        const sorted = [...deposits].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        if (new Date(sorted[0].created_at) < oneDayAgo) {
          nudges.push({
            id: 'deposit-reminder',
            icon: Receipt,
            message: "Don't forget to log yesterday's cash deposit.",
            actionLabel: 'Log deposit',
            actionHref: '/cash-deposit',
          });
        }
      }
    }

    // Rule 2: Tip payout reminder on weekends
    if (canAccessModule('tip-payout')) {
      const day = new Date().getDay();
      if (day === 0 || day === 6) {
        nudges.push({
          id: 'tip-reminder',
          icon: DollarSign,
          message: "It's the weekend! Calculate this week's tip payouts.",
          actionLabel: 'Calculate tips',
          actionHref: '/tip-payout',
        });
      }
    }

    // Rule 3: Overdue maintenance
    if (canAccessModule('equipment-maintenance')) {
      const equipment = queryClient.getQueryData<Equipment[]>(['equipment']);
      if (equipment) {
        const today = new Date().toISOString().split('T')[0];
        for (const item of equipment) {
          if (item.next_maintenance_date && item.next_maintenance_date < today) {
            nudges.push({
              id: `maint-overdue-${item.id}`,
              icon: Wrench,
              message: `Maintenance overdue: ${item.name}`,
              actionLabel: 'View equipment',
              actionHref: '/equipment-maintenance',
            });
          }
        }
      }
    }

    return nudges.filter((n) => !dismissed.has(n.id)).slice(0, MAX_NUDGES);
  }, [queryClient, canAccessModule]);
}
