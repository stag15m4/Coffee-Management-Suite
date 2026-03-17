'use client';

import { useState } from 'react';
import { PricingHero } from './PricingHero';
import { BillingToggle } from './BillingToggle';
import { PricingCards } from './PricingCards';
import { ModulePicker } from './ModulePicker';
import { PricingFAQ } from './PricingFAQ';
import { FinalCTA } from '@/components/home/FinalCTA';
import Container from '@/components/shared/Container';

export function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      <PricingHero />
      <section className="bg-cream-50 pb-24">
        <Container>
          <div className="mb-12">
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>
          <PricingCards annual={annual} />
        </Container>
      </section>
      <ModulePicker />
      <PricingFAQ />
      <FinalCTA />
    </>
  );
}
