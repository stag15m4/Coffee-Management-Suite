import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, type ModuleId } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  CreditCard,
  Loader2,
  Settings,
  Package,
  Copy,
  Gift,
  Key,
  Calculator,
  DollarSign,
  Receipt,
  Coffee,
  Wrench,
  ListTodo,
  CalendarDays,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { ModulePreviewContent } from '@/components/billing/ModulePreview';
import { colors } from '@/lib/colors';

const MODULE_ICONS: Record<string, LucideIcon> = {
  'recipe-costing': Calculator,
  'tip-payout': DollarSign,
  'cash-deposit': Receipt,
  'bulk-ordering': Coffee,
  'equipment-maintenance': Wrench,
  'admin-tasks': ListTodo,
  'calendar-workforce': CalendarDays,
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free Trial',
  alacarte: 'À La Carte',
  test_eval: 'Test & Eval',
  premium: 'Premium Suite',
  basic: 'À La Carte',
  standard: 'À La Carte',
};

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: Record<string, string>;
}

interface Product {
  id: string;
  name: string;
  description: string;
  active: boolean;
  metadata: Record<string, string>;
  prices: Price[];
}

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  monthly_price: string;
  is_premium_only: boolean;
  display_order: number;
}

interface BillingDetails {
  subscription_plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  stripe_subscription_status: string | null;
  license_code_id: string | null;
  subscription: {
    id: string;
    status: string;
    billing_cycle_anchor: number;
    current_period_end: number | null;
    current_period_start: number | null;
    cancel_at_period_end: boolean;
    cancel_at: number | null;
    canceled_at: number | null;
    payment_method: {
      brand: string | null;
      last4: string | null;
      exp_month: number | null;
      exp_year: number | null;
    } | null;
    items: {
      product_name: string | null;
      price_amount: number;
      currency: string;
      interval: string | null;
    }[];
  } | null;
  upcoming_invoice: {
    amount_due: number;
    currency: string;
    next_payment_attempt: number | null;
    period_start: number;
    period_end: number;
    lines: { description: string; amount: number }[];
  } | null;
  license_code?: {
    code: string;
    subscription_plan: string;
    redeemed_at: string;
    expires_at: string | null;
  } | null;
}

interface ReferralData {
  referral_code: {
    id: string;
    code: string;
    is_active: boolean;
    created_at: string;
  } | null;
  stats: {
    total_referrals: number;
    rewards_applied: number;
  };
}

export default function Billing() {
  const { tenant, profile, user, enabledModules, hasRole } = useAuth();
  const { toast } = useToast();
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [licenseCode, setLicenseCode] = useState('');
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [referralRedeemCode, setReferralRedeemCode] = useState('');
  const [referralRedeemLoading, setReferralRedeemLoading] = useState(false);
  const [showPlans, setShowPlans] = useState(() => {
    // Auto-expand plans for trial/no plan users so pricing is visible
    const currentPlan = tenant?.subscription_plan;
    return !currentPlan || currentPlan === 'free';
  });
  const [previewModule, setPreviewModule] = useState<{ id: string; name: string } | null>(null);
  const modulesRef = useRef<HTMLDivElement>(null);

  const isOwner = hasRole('owner');

  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (success === 'true') {
      toast({
        title: 'Subscription successful!',
        description: 'Your subscription has been activated. Thank you for your purchase!',
      });
      window.history.replaceState({}, '', '/billing');
    }
    if (canceled === 'true') {
      toast({
        title: 'Checkout canceled',
        description: 'Your subscription was not completed.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/billing');
    }
  }, [success, canceled, toast]);

  const fetchData = useCallback(async () => {
    if (!tenant) return;
    try {
      const [billingRes, modulesRes, productsRes, referralRes] = await Promise.all([
        fetch(`/api/stripe/billing-details/${tenant.id}`, {
          headers: { 'x-user-id': user?.id || '' },
        }),
        fetch('/api/billing/modules'),
        fetch('/api/stripe/products'),
        fetch(`/api/referral-codes/mine/${tenant.id}`, {
          headers: { 'x-user-id': user?.id || '' },
        }),
      ]);

      if (billingRes.ok) setBillingDetails(await billingRes.json());
      if (modulesRes.ok) setModules(await modulesRes.json());
      if (productsRes.ok) {
        const prodData = await productsRes.json();
        setProducts(prodData.data || []);
      }
      if (referralRes.ok) setReferralData(await referralRes.json());
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatPrice = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleCheckout = async (priceId: string) => {
    if (!tenant || !profile) {
      toast({ title: 'Error', description: 'Please log in to subscribe', variant: 'destructive' });
      return;
    }
    setCheckoutLoading(priceId);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          tenantId: tenant.id,
          tenantEmail: profile.email,
          tenantName: tenant.name,
          userId: user?.id,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!tenant) return;
    setPortalLoading(true);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, userId: user?.id }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to open billing portal');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleGenerateReferralCode = async () => {
    if (!tenant) return;
    setReferralLoading(true);
    try {
      const response = await fetch('/api/referral-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await response.json();
      if (data.code) {
        setReferralData(prev => ({
          ...prev!,
          referral_code: data,
          stats: prev?.stats || { total_referrals: 0, rewards_applied: 0 },
        }));
        toast({ title: 'Referral code created!', description: `Your code: ${data.code}` });
      } else {
        throw new Error(data.error || 'Failed to generate referral code');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setReferralLoading(false);
    }
  };

  const handleRedeemLicense = async () => {
    if (!licenseCode.trim()) return;
    setLicenseLoading(true);
    try {
      const response = await fetch('/api/license-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ code: licenseCode.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'License code redeemed!', description: 'Your account has been upgraded.' });
        setLicenseCode('');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to redeem license code');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleRedeemReferral = async () => {
    if (!referralRedeemCode.trim() || !tenant) return;
    setReferralRedeemLoading(true);
    try {
      const response = await fetch('/api/referral-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ code: referralRedeemCode.trim(), tenantId: tenant.id }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Referral code redeemed!', description: data.message });
        setReferralRedeemCode('');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to redeem referral code');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setReferralRedeemLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to clipboard!' });
    });
  };

  // Derived state
  const plan = billingDetails?.subscription_plan || 'free';
  const planLabel = PLAN_LABELS[plan] || plan;
  const isTrial = plan === 'free';
  const trialEndsAt = billingDetails?.trial_ends_at ? new Date(billingDetails.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const trialProgress = trialEndsAt ? Math.max(0, Math.min(100, ((14 - trialDaysLeft) / 14) * 100)) : 0;
  const subStatus = billingDetails?.subscription?.status || billingDetails?.stripe_subscription_status;
  const isPremium = plan === 'premium' || plan === 'test_eval';
  const premiumProducts = products.filter(p => p.metadata?.plan_id === 'premium');
  const alacarteProducts = products.filter(p => p.metadata?.plan_id === 'alacarte');

  // Pricing protection: count individually paid modules
  // Trial users have 0 paid modules; premium users won't see buttons
  const paidModuleCount = isTrial ? 0 : enabledModules.length;
  const premiumPriceId = premiumProducts[0]?.prices[0]?.id;
  const PREMIUM_THRESHOLD = 5; // At 5× $19.99 = $99.95, premium ($99.99) is better value

  const getStatusBadge = () => {
    if (billingDetails?.subscription?.cancel_at_period_end) {
      return <Badge style={{ backgroundColor: '#fbbf24', color: colors.brown }}>Canceling</Badge>;
    }
    switch (subStatus) {
      case 'active':
        return <Badge style={{ backgroundColor: colors.green, color: 'white' }}>Active</Badge>;
      case 'trialing':
        return <Badge style={{ backgroundColor: '#60a5fa', color: 'white' }}>Trial</Badge>;
      case 'past_due':
        return <Badge style={{ backgroundColor: colors.red, color: 'white' }}>Past Due</Badge>;
      case 'canceled':
        return <Badge style={{ backgroundColor: '#9ca3af', color: 'white' }}>Canceled</Badge>;
      default:
        if (isTrial) return <Badge style={{ backgroundColor: '#60a5fa', color: 'white' }}>Free Trial</Badge>;
        return <Badge style={{ backgroundColor: '#9ca3af', color: 'white' }}>No Plan</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
        <div className="flex-1 flex items-center justify-center py-12">
          <CoffeeLoader text="Loading billing..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
      <header className="px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
            Billing & Subscription
          </h2>
          <p className="text-sm" style={{ color: colors.brownLight }}>
            Manage your plan, modules, and payment
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 flex-1 w-full">

        {/* ============================================= */}
        {/* SECTION 1: Subscription Overview */}
        {/* ============================================= */}
        <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                <Package className="h-5 w-5" style={{ color: colors.gold }} />
                Subscription
              </CardTitle>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Plan name and details */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold" style={{ color: colors.brown }}>
                  {planLabel}
                </p>
                {billingDetails?.subscription?.items?.map((item, i) => (
                  <p key={i} className="text-sm" style={{ color: colors.brownLight }}>
                    {item.product_name} — {formatPrice(item.price_amount, item.currency)}/{item.interval}
                  </p>
                ))}
                {billingDetails?.license_code && (
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    Activated via license code: {billingDetails.license_code.code}
                  </p>
                )}
              </div>
              {isOwner && billingDetails?.subscription && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  style={{ borderColor: colors.gold, color: colors.brown }}
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4 mr-1" />}
                  Manage
                </Button>
              )}
            </div>

            {/* Trial countdown */}
            {isTrial && trialEndsAt && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1" style={{ color: colors.brownLight }}>
                    <Clock className="h-3.5 w-3.5" />
                    {trialDaysLeft > 0 ? `${trialDaysLeft} days remaining` : 'Trial expired'}
                  </span>
                  <span style={{ color: colors.brownLight }}>
                    Ends {trialEndsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <Progress value={trialProgress} className="h-2" />
              </div>
            )}

            {/* Next payment */}
            {billingDetails?.upcoming_invoice && (
              <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: colors.cream }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.brown }}>Next payment</p>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    {billingDetails.upcoming_invoice.next_payment_attempt
                      ? formatDate(billingDetails.upcoming_invoice.next_payment_attempt)
                      : billingDetails.subscription?.current_period_end
                        ? formatDate(billingDetails.subscription.current_period_end)
                        : 'Upcoming'}
                  </p>
                </div>
                <p className="text-lg font-bold" style={{ color: colors.brown }}>
                  {formatPrice(billingDetails.upcoming_invoice.amount_due, billingDetails.upcoming_invoice.currency)}
                </p>
              </div>
            )}

            {/* Cancellation notice */}
            {billingDetails?.subscription?.cancel_at_period_end && billingDetails.subscription.current_period_end && (
              <div className="rounded-lg p-3" style={{ backgroundColor: '#fef3c7' }}>
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                  Your subscription will end on {formatDate(billingDetails.subscription.current_period_end)}.
                  You can resubscribe at any time.
                </p>
              </div>
            )}

            {/* Upgrade prompt for trial/no plan */}
            {(isTrial || !billingDetails?.subscription) && isOwner && (
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    const premiumPrice = premiumProducts[0]?.prices[0];
                    if (premiumPrice) {
                      handleCheckout(premiumPrice.id);
                    } else {
                      toast({ title: 'Payment not available', description: 'Stripe is not configured yet. Contact support to subscribe.', variant: 'destructive' });
                    }
                  }}
                  disabled={checkoutLoading !== null}
                  className="w-full"
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                >
                  Get All 6 Modules — $99.99/mo
                </Button>
                <p className="text-xs text-center" style={{ color: colors.brownLight }}>
                  or pick individual modules below — $19.99/mo each
                </p>
              </div>
            )}
            {/* Module Dashboard */}
            <div ref={modulesRef}>
              <Separator className="my-4" />
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4" style={{ color: colors.gold }} />
                <p className="text-sm font-semibold" style={{ color: colors.brown }}>
                  {isPremium ? 'All modules included in your plan' : 'Modules'}
                </p>
              </div>
              {!isPremium && (
                <p className="text-xs mb-3" style={{ color: colors.brownLight }}>
                  Your subscribed modules and available add-ons
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {modules.map(mod => {
                  const isActive = enabledModules.includes(mod.id as ModuleId);
                  const Icon = MODULE_ICONS[mod.id] || Package;
                  const price = parseFloat(mod.monthly_price);
                  const wouldExceedPremium = paidModuleCount + 1 >= PREMIUM_THRESHOLD;

                  return (
                    <div
                      key={mod.id}
                      className="flex flex-col justify-between p-3 rounded-lg"
                      style={{
                        backgroundColor: isActive ? colors.cream : 'transparent',
                        border: `1px solid ${isActive ? colors.goldLight : colors.creamDark}`,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            backgroundColor: isActive ? colors.gold : colors.creamDark,
                          }}
                        >
                          <Icon className="w-4.5 h-4.5" style={{ color: isActive ? 'white' : colors.brownLight }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium" style={{ color: colors.brown }}>
                              {mod.name}
                            </p>
                            {isActive ? (
                              <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: colors.green, color: 'white' }}>
                                Active
                              </Badge>
                            ) : (
                              <Lock className="w-3 h-3" style={{ color: colors.brownLight }} />
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: colors.brownLight }}>
                            {mod.description}
                          </p>
                          <button
                            onClick={() => setPreviewModule({ id: mod.id, name: mod.name })}
                            className="text-xs underline mt-1 block"
                            style={{ color: colors.gold }}
                          >
                            See it in action
                          </button>
                        </div>
                      </div>
                      {/* Price display */}
                      <div className="flex justify-end mt-2">
                        {isPremium && isActive ? (
                          <span className="text-xs" style={{ color: colors.gold }}>
                            Included in {planLabel}
                          </span>
                        ) : isOwner && wouldExceedPremium ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => {
                              if (premiumPriceId) {
                                handleCheckout(premiumPriceId);
                              } else {
                                toast({ title: 'Payment not available', description: 'Stripe is not configured yet. Contact support to subscribe.', variant: 'destructive' });
                              }
                            }}
                            disabled={checkoutLoading !== null}
                            style={{ backgroundColor: colors.gold, color: colors.brown }}
                          >
                            Get All Modules — $99.99/mo
                          </Button>
                        ) : isOwner ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => {
                              const product = alacarteProducts.find(p =>
                                p.name.toLowerCase().includes(mod.name.toLowerCase()) ||
                                p.metadata?.module_id === mod.id
                              );
                              if (product?.prices[0]) {
                                handleCheckout(product.prices[0].id);
                              } else {
                                toast({ title: 'Payment not available', description: 'Stripe is not configured yet. Contact support to subscribe.', variant: 'destructive' });
                              }
                            }}
                            disabled={checkoutLoading !== null}
                            style={{ backgroundColor: colors.gold, color: colors.brown }}
                          >
                            Add Module — ${price.toFixed(2)}/mo
                          </Button>
                        ) : (
                          <span className="text-xs font-medium" style={{ color: colors.brownLight }}>
                            ${price.toFixed(2)}/mo{isTrial && isActive ? ' after trial' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* SECTION 2: Payment Method */}
        {/* ============================================= */}
        {billingDetails?.subscription?.payment_method && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
                <CreditCard className="h-5 w-5" style={{ color: colors.gold }} />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 rounded flex items-center justify-center text-xs font-bold uppercase"
                    style={{ backgroundColor: colors.cream, color: colors.brown }}>
                    {billingDetails.subscription.payment_method.brand || 'Card'}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: colors.brown }}>
                      •••• {billingDetails.subscription.payment_method.last4}
                    </p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>
                      Expires {billingDetails.subscription.payment_method.exp_month}/{billingDetails.subscription.payment_method.exp_year}
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    style={{ borderColor: colors.creamDark, color: colors.brownLight }}
                  >
                    Update
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No payment method prompt */}
        {billingDetails?.subscription && !billingDetails.subscription.payment_method && isOwner && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" style={{ color: colors.brownLight }} />
                  <span className="text-sm" style={{ color: colors.brownLight }}>No payment method on file</span>
                </div>
                <Button
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                >
                  Add Payment Method
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Old Module Dashboard removed — now merged into Subscription card above */}

        {/* ============================================= */}
        {/* SECTION 4: Referral Program */}
        {/* ============================================= */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
              <Gift className="h-5 w-5" style={{ color: colors.gold }} />
              Referral Program
            </CardTitle>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Refer a friend and earn rewards. You get 1 month free, they get 50% off their first month.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Your referral code */}
            {referralData?.referral_code ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg px-4 py-3 font-mono text-lg text-center tracking-wider"
                    style={{ backgroundColor: colors.cream, color: colors.brown, border: `1px dashed ${colors.gold}` }}>
                    {referralData.referral_code.code}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(referralData.referral_code!.code)}
                    style={{ borderColor: colors.creamDark }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                {/* Share link */}
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/signup?ref=${referralData.referral_code.code}`}
                    className="flex-1 text-xs rounded-lg px-3 py-2"
                    style={{ backgroundColor: colors.inputBg, color: colors.brownLight, border: `1px solid ${colors.creamDark}` }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`${window.location.origin}/signup?ref=${referralData.referral_code!.code}`)}
                    style={{ borderColor: colors.creamDark }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                {/* Stats */}
                <div className="flex gap-4 pt-1">
                  <div className="text-center">
                    <p className="text-2xl font-bold" style={{ color: colors.brown }}>
                      {referralData.stats.total_referrals}
                    </p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>Referrals</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold" style={{ color: colors.green }}>
                      {referralData.stats.rewards_applied}
                    </p>
                    <p className="text-xs" style={{ color: colors.brownLight }}>Rewards Earned</p>
                  </div>
                </div>
              </div>
            ) : isOwner ? (
              <Button
                onClick={handleGenerateReferralCode}
                disabled={referralLoading}
                style={{ backgroundColor: colors.gold, color: colors.brown }}
              >
                {referralLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Referral Code
              </Button>
            ) : (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Ask your account owner to generate a referral code.
              </p>
            )}

            <Separator style={{ backgroundColor: colors.creamDark }} />

            {/* Redeem a referral code */}
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: colors.brown }}>Have a referral code?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="XXXX-XXXX"
                  value={referralRedeemCode}
                  onChange={(e) => setReferralRedeemCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.creamDark}`, color: colors.brown }}
                />
                <Button
                  size="sm"
                  onClick={handleRedeemReferral}
                  disabled={referralRedeemLoading || !referralRedeemCode.trim()}
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                >
                  {referralRedeemLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* SECTION 5: License Code Redemption */}
        {/* ============================================= */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: colors.brown }}>
              <Key className="h-5 w-5" style={{ color: colors.gold }} />
              License Code
            </CardTitle>
            {billingDetails?.license_code ? (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Your account was activated with a license code
              </p>
            ) : (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Have a license code from a reseller? Redeem it here.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {billingDetails?.license_code ? (
              <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: colors.cream }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: colors.brown }}>
                    Code: {billingDetails.license_code.code}
                  </span>
                  <Badge style={{ backgroundColor: colors.green, color: 'white' }}>Redeemed</Badge>
                </div>
                <p className="text-xs" style={{ color: colors.brownLight }}>
                  Plan: {PLAN_LABELS[billingDetails.license_code.subscription_plan] || billingDetails.license_code.subscription_plan}
                </p>
                {billingDetails.license_code.expires_at && (
                  <p className="text-xs" style={{ color: colors.brownLight }}>
                    Expires: {new Date(billingDetails.license_code.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  value={licenseCode}
                  onChange={(e) => setLicenseCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.creamDark}`, color: colors.brown }}
                />
                <Button
                  size="sm"
                  onClick={handleRedeemLicense}
                  disabled={licenseLoading || !licenseCode.trim()}
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                >
                  {licenseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================= */}
        {/* SECTION 6: Available Plans */}
        {/* ============================================= */}
        <div>
          <button
            onClick={() => setShowPlans(!showPlans)}
            className="flex items-center gap-2 w-full py-2"
            style={{ color: colors.brown }}
          >
            <h3 className="text-base font-semibold">Available Plans</h3>
            {showPlans ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showPlans && (
            <div className="space-y-6 mt-3">
              {/* Premium plans */}
              {premiumProducts.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {premiumProducts.map((product) => {
                    const isCurrentPlan = plan === 'premium';
                    return (
                      <Card
                        key={product.id}
                        className="relative"
                        style={{
                          backgroundColor: colors.white,
                          borderColor: isCurrentPlan ? colors.green : colors.gold,
                          borderWidth: 2,
                        }}
                      >
                        {isCurrentPlan && (
                          <Badge className="absolute -top-2 right-4" style={{ backgroundColor: colors.green, color: 'white' }}>
                            Current Plan
                          </Badge>
                        )}
                        {!isCurrentPlan && (
                          <Badge className="absolute -top-2 right-4" style={{ backgroundColor: colors.gold, color: colors.brown }}>
                            Best Value
                          </Badge>
                        )}
                        <CardHeader className="pb-2">
                          <CardTitle style={{ color: colors.brown }}>{product.name}</CardTitle>
                          <p className="text-sm" style={{ color: colors.brownLight }}>
                            {product.description}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {product.prices.map((price) => (
                              <div key={price.id} className="flex items-center justify-between">
                                <div>
                                  <span className="text-2xl font-bold" style={{ color: colors.brown }}>
                                    {formatPrice(price.unit_amount, price.currency)}
                                  </span>
                                  <span className="text-sm" style={{ color: colors.brownLight }}>
                                    /{price.recurring?.interval || 'one-time'}
                                  </span>
                                </div>
                                {!isCurrentPlan && isOwner && (
                                  <Button
                                    onClick={() => handleCheckout(price.id)}
                                    disabled={checkoutLoading === price.id}
                                    style={{ backgroundColor: colors.gold, color: colors.brown }}
                                  >
                                    {checkoutLoading === price.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Subscribe
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          <ul className="mt-4 space-y-2">
                            <li className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                              <Check className="h-4 w-4 shrink-0" style={{ color: colors.green }} />
                              All 6 modules included
                            </li>
                            <li className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                              <Check className="h-4 w-4 shrink-0" style={{ color: colors.green }} />
                              Up to {product.metadata?.max_locations || '5'} locations
                            </li>
                            <li className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                              <Check className="h-4 w-4 shrink-0" style={{ color: colors.green }} />
                              Priority support
                            </li>
                          </ul>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* A la carte modules */}
              {alacarteProducts.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: colors.brown }}>Individual Modules</h4>
                    <p className="text-xs" style={{ color: colors.brownLight }}>
                      Pick and choose modules at $19.99/month each
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {alacarteProducts.map((product) => (
                      <Card key={product.id} style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
                        <CardContent className="py-3 px-4">
                          <p className="text-sm font-medium" style={{ color: colors.brown }}>{product.name}</p>
                          <p className="text-xs mt-0.5 mb-2" style={{ color: colors.brownLight }}>{product.description}</p>
                          {product.prices[0] && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold" style={{ color: colors.brown }}>
                                {formatPrice(product.prices[0].unit_amount, product.prices[0].currency)}/mo
                              </span>
                              {isOwner && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleCheckout(product.prices[0].id)}
                                  disabled={checkoutLoading === product.prices[0].id}
                                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                                >
                                  {checkoutLoading === product.prices[0].id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                  Add
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* No products */}
              {products.length === 0 && (
                <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
                  <CardContent className="py-8 text-center">
                    <CreditCard className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
                    <p className="text-sm" style={{ color: colors.brownLight }}>
                      No subscription plans available at this time.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Billing portal link */}
        {isOwner && billingDetails?.subscription && (
          <div className="text-center pb-2">
            <button
              onClick={handleManageSubscription}
              className="text-sm underline inline-flex items-center gap-1"
              style={{ color: colors.brownLight }}
            >
              <ExternalLink className="h-3 w-3" />
              View billing history & invoices in Stripe
            </button>
          </div>
        )}
      </main>

      {/* Module Preview Dialog */}
      <Dialog open={!!previewModule} onOpenChange={(open) => !open && setPreviewModule(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ backgroundColor: colors.white }}>
          {previewModule && (
            <ModulePreviewContent moduleId={previewModule.id} moduleName={previewModule.name} />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
