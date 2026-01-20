import { useState, useCallback, useRef, useEffect } from 'react';

interface ResilientMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface ResilientMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  reset: () => void;
}

export function useResilientMutation<TData, TVariables>({
  mutationFn,
  onSuccess,
  onError,
  maxRetries = 3,
  retryDelay = 1000,
  timeout = 30000,
}: ResilientMutationOptions<TData, TVariables>): ResilientMutationResult<TData, TVariables> {
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const isNetworkError = (err: Error): boolean => {
    const msg = err.message?.toLowerCase() || '';
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('load failed') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('connection') ||
      msg.includes('offline')
    );
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeWithRetry = useCallback(async (
    variables: TVariables,
    attempt: number = 0
  ): Promise<TData> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), timeout);
      });

      const result = await Promise.race([
        mutationFn(variables),
        timeoutPromise
      ]);

      return result;
    } catch (err) {
      const error = err as Error;
      
      if (isNetworkError(error) && attempt < maxRetries) {
        console.log(`[ResilientMutation] Retry attempt ${attempt + 1}/${maxRetries} after ${retryDelay}ms...`);
        
        if (document.visibilityState === 'hidden') {
          console.log('[ResilientMutation] Tab is hidden, waiting for visibility...');
          await new Promise<void>(resolve => {
            const handler = () => {
              if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', handler);
                resolve();
              }
            };
            document.addEventListener('visibilitychange', handler);
            setTimeout(() => {
              document.removeEventListener('visibilitychange', handler);
              resolve();
            }, 60000);
          });
        }
        
        await sleep(retryDelay * (attempt + 1));
        return executeWithRetry(variables, attempt + 1);
      }
      
      throw error;
    }
  }, [mutationFn, maxRetries, retryDelay, timeout]);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    if (!isMountedRef.current) {
      throw new Error('Component unmounted');
    }

    setIsPending(true);
    setIsError(false);
    setError(null);

    try {
      const result = await executeWithRetry(variables);
      
      if (isMountedRef.current) {
        setIsPending(false);
        onSuccess?.(result);
      }
      
      return result;
    } catch (err) {
      const error = err as Error;
      
      if (isMountedRef.current) {
        setIsPending(false);
        setIsError(true);
        setError(error);
        onError?.(error);
      }
      
      throw error;
    }
  }, [executeWithRetry, onSuccess, onError]);

  const mutate = useCallback((variables: TVariables) => {
    mutateAsync(variables).catch(() => {});
  }, [mutateAsync]);

  const reset = useCallback(() => {
    setIsPending(false);
    setIsError(false);
    setError(null);
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending,
    isError,
    error,
    reset,
  };
}

export function wrapMutationWithResilience<TData, TVariables>(
  originalMutation: {
    mutateAsync: (variables: TVariables) => Promise<TData>;
    isPending: boolean;
  },
  options?: {
    maxRetries?: number;
    timeout?: number;
  }
) {
  const maxRetries = options?.maxRetries ?? 3;
  const timeout = options?.timeout ?? 30000;
  const retryDelay = 1000;

  const isNetworkError = (err: Error): boolean => {
    const msg = err.message?.toLowerCase() || '';
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('load failed') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('connection') ||
      msg.includes('offline')
    );
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const resilientMutateAsync = async (
    variables: TVariables,
    attempt: number = 0
  ): Promise<TData> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), timeout);
      });

      const result = await Promise.race([
        originalMutation.mutateAsync(variables),
        timeoutPromise
      ]);

      return result;
    } catch (err) {
      const error = err as Error;
      
      if (isNetworkError(error) && attempt < maxRetries) {
        console.log(`[ResilientMutation] Network error, retry ${attempt + 1}/${maxRetries}...`);
        
        if (document.visibilityState === 'hidden') {
          console.log('[ResilientMutation] Waiting for tab to become visible...');
          await new Promise<void>(resolve => {
            const handler = () => {
              if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', handler);
                resolve();
              }
            };
            document.addEventListener('visibilitychange', handler);
            setTimeout(() => {
              document.removeEventListener('visibilitychange', handler);
              resolve();
            }, 60000);
          });
        }
        
        await sleep(retryDelay * (attempt + 1));
        return resilientMutateAsync(variables, attempt + 1);
      }
      
      throw error;
    }
  };

  return {
    ...originalMutation,
    mutateAsync: resilientMutateAsync,
  };
}
