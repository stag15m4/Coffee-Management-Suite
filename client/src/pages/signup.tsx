import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Footer } from '@/components/Footer';
import { colors } from '@/lib/colors';
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

interface CodeValidation {
  valid: boolean;
  subscriptionPlan?: string;
  resellerName?: string;
}

export default function Signup() {
  const [, params] = useRoute('/signup/:code');
  const initialCode = params?.code || '';

  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Step 1 state
  const [code, setCode] = useState(initialCode);
  const [isValidating, setIsValidating] = useState(false);
  const [codeValidation, setCodeValidation] = useState<CodeValidation | null>(null);

  // Step 2 state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-validate if code comes from URL
  useEffect(() => {
    if (initialCode) {
      validateCode(initialCode);
    }
  }, [initialCode]);

  const validateCode = async (codeToValidate: string) => {
    const clean = codeToValidate.trim();
    if (!clean) return;

    setIsValidating(true);
    try {
      const response = await fetch(`/api/license-codes/validate/${encodeURIComponent(clean)}`);
      const data = await response.json();

      if (data.valid) {
        setCodeValidation(data);
        setStep(2);
      } else {
        setCodeValidation(null);
        toast({
          title: 'Invalid code',
          description: 'This code is invalid or has already been used. Please check and try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Could not validate code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateCode(code);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, password, fullName, businessName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Auto sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        toast({ title: 'Account created!', description: 'Please sign in with your new credentials.' });
        setLocation('/login');
        return;
      }

      toast({ title: 'Welcome!', description: 'Your account has been created successfully.' });
      window.location.href = '/';
    } catch (err: any) {
      toast({ title: 'Signup failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const planLabel = codeValidation?.subscriptionPlan === 'beta' ? 'Beta' :
    codeValidation?.subscriptionPlan === 'premium' ? 'Premium' :
    codeValidation?.subscriptionPlan || 'Access';

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
              {step === 1 ? 'Get Started' : 'Create Your Account'}
            </CardTitle>
            <CardDescription style={{ color: colors.brownLight }}>
              {step === 1
                ? 'Enter your beta access code to begin'
                : 'Set up your account and business'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" style={{ color: colors.brown }}>Beta Access Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="XXXX-XXXX-XXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    autoFocus
                    style={{
                      backgroundColor: colors.inputBg,
                      borderColor: colors.creamDark,
                      letterSpacing: '2px',
                      textAlign: 'center',
                      fontSize: '18px',
                    }}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isValidating || !code.trim()}
                  style={{ backgroundColor: colors.gold, color: colors.white }}
                >
                  {isValidating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Validating...</>
                  ) : (
                    <>Verify Code <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setLocation('/login')}
                    className="text-sm underline hover:no-underline"
                    style={{ color: colors.brownLight }}
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                {/* Verified code badge */}
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: colors.cream }}>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: colors.green }} />
                  <span className="text-sm font-medium" style={{ color: colors.brown }}>
                    Code verified — {planLabel} plan
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" style={{ color: colors.brown }}>Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoFocus
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  />
                </div>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" style={{ color: colors.brown }}>Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName" style={{ color: colors.brown }}>Business Name</Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="Your Coffee Shop"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
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
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating Account...</>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setCodeValidation(null); }}
                    className="text-sm underline hover:no-underline flex items-center gap-1"
                    style={{ color: colors.brownLight }}
                  >
                    <ArrowLeft className="w-3 h-3" /> Different code
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation('/login')}
                    className="text-sm underline hover:no-underline"
                    style={{ color: colors.brownLight }}
                  >
                    Sign in instead
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
