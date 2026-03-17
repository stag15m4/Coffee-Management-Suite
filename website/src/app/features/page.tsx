import { generatePageMetadata } from '@/lib/metadata';
import { FeatureHero } from '@/components/features/FeatureHero';
import { ModuleDeepDive } from '@/components/features/ModuleDeepDive';
import { FeatureComparison } from '@/components/features/FeatureComparison';
import { FinalCTA } from '@/components/home/FinalCTA';

export const metadata = generatePageMetadata({
  title: 'Features',
  description:
    'Six powerful modules for coffee shop management: Recipe Costing, Tip Payouts, Cash Deposits, Bulk Ordering, Equipment Maintenance, and Admin Tasks.',
  path: '/features',
});

export default function FeaturesPage() {
  return (
    <>
      <FeatureHero />
      <ModuleDeepDive />
      <FeatureComparison />
      <FinalCTA />
    </>
  );
}
