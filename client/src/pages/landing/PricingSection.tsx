import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

interface PricingSectionProps {
  gradient: string;
}

const CHARCOAL = '#1A1A1A';
const GOLD_BRIGHT = '#E6C145';

export function PricingSection({ gradient }: PricingSectionProps) {
  const [, setLocation] = useLocation();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      badge: null,
      monthlyPrice: 0,
      annualPrice: 0,
      priceLabel: 'Free',
      priceSuffix: 'forever',
      description: 'Get started with one module, no credit card required',
      features: [
        '1 module of your choice',
        '1 location',
        'Up to 3 users',
        '14-day full access trial',
      ],
      cta: 'Start Free',
      testId: 'button-starter-start',
    },
    {
      id: 'essential',
      name: 'Essential',
      badge: null,
      monthlyPrice: 49,
      annualPrice: 39,
      priceLabel: null,
      priceSuffix: '/mo per location',
      description: 'Pick the modules that matter most to your shop',
      features: [
        'Up to 3 modules',
        'Unlimited users',
        'Per-location pricing',
        'Email support',
      ],
      cta: 'Start Free Trial',
      testId: 'button-essential-start',
    },
    {
      id: 'professional',
      name: 'Professional',
      badge: 'Most Popular',
      monthlyPrice: 99,
      annualPrice: 79,
      priceLabel: null,
      priceSuffix: '/mo per location',
      description: 'Everything you need to run your full operation',
      features: [
        'All 6 modules included',
        'Unlimited users',
        'Per-location pricing',
        'Custom branding',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      testId: 'button-professional-start',
    },
  ];

  return (
    <section id="pricing" className="py-16 md:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: 'var(--color-secondary)' }}
          >
            Simple, Transparent Pricing
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto mb-6"
            style={{ color: 'var(--color-secondary-light)' }}
          >
            Replace 3–5 separate subscriptions with one platform.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center rounded-full p-1" style={{ backgroundColor: CHARCOAL }}>
            <button
              className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
              style={{
                backgroundColor: billing === 'monthly' ? GOLD_BRIGHT : 'transparent',
                color: billing === 'monthly' ? CHARCOAL : 'var(--color-accent)',
              }}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
              style={{
                backgroundColor: billing === 'annual' ? GOLD_BRIGHT : 'transparent',
                color: billing === 'annual' ? CHARCOAL : 'var(--color-accent)',
              }}
              onClick={() => setBilling('annual')}
            >
              Annual
              <span
                className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: billing === 'annual' ? CHARCOAL : GOLD_BRIGHT, color: billing === 'annual' ? GOLD_BRIGHT : CHARCOAL }}
              >
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const price = billing === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const isHighlighted = plan.id === 'professional';

            return (
              <Card
                key={plan.id}
                className="relative overflow-hidden flex flex-col"
                style={{
                  backgroundColor: CHARCOAL,
                  borderColor: isHighlighted ? GOLD_BRIGHT : 'var(--color-primary)',
                  borderWidth: isHighlighted ? '3px' : '2px',
                }}
              >
                {plan.badge && (
                  <div
                    className="absolute top-0 right-0 px-3 py-1 text-sm font-semibold"
                    style={{ background: gradient, color: '#fff' }}
                  >
                    {plan.badge}
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl" style={{ color: GOLD_BRIGHT }}>
                    {plan.name}
                  </CardTitle>
                  <CardDescription style={{ color: 'var(--color-accent)' }}>
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="mb-6">
                    {plan.priceLabel ? (
                      <span className="text-4xl font-bold" style={{ color: GOLD_BRIGHT }}>
                        {plan.priceLabel}
                      </span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold" style={{ color: GOLD_BRIGHT }}>
                          ${price}
                        </span>
                      </>
                    )}
                    <span className="text-sm ml-1" style={{ color: 'var(--color-accent)' }}>
                      {plan.priceSuffix}
                    </span>
                    {billing === 'annual' && plan.monthlyPrice > 0 && (
                      <p className="text-sm mt-1" style={{ color: GOLD_BRIGHT }}>
                        ${plan.annualPrice * 12}/year (save ${(plan.monthlyPrice - plan.annualPrice) * 12}/yr)
                      </p>
                    )}
                  </div>
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
                        <Check className="w-5 h-5 flex-shrink-0" style={{ color: GOLD_BRIGHT }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full font-semibold mt-auto"
                    size="lg"
                    onClick={() => setLocation('/login')}
                    style={{ background: gradient, color: '#fff', border: 'none' }}
                    data-testid={plan.testId}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* A La Carte note */}
        <p className="text-center mt-8 text-sm" style={{ color: 'var(--color-secondary-light)' }}>
          Need just 1–2 modules?{' '}
          <span style={{ color: GOLD_BRIGHT, fontWeight: 600 }}>
            A La Carte from $29/mo per module per location.
          </span>
        </p>
      </div>
    </section>
  );
}
