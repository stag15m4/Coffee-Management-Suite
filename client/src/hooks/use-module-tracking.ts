import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';

const DEBOUNCE_MS = 60_000;
const lastVisitMap = new Map<string, number>();

export function useModuleTracking(moduleId: string | undefined) {
  const { user, tenant } = useAuth();
  const loggedRef = useRef(false);

  useEffect(() => {
    loggedRef.current = false;
  }, [moduleId]);

  useEffect(() => {
    if (!moduleId || !user?.id || !tenant?.id || loggedRef.current) return;

    const key = `${tenant.id}:${moduleId}`;
    const lastVisit = lastVisitMap.get(key) || 0;
    if (Date.now() - lastVisit < DEBOUNCE_MS) return;

    loggedRef.current = true;
    lastVisitMap.set(key, Date.now());

    supabase.from('tenant_activity_log').insert({
      tenant_id: tenant.id,
      user_id: user.id,
      action: 'module_visit',
      details: { module_id: moduleId },
    }).then(() => {});
  }, [moduleId, user?.id, tenant?.id]);
}
