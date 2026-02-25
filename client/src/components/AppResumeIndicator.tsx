import { useEffect, useState } from 'react';

/**
 * Shows a subtle loading indicator when the app is resuming from background
 * Helps users understand why data might be refreshing
 */
export function AppResumeIndicator() {
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsResuming(true);
        // Hide indicator after 2 seconds
        setTimeout(() => setIsResuming(false), 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!isResuming) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 text-sm text-white"
      style={{
        backgroundColor: 'var(--color-primary, #334155)',
        animation: 'slideDown 0.3s ease-out'
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"
        />
        <span>Refreshing...</span>
      </div>
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
