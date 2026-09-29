import type { Session } from '@supabase/supabase-js';

type SessionResult = { data: { session: Session | null }; error: unknown };

interface ResumeOptions {
  getSession: () => Promise<SessionResult>;
  refreshSession: () => Promise<SessionResult>;
  onLongResume: () => void;
  onError: (error: unknown) => void;
  isActive: () => boolean;
}

async function withDeadline<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        // Auth refresh also awaits the bootstrap callback (up to eight seconds).
        timeout = setTimeout(() => reject(new Error('Session resume timed out')), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function createSessionResumeHandler(options: ResumeOptions) {
  let inFlight = false;
  return async (hiddenForMs: number): Promise<void> => {
    if (hiddenForMs < 5000 || inFlight || !options.isActive()) return;
    inFlight = true;
    try {
      let result = await withDeadline(options.getSession());
      if (!options.isActive()) return;
      if (result.error) throw result.error;
      if (!result.data.session) return;

      const expiresAt = (result.data.session.expires_at ?? 0) * 1000;
      if (expiresAt < Date.now() + 60000) {
        result = await withDeadline(options.refreshSession());
        if (!options.isActive()) return;
        if (result.error) throw result.error;
        if (!result.data.session) return;
      }

      // Supabase emits TOKEN_REFRESHED and AuthContext bootstraps there.
      // Do not start a second bootstrap or overwrite newer auth state here.
      if (hiddenForMs > 300000) options.onLongResume();
    } catch (error) {
      if (options.isActive()) options.onError(error);
    } finally {
      inFlight = false;
    }
  };
}
