import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, CreditCard, Loader2, Settings } from 'lucide-react';
import { CoffeeLoader } from '@/components/CoffeeLoader';

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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Billing & Subscription</h1>
        </div>
      </header>

      <main className="container py-6 space-y-8">
        {(tenant as any)?.stripe_subscription_id && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
              <CardDescription>Manage your billing and subscription settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You have an active subscription. Use the button below to manage your billing, update payment methods, or cancel.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleManageSubscription}
                disabled={portalLoading}
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
            {premiumProducts.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-4">Subscription Plans</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {premiumProducts.map((product) => (
                    <Card key={product.id} className="relative">
                      {product.metadata?.plan_id === 'premium' && (
                        <Badge className="absolute -top-2 right-4">Most Popular</Badge>
                      )}
                      <CardHeader>
                        <CardTitle>{product.name}</CardTitle>
                        <CardDescription>{product.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {product.prices.map((price) => (
                            <div key={price.id} className="flex items-center justify-between">
                              <div>
                                <span className="text-2xl font-bold">
                                  {formatPrice(price.unit_amount, price.currency)}
                                </span>
                                <span className="text-muted-foreground">
                                  /{price.recurring?.interval || 'one-time'}
                                </span>
                              </div>
                              <Button
                                onClick={() => handleCheckout(price.id)}
                                disabled={checkoutLoading === price.id}
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
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            All 6 modules included
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            Up to {product.metadata?.max_locations || '5'} locations
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            Priority support
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {alacarteProducts.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-4">Individual Modules</h2>
                <p className="text-muted-foreground mb-4">
                  Purchase individual modules at $19.99/month each
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {alacarteProducts.map((product) => (
                    <Card key={product.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription className="text-sm">{product.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {product.prices[0] && (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              {formatPrice(product.prices[0].unit_amount, product.prices[0].currency)}/mo
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleCheckout(product.prices[0].id)}
                              disabled={checkoutLoading === product.prices[0].id}
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

            {products.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No subscription plans available at this time. Please check back later.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
