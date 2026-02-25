import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Footer } from '@/components/Footer';
import { colors } from '@/lib/colors';
import { Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    // Listen for auth state changes (token exchange from URL hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        setSessionReady(true);
      }
    });

    // Also check if there's already a session (e.g., user is logged in)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) {
        setSessionReady(true);
      }
    });

    // If no session after 5 seconds, show error
    timeout = setTimeout(() => {
      if (!cancelled) {
        setSessionFailed(true);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
      setLocation('/');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update password.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while waiting for session from the email link
  if (!sessionReady && !sessionFailed) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md" style={{ backgroundColor: colors.white }}>
            <CardHeader className="text-center">
              <img
                src="/logo.png"
                alt="Coffee Management Suite"
                className="mx-auto w-20 h-20 object-contain mb-4"
              />
              <CardTitle className="text-2xl" style={{ color: colors.brown }}>
                Setting Up Your Account
              </CardTitle>
              <CardDescription style={{ color: colors.brownLight }}>
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                Verifying your link...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Show error if session couldn't be established
  if (sessionFailed && !sessionReady) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md" style={{ backgroundColor: colors.white }}>
            <CardHeader className="text-center">
              <img
                src="/logo.png"
                alt="Coffee Management Suite"
                className="mx-auto w-20 h-20 object-contain mb-4"
              />
              <CardTitle className="text-2xl" style={{ color: colors.brown }}>
                Link Expired or Invalid
              </CardTitle>
              <CardDescription style={{ color: colors.brownLight }}>
                This password link may have expired or already been used. Please ask your manager to send a new invitation, or use "Forgot Password" on the login page.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button
                onClick={() => setLocation('/login')}
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md" style={{ backgroundColor: colors.white }}>
          <CardHeader className="text-center">
            <img
              src="/logo.png"
              alt="Coffee Management Suite"
              className="mx-auto w-20 h-20 object-contain mb-4"
            />
            <CardTitle className="text-2xl" style={{ color: colors.brown }}>
              Set New Password
            </CardTitle>
            <CardDescription style={{ color: colors.brownLight }}>
              Choose a new password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" style={{ color: colors.brown }}>New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" style={{ color: colors.brown }}>Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating...</>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
