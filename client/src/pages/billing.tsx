import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, CreditCard, Loader2, Settings, ShoppingBag, Package } from 'lucide-react';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { Footer } from '@/components/Footer';

const colors = {
  gold: '#C9A227',
  goldLight: '#D4B23A',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  green: '#22c55e',
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

export default function Billing() {
  const { tenant, profile, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

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

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/stripe/products');
      const data = await response.json();
      if (data.data) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
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
        throw new Error(data.error || 'Failed to open customer portal');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const premiumProducts = products.filter(p =>
    p.metadata?.plan_id === 'premium'
  );
  const alacarteProducts = products.filter(p => p.metadata?.plan_id === 'alacarte');

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
      <header className="px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
            Billing & Subscription
          </h2>
          <p className="text-sm" style={{ color: colors.brownLight }}>
            Manage your plan and modules
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 flex-1 w-full">
        {/* Active subscription management */}
        {(tenant as any)?.stripe_subscription_id && (
          <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
                <CreditCard className="h-5 w-5" style={{ color: colors.gold }} />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm" style={{ color: colors.brownLight }}>
                You have an active subscription. Use the button below to manage your billing, update payment methods, or cancel.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-manage-subscription"
              >
                {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Settings className="mr-2 h-4 w-4" />
                Manage Subscription
              </Button>
            </CardFooter>
          </Card>
        )}

        {loading ? (
          <div className="py-12">
            <CoffeeLoader text="Brewing..." />
          </div>
        ) : (
          <>
            {/* Premium plans */}
            {premiumProducts.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5" style={{ color: colors.brown }} />
                  <h3 className="text-lg font-bold" style={{ color: colors.brown }}>
                    Subscription Plans
                  </h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {premiumProducts.map((product) => (
                    <Card
                      key={product.id}
                      className="relative"
                      style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}
                    >
                      {product.metadata?.plan_id === 'premium' && (
                        <Badge
                          className="absolute -top-2 right-4"
                          style={{ backgroundColor: colors.gold, color: colors.brown }}
                        >
                          Most Popular
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
                              <Button
                                onClick={() => handleCheckout(price.id)}
                                disabled={checkoutLoading === price.id}
                                style={{ backgroundColor: colors.gold, color: colors.brown }}
                                data-testid={`button-subscribe-${price.id}`}
                              >
                                {checkoutLoading === price.id && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Subscribe
                              </Button>
                            </div>
                          ))}
                        </div>
                        <ul className="mt-4 space-y-2">
                          <li className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                            <Check className="h-4 w-4" style={{ color: colors.green }} />
                            All 6 modules included
                          </li>
                          <li className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                            <Check className="h-4 w-4" style={{ color: colors.green }} />
                            Up to {product.metadata?.max_locations || '5'} locations
                          </li>
                          <li className="flex items-center gap-2 text-sm" style={{ color: colors.brown }}>
                            <Check className="h-4 w-4" style={{ color: colors.green }} />
                            Priority support
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* A la carte modules */}
            {alacarteProducts.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" style={{ color: colors.brown }} />
                  <h3 className="text-lg font-bold" style={{ color: colors.brown }}>
                    Individual Modules
                  </h3>
                </div>
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  Purchase individual modules at $19.99/month each
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {alacarteProducts.map((product) => (
                    <Card
                      key={product.id}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base" style={{ color: colors.brown }}>
                          {product.name}
                        </CardTitle>
                        <p className="text-sm" style={{ color: colors.brownLight }}>
                          {product.description}
                        </p>
                      </CardHeader>
                      <CardContent>
                        {product.prices[0] && (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold" style={{ color: colors.brown }}>
                              {formatPrice(product.prices[0].unit_amount, product.prices[0].currency)}/mo
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleCheckout(product.prices[0].id)}
                              disabled={checkoutLoading === product.prices[0].id}
                              style={{ backgroundColor: colors.gold, color: colors.brown }}
                              data-testid={`button-subscribe-module-${product.id}`}
                            >
                              {checkoutLoading === product.prices[0].id && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Add
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {products.length === 0 && (
              <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
                <CardContent className="py-12 text-center">
                  <CreditCard className="w-12 h-12 mx-auto mb-4" style={{ color: colors.brownLight }} />
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    No subscription plans available at this time. Please check back later.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
