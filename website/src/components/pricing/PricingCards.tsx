'use client';

import { Check, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { PRICING_TIERS, APP_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

interface PricingCardsProps {
  annual: boolean;
}

export function PricingCards({ annual }: PricingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
      {PRICING_TIERS.map((tier) => {
        const isProfessional = tier.id === 'professional';
        const isStarter = tier.id === 'starter';
        const price = annual ? tier.price.annual : tier.price.monthly;

        return (
          <div
            key={tier.id}
            className={cn(
              'relative flex flex-col bg-white rounded-2xl p-8 h-full',
              isProfessional ? 'border-2 border-caramel-400 md:scale-[1.03]' : 'border border-cream-300',
              isProfessional && 'shadow-[0_0_20px_rgba(245,166,35,0.15),0_0_40px_rgba(245,166,35,0.05)]'
            )}
          >
            {isProfessional && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="popular">Most Popular</Badge>
              </div>
            )}

            <h3 className="text-h3 text-espresso-900">{tier.name}</h3>

            <div className="mt-4 mb-2 min-h-[64px] flex items-end">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${tier.id}-${annual}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-baseline gap-1"
                >
                  <span className={cn('text-price', isProfessional ? 'text-caramel-400' : 'text-espresso-900')}>
                    {isStarter ? 'Free' : `$${price}`}
                  </span>
                  {!isStarter && <span className="text-body-sm text-espresso-600">{tier.descriptor}</span>}
                </motion.div>
              </AnimatePresence>
            </div>

            <p className="text-body-sm text-espresso-600 mb-6">{tier.subtitle}</p>

            <ul className="space-y-3 mb-8 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-sage-500 shrink-0 mt-0.5" />
                  <span className="text-body-sm text-espresso-600">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={isStarter ? 'secondary' : 'primary'}
              size={isProfessional ? 'lg' : 'md'}
              fullWidth
              href={
                isStarter
                  ? `${APP_URL}/register`
                  : `${APP_URL}/register?plan=${tier.id}${annual ? '&billing=annual' : ''}`
              }
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={() =>
                trackEvent('pricing_cta_click', {
                  plan: tier.id,
                  billing: annual ? 'annual' : 'monthly',
                })
              }
            >
              {tier.cta}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
