import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Building2, Users, Shield, BarChart3, Lock, Eye, RefreshCw } from 'lucide-react';
import { useVertical } from '@/contexts/VerticalContext';
import { useTheme } from '@/contexts/ThemeProvider';
import { HeroSection } from './HeroSection';
import { ModuleShowcase } from './ModuleShowcase';
import { PricingSection } from './PricingSection';
import { FooterSection } from './FooterSection';
const logoPath = '/logo.png';

// ---------------------------------------------------------------------------
// Static features grid (generic across all verticals)
// ---------------------------------------------------------------------------

const PLATFORM_FEATURES = [
  {
    icon: Building2,
    title: 'Multi-Location Support',
    description: 'Manage multiple locations from a single dashboard with location-specific settings.',
  },
  {
    icon: Users,
    title: 'Role-Based Access',
    description: 'Control who sees what with Owner, Manager, Lead, and Employee roles.',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'Your data is encrypted, access is verified on every request, and each business is fully isolated.',
  },
  {
    icon: BarChart3,
    title: 'Custom Branding',
    description: 'White-label solution with your logo and colors across all modules.',
  },
];

// Default landing content (coffee-centric fallback)
const DEFAULT_LANDING = {
  headline: 'Stop Working <em>For</em> Your Cafe.<br />Start Working <em>On</em> It.',
  subheadline:
    'Tired of missing vacations and never enjoying the fruits of your labor? Our management suite helps new owners quickly become profitable — and helps seasoned owners delegate and scale.',
  ctaText: 'Start Free Trial',
  badgeText: 'Built for Food Service',
};

// Gradient helper — builds a 3-stop gradient from a primary color
function buildGradient(primary: string): string {
  return `linear-gradient(135deg, ${primary}dd 0%, ${primary} 50%, ${primary}cc 100%)`;
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function Landing() {
  const [, setLocation] = useLocation();
  const { vertical } = useVertical();
  const { colors: themeColors, meta } = useTheme();

  // Resolve content from vertical config or use defaults
  const landingContent = vertical?.landingContent || {};
  const headline = landingContent.headline || DEFAULT_LANDING.headline;
  const subheadline = landingContent.subheadline || DEFAULT_LANDING.subheadline;
  const ctaText = landingContent.ctaText || DEFAULT_LANDING.ctaText;
  const badgeText = DEFAULT_LANDING.badgeText;

  const productName = vertical?.productName || meta.companyName || 'Coffee Management Suite';
  const displayName = vertical?.displayName || 'Coffee Shop';
  const gradient = buildGradient(themeColors.primary);

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={meta.logoUrl || logoPath} alt={productName} className="h-10 w-10" />
              <span className="text-xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                {productName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setLocation('/login')}
                style={{ color: 'var(--color-secondary)' }}
                data-testid="button-login"
              >
                Sign In
              </Button>
              <Button
                className="font-semibold"
                onClick={() => setLocation('/login')}
                style={{ background: gradient, color: '#fff', border: 'none' }}
                data-testid="button-get-started"
              >
                Get Started
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <HeroSection
        headline={headline}
        subheadline={subheadline}
        ctaText={ctaText}
        badgeText={badgeText}
        logoUrl={meta.logoUrl}
        logoFallback={logoPath}
        productName={productName}
        gradient={gradient}
      />

      {/* Platform Features */}
      <section className="py-16 md:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: 'var(--color-secondary)' }}
            >
              Everything You Need to Run Your Business
            </h2>
            <p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: 'var(--color-secondary-light)' }}
            >
              Built by food service professionals, for food service professionals.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLATFORM_FEATURES.map((feature) => (
              <Card
                key={feature.title}
                className="text-center"
                style={{ backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-accent-dark)' }}
              >
                <CardContent className="pt-6">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-secondary)' }}>
                    {feature.title}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security Trust Section */}
      <section
        className="py-12 md:py-16 border-t border-b"
        style={{ backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-accent-dark)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: gradient }}
            >
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h2
              className="text-2xl md:text-3xl font-bold mb-3"
              style={{ color: 'var(--color-secondary)' }}
            >
              Your Data, Protected
            </h2>
            <p
              className="text-base max-w-2xl mx-auto"
              style={{ color: 'var(--color-secondary-light)' }}
            >
              We take security seriously so you can focus on running your business.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
              <h3 className="font-semibold mb-1.5" style={{ color: 'var(--color-secondary)' }}>
                Encrypted Connections
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
                All data is transmitted over secure, encrypted connections. Your information is never sent in plain text.
              </p>
            </div>
            <div className="text-center">
              <Eye className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
              <h3 className="font-semibold mb-1.5" style={{ color: 'var(--color-secondary)' }}>
                Strict Access Controls
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
                Every request is authenticated and authorized. Each business can only access its own data — no exceptions.
              </p>
            </div>
            <div className="text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
              <h3 className="font-semibold mb-1.5" style={{ color: 'var(--color-secondary)' }}>
                Reliable Infrastructure
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
                Hosted on trusted cloud infrastructure with automatic backups, so your data is safe and always available.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Module Showcase */}
      <ModuleShowcase gradient={gradient} />

      {/* Pricing */}
      <PricingSection gradient={gradient} />

      {/* CTA + Footer */}
      <FooterSection
        productName={productName}
        displayName={displayName}
        logoUrl={meta.logoUrl}
        logoFallback={logoPath}
        gradient={gradient}
      />
    </div>
  );
}
