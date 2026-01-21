import { useEffect, useCallback } from 'react';

/**
 * Hook to handle app resume events (when user switches back to the app after being away)
 * Useful for refreshing data on iPad when switching between apps
 * 
 * @param onResume - Callback function to execute when app resumes (e.g., refresh data)
 * @param deps - Dependencies array for the callback
 */
export function useAppResume(onResume: () => void, deps: React.DependencyList = []) {
  const memoizedCallback = useCallback(onResume, deps);
  
  useEffect(() => {
    const handleAppResume = () => {
      console.log('[useAppResume] App resumed, executing callback');
      memoizedCallback();
    };
    
    window.addEventListener('app-resumed', handleAppResume);
    return () => {
      window.removeEventListener('app-resumed', handleAppResume);
    };
  }, [memoizedCallback]);
}
