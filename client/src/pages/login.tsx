import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  inputBg: '#FDF8E8',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, loading, isPlatformAdmin, profile } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      // Reset loading state once auth check is complete
      setIsLoading(false);
      
      if (isPlatformAdmin) {
        setLocation('/platform-admin');
      } else if (profile) {
        setLocation('/');
      }
      // If user exists but no profile or platform admin found,
      // they may be a new user without a proper setup - stay on login
    }
  }, [loading, user, isPlatformAdmin, profile, setLocation]);

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
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colors.cream }}
    >
      <Card className="w-full max-w-md" style={{ backgroundColor: colors.white }}>
        <CardHeader className="text-center">
          <div 
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: colors.gold }}
          >
            <span className="text-2xl font-bold" style={{ color: colors.brown }}>EM</span>
          </div>
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
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-login"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
