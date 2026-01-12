import { useAuth, UserRole, ModuleId } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';
import { useState, useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  module?: ModuleId;
}

export function ProtectedRoute({ children, requiredRole, module }: ProtectedRouteProps) {
  const { user, profile, isPlatformAdmin, loading, hasRole, canAccessModule, signOut } = useAuth();
  const [profileTimeout, setProfileTimeout] = useState(false);

  // If profile doesn't load within 5 seconds (and not a platform admin), show error
  useEffect(() => {
    if (user && !profile && !isPlatformAdmin && !loading) {
      const timer = setTimeout(() => {
        setProfileTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setProfileTimeout(false);
    }
  }, [user, profile, isPlatformAdmin, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F0E1' }}>
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full mx-auto mb-4 animate-pulse"
            style={{ backgroundColor: '#C9A227' }}
          />
          <p style={{ color: '#4A3728' }}>Loading...</p>
        </div>
      </div>
    );
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
          <div className="text-center p-8 rounded-lg" style={{ backgroundColor: '#FFFDF7' }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#4A3728' }}>Profile Not Found</h2>
            <p className="mb-4" style={{ color: '#6B5344' }}>
              Unable to load your profile. This may be a permissions issue.
            </p>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 rounded-lg font-semibold"
              style={{ backgroundColor: '#C9A227', color: '#FFFDF7' }}
            >
              Sign Out & Try Again
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F0E1' }}>
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full mx-auto mb-4 animate-pulse"
            style={{ backgroundColor: '#C9A227' }}
          />
          <p style={{ color: '#4A3728' }}>Loading profile...</p>
        </div>
      </div>
    );
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
