import { useState } from 'react';
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
