import { useAuth, UserRole, ModuleId } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';
import { useState, useEffect } from 'react';
import { CoffeeLoader } from '@/components/CoffeeLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  module?: ModuleId;
}

export function ProtectedRoute({ children, requiredRole, module }: ProtectedRouteProps) {
  const { user, profile, isPlatformAdmin, loading, hasRole, canAccessModule, signOut } = useAuth();
  const [profileTimeout, setProfileTimeout] = useState(false);

  // If profile doesn't load within 35 seconds (and not a platform admin), show error
  useEffect(() => {
    if (user && !profile && !isPlatformAdmin && !loading) {
      const timer = setTimeout(() => {
        setProfileTimeout(true);
      }, 35000);
      return () => clearTimeout(timer);
    } else {
      setProfileTimeout(false);
    }
  }, [user, profile, isPlatformAdmin, loading]);

  if (loading) {
    return <CoffeeLoader fullScreen progressiveTexts={[
      "Brewing...",
      "Grinding fresh beans...",
      "Making a fresh pot...",
      "Almost ready...",
    ]} />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }
  
  // Platform admins should go to platform admin page
  if (isPlatformAdmin) {
    return <Redirect to="/platform-admin" />;
  }
  
  // Show loading state while profile is being fetched (but user is authenticated)
  if (!profile) {
    if (profileTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F0E1' }}>
          <div className="text-center p-8 rounded-lg max-w-md" style={{ backgroundColor: '#FFFDF7' }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#4A3728' }}>Connection Issue</h2>
            <p className="mb-4" style={{ color: '#6B5344' }}>
              Unable to load your profile. This could be:
            </p>
            <ul className="text-left mb-4 text-sm space-y-1" style={{ color: '#6B5344' }}>
              <li>• Network connectivity issue</li>
              <li>• Supabase project may be paused</li>
              <li>• Database permissions need updating</li>
            </ul>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: '#C9A227', color: '#FFFDF7' }}
              >
                Retry
              </button>
              <button
                onClick={() => signOut()}
                className="w-full px-4 py-2 rounded-lg font-semibold border"
                style={{ borderColor: '#C9A227', color: '#4A3728', backgroundColor: 'transparent' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <CoffeeLoader fullScreen progressiveTexts={[
      "Brewing...",
      "Grinding fresh beans...",
      "Making a fresh pot...",
      "Almost ready...",
    ]} />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F0E1' }}>
        <div className="text-center p-8 rounded-lg" style={{ backgroundColor: '#FFFDF7' }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#4A3728' }}>Access Denied</h2>
          <p style={{ color: '#6B5344' }}>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (module && !canAccessModule(module)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F0E1' }}>
        <div className="text-center p-8 rounded-lg" style={{ backgroundColor: '#FFFDF7' }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#4A3728' }}>Access Denied</h2>
          <p style={{ color: '#6B5344' }}>You don't have permission to access this module.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
