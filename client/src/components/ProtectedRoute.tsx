import { useAuth, UserRole, ModuleId } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';
import { useState, useEffect, useCallback, useRef } from 'react';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useModuleTracking } from '@/hooks/use-module-tracking';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  module?: ModuleId;
}

export function ProtectedRoute({ children, requiredRole, module }: ProtectedRouteProps) {
  const { user, profile, isPlatformAdmin, adminViewingTenant, loading, hasRole, canAccessModule, signOut, retryProfileFetch } = useAuth();
  useModuleTracking(module);
  const [profileTimeout, setProfileTimeout] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const autoRetryCountRef = useRef(0);

  // Auto-retry profile fetch up to 3 times before showing error
  useEffect(() => {
    if (user && !profile && !isPlatformAdmin && !loading) {
      autoRetryCountRef.current = 0;

      const attemptRetry = async () => {
        if (autoRetryCountRef.current >= 3) {
          setProfileTimeout(true);
          return;
        }
        autoRetryCountRef.current++;
        console.log(`[ProtectedRoute] Auto-retry ${autoRetryCountRef.current}/3...`);
        const success = await retryProfileFetch();
        if (!success) {
          // Wait with backoff before next attempt
          setTimeout(attemptRetry, 2000 * autoRetryCountRef.current);
        }
      };

      // Start first auto-retry after 3 seconds
      const timer = setTimeout(attemptRetry, 3000);
      return () => clearTimeout(timer);
    } else {
      setProfileTimeout(false);
      autoRetryCountRef.current = 0;
    }
  }, [user, profile, isPlatformAdmin, loading, retryProfileFetch]);

  const handleManualRetry = useCallback(async () => {
    setRetrying(true);
    setProfileTimeout(false);
    autoRetryCountRef.current = 0;
    const success = await retryProfileFetch();
    setRetrying(false);
    if (!success) {
      setProfileTimeout(true);
    }
  }, [retryProfileFetch]);

  if (loading || retrying) {
    return <CoffeeLoader fullScreen />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // Platform admins with no tenant profile should go to platform admin page
  if (isPlatformAdmin && !adminViewingTenant && !profile) {
    return <Redirect to="/platform-admin" />;
  }

  // Show loading state while profile is being fetched (but user is authenticated)
  if (!profile) {
    if (profileTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 rounded-xl max-w-md bg-card shadow-lg">
            <h2 className="text-xl font-semibold mb-2 text-foreground">Connection Issue</h2>
            <p className="mb-4 text-muted-foreground">
              Unable to load your profile. This could be:
            </p>
            <ul className="text-left mb-4 text-sm space-y-1 text-muted-foreground">
              <li>• Network connectivity issue</li>
              <li>• Supabase project may be paused</li>
              <li>• Database permissions need updating</li>
            </ul>
            <div className="space-y-2">
              <button
                onClick={handleManualRetry}
                className="w-full px-4 py-2 rounded-lg font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
              <button
                onClick={() => signOut()}
                className="w-full px-4 py-2 rounded-lg font-semibold border border-border text-foreground hover:bg-accent transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <CoffeeLoader fullScreen />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 rounded-xl bg-card shadow-lg">
          <h2 className="text-xl font-semibold mb-2 text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (module && !canAccessModule(module)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 rounded-xl bg-card shadow-lg">
          <h2 className="text-xl font-semibold mb-2 text-foreground">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this module.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
