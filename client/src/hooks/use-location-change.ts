import { useEffect, useRef, DependencyList } from 'react';

export function useLocationChange(callback: (locationId: string) => void, deps: DependencyList = []) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleLocationChange = (event: CustomEvent<{ locationId: string }>) => {
      console.log('[useLocationChange] Location changed to:', event.detail.locationId);
      callbackRef.current(event.detail.locationId);
    };

    window.addEventListener('location-changed', handleLocationChange as EventListener);
    return () => {
      window.removeEventListener('location-changed', handleLocationChange as EventListener);
    };
  }, deps);
}
