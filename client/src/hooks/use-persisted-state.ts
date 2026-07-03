import { useState, useCallback } from 'react';

/**
 * A useState hook that persists state to sessionStorage.
 * Survives component re-renders caused by React Query refetches.
 *
 * @param key - sessionStorage key (should be unique per form/page)
 * @param defaultValue - initial value if nothing in storage
 * @returns [state, setState, clearState] - like useState but with persistence
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateInternal] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateInternal((prev) => {
        const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        try {
          sessionStorage.setItem(key, JSON.stringify(newValue));
        } catch {
          // sessionStorage might be full or disabled
        }
        return newValue;
      });
    },
    [key]
  );

  const clearState = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    setStateInternal(defaultValue);
  }, [key, defaultValue]);

  return [state, setState, clearState];
}

/**
 * Clears all persisted form state for a given prefix.
 * Call this after successful form submission.
 */
export function clearPersistedFormState(prefix: string): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}
