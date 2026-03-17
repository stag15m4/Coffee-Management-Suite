import { generatePageMetadata } from '@/lib/metadata';
import { PricingPage } from '@/components/pricing/PricingPage';

export const metadata = generatePageMetadata({
  title: 'Pricing',
  description:
    'Simple, transparent pricing for coffee shops. Start free forever with one module. Essential from $49/mo, Professional from $99/mo per location.',
  path: '/pricing',
});

export default function Page() {
  return <PricingPage />;
}
