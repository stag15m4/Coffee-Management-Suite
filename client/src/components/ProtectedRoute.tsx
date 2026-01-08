import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Redirect } from 'wouter';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  module?: 'recipe-costing' | 'tip-payout' | 'cash-deposit' | 'bulk-ordering';
}

export function ProtectedRoute({ children, requiredRole, module }: ProtectedRouteProps) {
  const { user, profile, loading, hasRole, canAccessModule } = useAuth();

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
  
  // Show loading state while profile is being fetched (but user is authenticated)
  if (!profile) {
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
