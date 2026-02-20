import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';

const DEBOUNCE_MS = 60_000;
const lastVisitMap = new Map<string, number>();

export function useModuleTracking(moduleId: string | undefined) {
  const { user, tenant } = useAuth();
  const userId = user?.id;
  const tenantId = tenant?.id;
  const hasFired = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!moduleId || !userId || !tenantId) return;
    // Only fire once per moduleId value
    if (hasFired.current === moduleId) return;

    const key = `${tenantId}:${moduleId}`;
    const lastVisit = lastVisitMap.get(key) || 0;
    if (Date.now() - lastVisit < DEBOUNCE_MS) {
      hasFired.current = moduleId;
      return;
    }

    hasFired.current = moduleId;
    lastVisitMap.set(key, Date.now());

    supabase.from('tenant_activity_log').insert({
      tenant_id: tenantId,
      user_id: userId,
      action: 'module_visit',
      details: { module_id: moduleId },
    }).then(() => {}).catch(() => {});
  }, [moduleId, userId, tenantId]);
}
