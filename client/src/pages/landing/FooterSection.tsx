import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

const CHARCOAL = '#1A1A1A';

interface FooterSectionProps {
  productName: string;
  displayName: string;
  logoUrl: string | null;
  logoFallback: string;
  gradient: string;
}

export function FooterSection({ productName, displayName, logoUrl, logoFallback, gradient }: FooterSectionProps) {
  const [, setLocation] = useLocation();

  return (
    <>
      {/* CTA Section */}
      <section className="py-16 md:py-24" style={{ backgroundColor: CHARCOAL }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: '#E6C145' }}
          >
            Ready to Transform Your Operations?
          </h2>
          <p
            className="text-lg mb-8"
            style={{ color: 'var(--color-accent)' }}
          >
            Join {displayName.toLowerCase()}s that trust {productName} to run their business.
          </p>
          <Button
            size="lg"
            className="font-semibold"
            onClick={() => setLocation('/login')}
            style={{ background: gradient, color: '#000', border: 'none' }}
            data-testid="button-cta-start"
          >
            Start Your Free Trial
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 border-t"
        style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoUrl || logoFallback} alt={productName} className="h-8 w-8" />
              <span className="font-semibold" style={{ color: 'var(--color-secondary)' }}>
                {productName}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
              &copy; {new Date().getFullYear()} {productName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
