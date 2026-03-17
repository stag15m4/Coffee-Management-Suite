import { Check } from 'lucide-react';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import ScrollReveal from '@/components/shared/ScrollReveal';
import { PRICING_TIERS, APP_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function PricingPreview() {
  return (
    <Section bg="dark" padding="lg" id="pricing-preview">
      <SectionHeading
        title="Simple, Transparent Pricing"
        subtitle="Start free. Upgrade when you're ready. No surprises."
        theme="dark"
        align="center"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 lg:gap-6">
        {PRICING_TIERS.map((tier, index) => {
          const isProfessional = tier.id === 'professional';
          const isStarter = tier.id === 'starter';

          return (
            <ScrollReveal key={tier.id} delay={index * 0.1}>
              <div
                className={cn(
                  'relative flex flex-col rounded-2xl border p-6 md:p-8 h-full',
                  isProfessional ? 'border-caramel-400 bg-espresso-800' : 'border-espresso-700 bg-espresso-800',
                  isProfessional && 'shadow-[0_0_20px_rgba(245,166,35,0.15),0_0_40px_rgba(245,166,35,0.05)]'
                )}
              >
                {isProfessional && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="popular">Most Popular</Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-h4 text-cream-50 mb-1">{tier.name}</h3>
                  <p className="text-body-sm text-cream-600">{tier.subtitle}</p>
                </div>

                <div className="mb-6">
                  <span
                    className={cn(
                      'text-3xl font-clash font-bold',
                      isProfessional ? 'text-caramel-400' : 'text-cream-50'
                    )}
                  >
                    {isStarter ? 'Free' : `$${tier.price.monthly}`}
                  </span>
                  {!isStarter && <span className="text-sm text-cream-600 ml-1">{tier.descriptor}</span>}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-sage-400 shrink-0 mt-0.5" />
                      <span className="text-body-sm text-cream-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isStarter ? 'secondary' : 'primary'}
                  size={isProfessional ? 'lg' : 'md'}
                  fullWidth
                  href={isStarter ? `${APP_URL}/register` : `${APP_URL}/register?plan=${tier.id}`}
                  className={
                    isStarter ? 'border-cream-600 text-cream-300 hover:bg-espresso-700 hover:text-cream-50' : undefined
                  }
                >
                  {tier.cta}
                </Button>
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      <div className="text-center mt-10 space-y-3">
        <a
          href="/pricing"
          className="text-sm font-semibold text-caramel-400 hover:text-caramel-300 transition-colors duration-200 underline underline-offset-4"
        >
          Need the full breakdown?
        </a>
        <p className="text-sm text-cream-600">All paid plans include a 14-day free trial with all modules unlocked.</p>
      </div>
    </Section>
  );
}
