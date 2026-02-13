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

  return (
    <section id="pricing" className="py-16 md:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: 'var(--color-secondary)' }}
          >
            Simple, Transparent Pricing
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-secondary-light)' }}
          >
            Get everything you need or build your own plan.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Premium Suite */}
          <Card
            className="relative overflow-hidden flex flex-col"
            style={{
              backgroundColor: CHARCOAL,
              borderColor: 'var(--color-primary)',
              borderWidth: '2px',
            }}
          >
            <div
              className="absolute top-0 right-0 px-3 py-1 text-sm font-semibold"
              style={{ background: gradient, color: '#000' }}
            >
              Best Value
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl" style={{ color: GOLD_BRIGHT }}>
                Premium Suite
              </CardTitle>
              <CardDescription style={{ color: 'var(--color-accent)' }}>
                Everything you need to run your operation
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: GOLD_BRIGHT }}>
                  $99.99
                </span>
                <span style={{ color: 'var(--color-accent)' }}>/month</span>
                <p className="text-sm mt-1" style={{ color: 'var(--color-accent)' }}>
                  or $999.99/year
                </p>
                <p className="text-sm mt-2 font-semibold" style={{ color: GOLD_BRIGHT }}>
                  Save $440/year vs individual modules!
                </p>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {['All 6 modules included', 'Up to 5 locations', 'Unlimited users', 'Custom branding', 'Priority support'].map((item) => (
                  <li key={item} className="flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
                    <Check className="w-5 h-5" style={{ color: GOLD_BRIGHT }} />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full font-semibold mt-auto"
                size="lg"
                onClick={() => setLocation('/login')}
                style={{ background: gradient, color: '#000', border: 'none' }}
                data-testid="button-premium-start"
              >
                Start Free Trial
              </Button>
            </CardContent>
          </Card>

          {/* A La Carte */}
          <Card
            className="flex flex-col"
            style={{
              backgroundColor: CHARCOAL,
              borderColor: 'var(--color-primary)',
              borderWidth: '2px',
            }}
          >
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl" style={{ color: GOLD_BRIGHT }}>
                A La Carte
              </CardTitle>
              <CardDescription style={{ color: 'var(--color-accent)' }}>
                Pick only the modules you need
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold" style={{ color: GOLD_BRIGHT }}>
                  $19.99
                </span>
                <span style={{ color: 'var(--color-accent)' }}>/month</span>
                <p className="text-sm mt-1" style={{ color: 'var(--color-accent)' }}>
                  per module
                </p>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {['Choose your modules', '1 location included', 'Add more anytime', 'Upgrade to Premium anytime'].map((item) => (
                  <li key={item} className="flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
                    <Check className="w-5 h-5" style={{ color: GOLD_BRIGHT }} />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full font-semibold mt-auto"
                size="lg"
                onClick={() => setLocation('/login')}
                style={{ background: gradient, color: '#000', border: 'none' }}
                data-testid="button-alacarte-start"
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
