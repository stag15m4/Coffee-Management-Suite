'use client';

import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Accordion from '@/components/shared/Accordion';

const FAQ_ITEMS = [
  {
    question: 'Is there really a free plan?',
    answer:
      'Yes. Starter gives you one module, one location, and up to 3 users \u2014 free forever. No credit card, no trial expiration. Start using it today.',
  },
  {
    question: 'What happens after the 14-day trial?',
    answer:
      'Your trial gives you full access to every module. After 14 days, you keep the modules included in your plan. Starter users keep their 1 module free forever. No surprise charges.',
  },
  {
    question: 'Can I switch modules on the Essential plan?',
    answer:
      'Yes. You can swap your 3 modules anytime from your account settings. Need Recipe Cost this month and Bulk Ordering next month? No problem.',
  },
  {
    question: 'How does per-location pricing work?',
    answer:
      'Each location is priced independently. You can have different plans for different locations if needed. A flagship store on Professional and a pop-up on Starter? Totally fine.',
  },
  {
    question: 'Can I upgrade or downgrade anytime?',
    answer:
      'Anytime. Upgrades are prorated and take effect immediately. Downgrades take effect at the end of your billing period.',
  },
  {
    question: 'Do you offer discounts for multiple locations?',
    answer: 'We offer custom pricing for operators with 5+ locations. Contact us for details.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. All data is encrypted in transit (TLS), every request is authenticated, and each business\u2019s data is completely isolated. See our Security page for details.',
  },
  {
    question: 'What POS systems do you integrate with?',
    answer:
      'We\u2019re actively building integrations with Square, Toast, Clover, and more. Sign up and we\u2019ll notify you when your POS integration is ready.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. No contracts, no cancellation fees, no guilt trips. Cancel from your account settings in two clicks.',
  },
  {
    question: 'Do you offer onboarding help?',
    answer:
      'Professional plan includes priority onboarding support. Essential and Starter users have access to our complete documentation and community forum.',
  },
];

export function PricingFAQ() {
  return (
    <Section bg="light" padding="md" id="faq">
      <SectionHeading
        title="Frequently Asked Questions"
        subtitle="Everything you need to know about pricing, plans, and getting started."
        align="center"
      />

      <div className="max-w-3xl mx-auto">
        <Accordion items={FAQ_ITEMS} />
      </div>
    </Section>
  );
}
