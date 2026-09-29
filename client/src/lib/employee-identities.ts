export interface UnifiedEmployee {
  name: string;
  user_profile_id: string | null;
  tip_employee_id: string | null;
  avatar_url: string | null;
  role: string | null;
  schedule_color: string | null;
  hourly_rate: number | null;
  start_date: string | null;
  source: 'profile' | 'tip' | 'both';
}
interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
  schedule_color?: string | null;
  hourly_rate?: number | null;
  start_date?: string | null;
}
interface Roster {
  id: string;
  name: string;
  user_profile_id?: string | null;
  schedule_color?: string | null;
}
export function mergeEmployeeIdentities(profiles: Profile[], roster: Roster[]): UnifiedEmployee[] {
  const byId = new Map<string, UnifiedEmployee>();
  for (const p of profiles)
    byId.set(p.id, {
      name: (p.full_name || p.email || p.id).trim(),
      user_profile_id: p.id,
      tip_employee_id: null,
      avatar_url: p.avatar_url,
      role: p.role,
      schedule_color: p.schedule_color ?? null,
      hourly_rate: p.hourly_rate ?? null,
      start_date: p.start_date ?? null,
      source: 'profile',
    });
  const unresolved: UnifiedEmployee[] = [];
  for (const t of roster) {
    const existing = t.user_profile_id ? byId.get(t.user_profile_id) : undefined;
    if (existing && !existing.tip_employee_id) {
      existing.tip_employee_id = t.id;
      existing.schedule_color ??= t.schedule_color ?? null;
      existing.source = 'both';
    } else {
      unresolved.push({
        name: t.name.trim(),
        user_profile_id: null,
        tip_employee_id: t.id,
        avatar_url: null,
        role: null,
        schedule_color: t.schedule_color ?? null,
        hourly_rate: null,
        start_date: null,
        source: 'tip',
      });
    }
  }
  return [...byId.values(), ...unresolved].sort((a, b) => a.name.localeCompare(b.name));
}
