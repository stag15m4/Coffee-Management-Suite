import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { createSessionResumeHandler } from '../../client/src/lib/session-resume';

const sessionResult = (seconds = 3600) => ({
  data: { session: { expires_at: Date.now() / 1000 + seconds } as Session },
  error: null,
});

function setup() {
  const options = {
    getSession: vi.fn().mockResolvedValue(sessionResult()),
    refreshSession: vi.fn().mockResolvedValue(sessionResult()),
    onLongResume: vi.fn(),
    onError: vi.fn(),
    isActive: vi.fn().mockReturnValue(true),
  };
  return { options, resume: createSessionResumeHandler(options) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('session resume', () => {
  it('leaves brief app switches alone', async () => {
    const { options, resume } = setup();
    await resume(4000);
    expect(options.getSession).not.toHaveBeenCalled();
  });

  it('keeps a valid session without refreshing or discarding page state', async () => {
    const { options, resume } = setup();
    await resume(30000);
    expect(options.getSession).toHaveBeenCalledTimes(1);
    expect(options.refreshSession).not.toHaveBeenCalled();
    expect(options.onLongResume).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refreshes an expiring token once and notifies pages after a long absence', async () => {
    const { options, resume } = setup();
    options.getSession.mockResolvedValue(sessionResult(30));
    await resume(360000);
    expect(options.refreshSession).toHaveBeenCalledTimes(1);
    expect(options.onLongResume).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('deduplicates concurrent resumes while the first session read is pending', async () => {
    const { options, resume } = setup();
    let resolve!: (value: ReturnType<typeof sessionResult>) => void;
    options.getSession.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const first = resume(360000);
    await resume(360000);
    expect(options.getSession).toHaveBeenCalledTimes(1);
    resolve(sessionResult());
    await first;
    expect(options.onLongResume).toHaveBeenCalledTimes(1);
  });

  it('bounds a hung initial session read and permits a later retry', async () => {
    const { options, resume } = setup();
    options.getSession.mockImplementationOnce(() => new Promise(() => {}));
    const first = resume(360000);
    await vi.advanceTimersByTimeAsync(15000);
    await first;
    expect(options.onError).toHaveBeenCalledTimes(1);
    expect(options.onLongResume).not.toHaveBeenCalled();
    await resume(360000);
    expect(options.onLongResume).toHaveBeenCalledTimes(1);
  });

  it('bounds a hung refresh and does not signal successful recovery', async () => {
    const { options, resume } = setup();
    options.getSession.mockResolvedValue(sessionResult(0));
    options.refreshSession.mockReturnValue(new Promise(() => {}));
    const pending = resume(360000);
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
    expect(options.onError).toHaveBeenCalledTimes(1);
    expect(options.onLongResume).not.toHaveBeenCalled();
  });

  it('does not refresh or resurrect a signed-out session', async () => {
    const { options, resume } = setup();
    options.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await resume(360000);
    expect(options.refreshSession).not.toHaveBeenCalled();
    expect(options.onLongResume).not.toHaveBeenCalled();
  });

  it('ignores results after unmount or a change of user', async () => {
    const { options, resume } = setup();
    options.isActive.mockReturnValueOnce(true).mockReturnValue(false);
    options.getSession.mockResolvedValue(sessionResult(0));
    await resume(360000);
    expect(options.refreshSession).not.toHaveBeenCalled();
    expect(options.onLongResume).not.toHaveBeenCalled();
  });

  it('reports refresh errors without notifying pages of success', async () => {
    const { options, resume } = setup();
    options.getSession.mockResolvedValue(sessionResult(0));
    const error = new Error('Offline');
    options.refreshSession.mockResolvedValue({ data: { session: null }, error });
    await resume(360000);
    expect(options.onError).toHaveBeenCalledWith(error);
    expect(options.onLongResume).not.toHaveBeenCalled();
  });
});
