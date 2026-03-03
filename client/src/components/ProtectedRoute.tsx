import { useAuth, UserRole, ModuleId } from '@/contexts/AuthContext';
import { Redirect, Link } from 'wouter';
import { useState, useEffect, useCallback, useRef } from 'react';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useModuleTracking } from '@/hooks/use-module-tracking';
import { useTrialStatus } from '@/hooks/use-trial-status';
import { Clock, CreditCard, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { colors } from '@/lib/colors';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  module?: ModuleId;
}

export function ProtectedRoute({ children, requiredRole, module }: ProtectedRouteProps) {
  const { user, profile, isPlatformAdmin, adminViewingTenant, loading, hasRole, canAccessModule, signOut, retryProfileFetch } = useAuth();
  const { isTrial, trialExpired } = useTrialStatus();
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

  // Trial expiration enforcement — only block module pages, not billing/profile/dashboard
  // Platform admins are exempt so they can view tenants for support
  if (module && isTrial && trialExpired && !isPlatformAdmin) {
    const isOwner = profile?.role === 'owner';
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <Card className="max-w-md w-full mx-4" style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
          <CardContent className="py-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#fef2f2' }}
            >
              <Clock className="w-8 h-8" style={{ color: '#dc2626' }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: colors.brown }}>
              Your Free Trial Has Ended
            </h2>
            {isOwner ? (
              <>
                <p className="mb-6" style={{ color: colors.brownLight }}>
                  Subscribe to a plan to continue using all your modules and features.
                  Your data is safe and waiting for you.
                </p>
                <Link href="/billing">
                  <Button
                    className="w-full"
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Choose a Plan
                  </Button>
                </Link>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                  >
                    Go to Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="mb-4" style={{ color: colors.brownLight }}>
                  Your organization's free trial has ended. Please contact your
                  account owner to subscribe and restore access.
                </p>
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                  style={{ backgroundColor: colors.cream, color: colors.brown }}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: colors.gold }} />
                  <span>Ask your shop owner to visit the Billing page to subscribe.</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
