import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-queries';
import type { ModuleId } from '@/contexts/AuthContext';

export type RolloutStatus = 'internal' | 'beta' | 'ga';

export function useModuleRollout() {
  const [statuses, setStatuses] = useState<Record<string, RolloutStatus>>({});

  useEffect(() => {
    supabase
      .from('modules')
      .select('id, rollout_status')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, RolloutStatus> = {};
        for (const row of data) {
          map[row.id] = (row.rollout_status || 'ga') as RolloutStatus;
        }
        setStatuses(map);
      });
  }, []);

  const getRolloutBadge = useCallback((moduleId: ModuleId): string | undefined => {
    const status = statuses[moduleId];
    if (status === 'beta') return 'Beta';
    if (status === 'internal') return 'Internal';
    return undefined;
  }, [statuses]);

  return { statuses, getRolloutBadge };
}
