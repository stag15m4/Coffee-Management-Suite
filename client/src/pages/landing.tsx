import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  DollarSign, 
  Coffee, 
  Wrench, 
  ClipboardList, 
  PiggyBank,
  Check,
  ChevronRight,
  Building2,
  Users,
  Shield,
  BarChart3
} from 'lucide-react';
import logoPath from '@assets/Subject_1769202087116.png';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
};

const modules = [
  {
    id: 'recipe-costing',
    title: 'Recipe Cost Manager',
    description: 'Track ingredients, create recipes, and calculate precise food costs to protect your margins.',
    icon: Calculator,
    price: '$39.99/mo',
  },
  {
    id: 'tip-payout',
    title: 'Tip Payout Calculator',
    description: 'Streamline tip distribution with automated calculations and detailed payout reports.',
    icon: DollarSign,
    price: '$19.99/mo',
  },
  {
    id: 'cash-deposit',
    title: 'Cash Deposit Record',
    description: 'Manage daily cash reconciliation and deposits with complete audit trails.',
    icon: PiggyBank,
    price: '$9.99/mo',
  },
  {
    id: 'bulk-ordering',
    title: 'Coffee Ordering',
    description: 'Handle wholesale coffee orders efficiently with vendor management and order tracking.',
    icon: Coffee,
    price: '$9.99/mo',
  },
  {
    id: 'equipment-maintenance',
    title: 'Equipment Maintenance',
    description: 'Schedule and track equipment upkeep with warranty tracking and maintenance history.',
    icon: Wrench,
    price: '$19.99/mo',
  },
  {
    id: 'admin-tasks',
    title: 'Administrative Tasks',
    description: 'Comprehensive task management with delegation, recurring tasks, and team collaboration.',
    icon: ClipboardList,
    price: '$19.99/mo',
  },
];

const features = [
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
    title: 'Secure & Reliable',
    description: 'Enterprise-grade security with encrypted data and automatic backups.',
  },
  {
    icon: BarChart3,
    title: 'Custom Branding',
    description: 'White-label solution with your logo and colors across all modules.',
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div style={{ backgroundColor: colors.white, minHeight: '100vh' }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={logoPath} alt="Erwin Mills" className="h-10 w-10" />
              <span className="text-xl font-bold" style={{ color: colors.brown }}>
                Erwin Mills
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setLocation('/login')}
                style={{ color: colors.brown }}
                data-testid="button-login"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => setLocation('/login')}
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-get-started"
              >
                Get Started
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden" style={{ backgroundColor: colors.cream }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge 
                className="mb-4"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
              >
                Built for Food Service
              </Badge>
              <h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
                style={{ color: colors.brown }}
              >
                Manage Your Coffee Shop Like a Pro
              </h1>
              <p 
                className="text-lg md:text-xl mb-8"
                style={{ color: colors.brownLight }}
              >
                The complete management suite for coffee shops, cafes, and food service operations. 
                Track costs, manage staff, and streamline operations — all in one place.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg"
                  onClick={() => setLocation('/login')}
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                  data-testid="button-hero-start"
                >
                  Start Free Trial
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{ borderColor: colors.brown, color: colors.brown }}
                  data-testid="button-view-pricing"
                >
                  View Pricing
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <img 
                src={logoPath} 
                alt="Erwin Mills Management Suite" 
                className="w-64 h-64 md:w-80 md:h-80 drop-shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-16 md:py-24" style={{ backgroundColor: colors.white }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: colors.brown }}
            >
              Everything You Need to Run Your Business
            </h2>
            <p 
              className="text-lg max-w-2xl mx-auto"
              style={{ color: colors.brownLight }}
            >
              Built by food service professionals, for food service professionals.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card 
                key={feature.title}
                className="text-center"
                style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
              >
                <CardContent className="pt-6">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: colors.gold }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: colors.brown }} />
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: colors.brown }}>
                    {feature.title}
                  </h3>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section className="py-16 md:py-24" style={{ backgroundColor: colors.cream }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: colors.brown }}
            >
              Powerful Modules, Your Choice
            </h2>
            <p 
              className="text-lg max-w-2xl mx-auto"
              style={{ color: colors.brownLight }}
            >
              Pick the tools you need, or get them all with Premium Suite.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => (
              <Card 
                key={module.id}
                className="hover-elevate"
                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                data-testid={`card-module-${module.id}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: colors.gold }}
                    >
                      <module.icon className="w-5 h-5" style={{ color: colors.brown }} />
                    </div>
                    <Badge variant="secondary" style={{ color: colors.brownLight }}>
                      {module.price}
                    </Badge>
                  </div>
                  <CardTitle style={{ color: colors.brown }}>{module.title}</CardTitle>
                  <CardDescription style={{ color: colors.brownLight }}>
                    {module.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-24" style={{ backgroundColor: colors.white }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: colors.brown }}
            >
              Simple, Transparent Pricing
            </h2>
            <p 
              className="text-lg max-w-2xl mx-auto"
              style={{ color: colors.brownLight }}
            >
              Get everything you need or build your own plan.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Premium Suite */}
            <Card 
              className="relative overflow-hidden"
              style={{ 
                backgroundColor: colors.brown, 
                borderColor: colors.gold,
                borderWidth: '2px'
              }}
            >
              <div 
                className="absolute top-0 right-0 px-3 py-1 text-sm font-semibold"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
              >
                Best Value
              </div>
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl" style={{ color: colors.white }}>
                  Premium Suite
                </CardTitle>
                <CardDescription style={{ color: colors.creamDark }}>
                  Everything you need to run your operation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ color: colors.gold }}>
                    $99.99
                  </span>
                  <span style={{ color: colors.creamDark }}>/month</span>
                  <p className="text-sm mt-1" style={{ color: colors.creamDark }}>
                    or $999.99/year (save $200!)
                  </p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    All 6 modules included
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    Up to 5 locations
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    Unlimited users
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    Custom branding
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    Priority support
                  </li>
                </ul>
                <Button 
                  className="w-full"
                  size="lg"
                  onClick={() => setLocation('/login')}
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                  data-testid="button-premium-start"
                >
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>

            {/* À La Carte */}
            <Card 
              style={{ 
                backgroundColor: colors.cream, 
                borderColor: colors.creamDark 
              }}
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl" style={{ color: colors.brown }}>
                  À La Carte
                </CardTitle>
                <CardDescription style={{ color: colors.brownLight }}>
                  Pick only the modules you need
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ color: colors.brown }}>
                    From $9.99
                  </span>
                  <span style={{ color: colors.brownLight }}>/month</span>
                  <p className="text-sm mt-1" style={{ color: colors.brownLight }}>
                    per module
                  </p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2" style={{ color: colors.brown }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    Choose your modules
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.brown }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    1 location included
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.brown }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    Add more anytime
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.brown }}>
                    <Check className="w-5 h-5" style={{ color: colors.gold }} />
                    Upgrade to Premium anytime
                  </li>
                </ul>
                <Button 
                  className="w-full"
                  size="lg"
                  variant="outline"
                  onClick={() => setLocation('/login')}
                  style={{ borderColor: colors.brown, color: colors.brown }}
                  data-testid="button-alacarte-start"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24" style={{ backgroundColor: colors.brown }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: colors.white }}
          >
            Ready to Transform Your Operations?
          </h2>
          <p 
            className="text-lg mb-8"
            style={{ color: colors.creamDark }}
          >
            Join coffee shops and cafes that trust Erwin Mills to run their business.
          </p>
          <Button 
            size="lg"
            onClick={() => setLocation('/login')}
            style={{ backgroundColor: colors.gold, color: colors.brown }}
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
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoPath} alt="Erwin Mills" className="h-8 w-8" />
              <span className="font-semibold" style={{ color: colors.brown }}>
                Erwin Mills Management Suite
              </span>
            </div>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              © {new Date().getFullYear()} Erwin Mills Coffee Company. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
