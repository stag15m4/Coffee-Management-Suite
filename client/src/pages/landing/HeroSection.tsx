import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

interface HeroSectionProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  badgeText: string;
  logoUrl: string | null;
  logoFallback: string;
  productName: string;
  gradient: string;
}

export function HeroSection({
  headline,
  subheadline,
  ctaText,
  badgeText,
  logoUrl,
  logoFallback,
  productName,
  gradient,
}: HeroSectionProps) {
  const [, setLocation] = useLocation();

  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: 'var(--color-accent)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge
              className="mb-4"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              {badgeText}
            </Badge>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              style={{ color: 'var(--color-secondary)' }}
              dangerouslySetInnerHTML={{ __html: headline }}
            />
            <p
              className="text-lg md:text-xl mb-8"
              style={{ color: 'var(--color-secondary-light)' }}
            >
              {subheadline}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="font-semibold"
                onClick={() => setLocation('/login')}
                style={{ background: gradient, color: '#fff', border: 'none' }}
                data-testid="button-hero-start"
              >
                {ctaText}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{ borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }}
                data-testid="button-view-pricing"
              >
                View Pricing
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <img
              src={logoUrl || logoFallback}
              alt={productName}
              className="w-64 h-64 md:w-80 md:h-80 drop-shadow-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
