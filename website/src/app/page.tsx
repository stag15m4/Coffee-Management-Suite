import { HeroSection } from '@/components/home/HeroSection';
import { SocialProofBar } from '@/components/home/SocialProofBar';
import { ProblemSection } from '@/components/home/ProblemSection';
import { SolutionReveal } from '@/components/home/SolutionReveal';
import { ModuleShowcase } from '@/components/home/ModuleShowcase';
import { PlatformFeatures } from '@/components/home/PlatformFeatures';
import { TestimonialSection } from '@/components/home/TestimonialSection';
import { ROICalculator } from '@/components/home/ROICalculator';
import { PricingPreview } from '@/components/home/PricingPreview';
import { FinalCTA } from '@/components/home/FinalCTA';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SocialProofBar />
      <ProblemSection />
      <SolutionReveal />
      <ModuleShowcase />
      <PlatformFeatures />
      <TestimonialSection />
      <ROICalculator />
      <PricingPreview />
      <FinalCTA />
    </>
  );
}
