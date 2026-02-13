import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Footer } from '@/components/Footer';
import { Building2, ChevronRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { colors } from '@/lib/colors';

interface AccessibleLocation {
  id: string;
  name: string;
  logo_url?: string | null;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<AccessibleLocation[]>([]);
  const [selectingLocation, setSelectingLocation] = useState(false);
  const { signIn, user, loading, isPlatformAdmin, profile, accessibleLocations, switchLocation, tenant } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({ title: 'Please enter your email', variant: 'destructive' });
      return;
    }
    
    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`
      });
      
      if (error) throw error;
      
      toast({ 
        title: 'Reset email sent', 
        description: 'Check your email for a link to reset your password.' 
      });
      setShowResetDialog(false);
      setResetEmail('');
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.message || 'Unable to send reset email', 
        variant: 'destructive' 
      });
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    const handleLocationSetup = async () => {
      if (!loading && user) {
        // Reset loading state once auth check is complete
        setIsLoading(false);
        
        if (isPlatformAdmin && !profile) {
          window.location.href = '/platform-admin';
        } else if (profile) {
          // Check if user has multiple accessible locations
            if (accessibleLocations && accessibleLocations.length > 1 && !showLocationSelector) {
            // Show location selector for users with multiple locations
            // Fetch branding for each location to get logos
            const locationIds = accessibleLocations.map(loc => loc.id);
            const { data: brandingData } = await supabase
              .from('tenant_branding')
              .select('tenant_id, logo_url')
              .in('tenant_id', locationIds);
            
            const brandingMap = new Map(brandingData?.map(b => [b.tenant_id, b.logo_url]) || []);
            
            setAvailableLocations(accessibleLocations.map(loc => ({ 
              id: loc.id, 
              name: loc.name,
              logo_url: brandingMap.get(loc.id) || null
            })));
            setShowLocationSelector(true);
            return;
          }
          window.location.href = '/';
        }
        // If user exists but no profile or platform admin found,
        // redirect to home anyway - ProtectedRoute will show the error
        else {
          window.location.href = '/';
        }
      }
    };
    handleLocationSetup();
  }, [loading, user, isPlatformAdmin, profile, accessibleLocations, showLocationSelector]);

  const handleLocationSelect = async (locationId: string) => {
    setSelectingLocation(true);
    try {
      await switchLocation(locationId);
      toast({ title: 'Location selected' });
      window.location.href = '/';
    } catch (error: any) {
      toast({ title: 'Error selecting location', description: error.message, variant: 'destructive' });
      setSelectingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Add timeout to prevent infinite hang
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out')), 15000)
      );
      
      const result = await Promise.race([
        signIn(email, password),
        timeoutPromise
      ]);

      if (result.error) {
        let errorMessage = result.error.message;
        
        if (result.error.message.includes('Invalid login')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (result.error.message.includes('fetch') || result.error.message.includes('network')) {
          errorMessage = 'Connection error. Please check your internet and try again.';
        } else if (result.error.message.includes('timed out')) {
          errorMessage = 'Connection is slow. Please try again.';
        }
        
        toast({
          title: 'Login Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Welcome back!',
        description: 'You have been logged in successfully.',
      });
      
      // Don't force redirect - let useEffect handle it
      // It will either redirect directly or show location selector
    } catch (err: any) {
      toast({
        title: 'Connection Error',
        description: err.message?.includes('timed out') 
          ? 'Connection is slow. Please try again.' 
          : 'Unable to connect. Please check your internet connection.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: colors.cream }}
    >
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md" style={{ backgroundColor: colors.white }}>
          <CardHeader className="text-center">
            <img 
              src="/logo.png" 
              alt="Erwin Mills"
              className="mx-auto w-20 h-20 object-contain mb-4"
            />
            <CardTitle className="text-2xl" style={{ color: colors.brown }}>
              Welcome Back
            </CardTitle>
            <CardDescription style={{ color: colors.brownLight }}>
              Sign in to access the management suite
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: colors.brown }}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" style={{ color: colors.brown }}>Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-login"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowResetDialog(true);
                  }}
                  className="text-sm underline hover:no-underline block w-full"
                  style={{ color: colors.brownLight }}
                  data-testid="button-forgot-password"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {/* Password Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent style={{ backgroundColor: colors.white }}>
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Reset Password</DialogTitle>
            <DialogDescription style={{ color: colors.brownLight }}>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" style={{ color: colors.brown }}>Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-reset-email"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isResetting}
              style={{ backgroundColor: colors.gold, color: colors.white }}
              data-testid="button-send-reset"
            >
              {isResetting ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Location Selector Dialog */}
      <Dialog open={showLocationSelector} onOpenChange={() => {}}>
        <DialogContent style={{ backgroundColor: colors.white }} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: colors.brown }}>Select Location</DialogTitle>
            <DialogDescription style={{ color: colors.brownLight }}>
              You have access to multiple locations. Choose where you'd like to start today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto">
            {availableLocations.map(location => (
              <button
                key={location.id}
                onClick={() => handleLocationSelect(location.id)}
                disabled={selectingLocation}
                className="w-full flex items-center gap-3 p-4 rounded-lg text-left hover-elevate transition-colors"
                style={{ backgroundColor: colors.cream }}
                data-testid={`button-select-location-${location.id}`}
              >
                {location.logo_url ? (
                  <img 
                    src={location.logo_url} 
                    alt={location.name} 
                    className="w-8 h-8 object-contain flex-shrink-0"
                  />
                ) : (
                  <Building2 className="w-5 h-5 flex-shrink-0" style={{ color: colors.gold }} />
                )}
                <span className="flex-1 font-medium" style={{ color: colors.brown }}>{location.name}</span>
                {selectingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: colors.brownLight }} />
                ) : (
                  <ChevronRight className="w-4 h-4" style={{ color: colors.brownLight }} />
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-center mt-4" style={{ color: colors.brownLight }}>
            You can switch locations anytime from the dashboard
          </p>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
}
