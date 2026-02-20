import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-queries';
import type { ModuleId } from '@/contexts/AuthContext';

export type RolloutStatus = 'internal' | 'beta' | 'ga';

const rolloutCache: Record<string, RolloutStatus> = {};

export function useModuleRollout() {
  const [statuses, setStatuses] = useState<Record<string, RolloutStatus>>(rolloutCache);

  useEffect(() => {
    if (Object.keys(rolloutCache).length > 0) return;

    supabase
      .from('modules')
      .select('id, rollout_status')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, RolloutStatus> = {};
        for (const row of data) {
          map[row.id] = (row.rollout_status || 'ga') as RolloutStatus;
          rolloutCache[row.id] = map[row.id];
        }
        setStatuses(map);
      });
  }, []);

  const getRolloutBadge = (moduleId: ModuleId): string | undefined => {
    const status = statuses[moduleId];
    if (status === 'beta') return 'Beta';
    if (status === 'internal') return 'Internal';
    return undefined;
  };

  return { statuses, getRolloutBadge };
}
