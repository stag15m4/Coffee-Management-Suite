import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  BarChart3,
  X
} from 'lucide-react';
import logoPath from '@assets/Erwin-Mills-Logo_1767709452739.png';
import { colors } from '@/lib/colors';

const localColors = {
  goldBright: '#E6C145',
  black: '#000000',
  charcoal: '#1A1A1A',
};

const goldGradient = 'linear-gradient(135deg, #E6C145 0%, #C9A227 50%, #997A1F 100%)';

const modules = [
  {
    id: 'recipe-costing',
    title: 'Recipe Cost Manager',
    description: 'Track ingredients, create recipes, and calculate precise food costs to protect your margins. Quick color-coded readout. Automatically updates with vendor price changes.',
    icon: Calculator,
    price: '$19.99/mo',
    features: [
      'Create and manage ingredient usage with real-time pricing',
      'Build recipes with automatic cost calculations',
      'Factor in Ops Costs on a per-drink basis',
      'Track food cost percentages and profit margins',
      'Track OVERALL Profit per drink and Margin for all recipes',
      'Organize ingredients by category (dairy, produce, meats, etc.)',
      'Export recipe cards and cost breakdowns to PDF',
    ],
    example: 'Enter your latte recipe with espresso, milk, and syrup. See instantly that your $4.75 latte costs $3.21 to make — a 32.4% margin.',
  },
  {
    id: 'tip-payout',
    title: 'Tip Payout Calculator',
    description: 'Streamline and delegate tip distribution with automated calculations and detailed payout reports.',
    icon: DollarSign,
    price: '$19.99/mo',
    features: [
      'Automatic tip pool calculations based on hours worked',
      'Handle credit card fee deductions automatically',
      'Track multiple tip periods (weekly, bi-weekly)',
      'Generate detailed payout summaries',
      'Export reports to PDF or CSV for payroll and W2 tracking',
    ],
    example: 'Enter $2,400 in weekly tips across 8 employees. The system calculates each person\'s share based on their hours, deducts CC fees only from CC tips, and shows exact payout amounts.',
  },
  {
    id: 'cash-deposit',
    title: 'Cash Deposit Record',
    description: 'Manage daily cash reconciliation and deposits with complete audit trails.',
    icon: PiggyBank,
    price: '$19.99/mo',
    features: [
      'Daily cash drawer reconciliation',
      'Track deposits by date with running totals',
      'Auto-calculate expected vs actual cash',
      'Flag discrepancies for review',
      'Add notes to daily records as necessary',
      'Complete audit trail of all entries',
      'Export deposit history to CSV',
    ],
    example: 'Closing staff counts drawer at night and comes up short. Opening staff counts drawer and comes up over expected till amount. This can be easily tracked by Owner, Manager, Lead or anyone you delegate the task to. No spreadsheets necessary!',
  },
  {
    id: 'bulk-ordering',
    title: 'Coffee Ordering',
    description: 'Handle wholesale coffee orders efficiently with a vendor-direct email form.',
    icon: Coffee,
    price: '$19.99/mo',
    features: [
      'Manage multiple wholesale coffee products',
      'Track product pricing and order history',
      'Create and submit email-based orders directly',
      'View order history and spending trends',
      'Export orders and invoices',
    ],
    example: 'Delegate coffee ordering to your Lead Barista or Store Manager. Track what they\'ve bought and what you\'ve spent this quarter.',
  },
  {
    id: 'equipment-maintenance',
    title: 'Equipment Maintenance',
    description: 'Schedule and track equipment maintenance with warranty tracking and maintenance history export.',
    icon: Wrench,
    price: '$19.99/mo',
    features: [
      'Catalog all equipment with specs and manuals',
      'Track warranty status and expiration dates',
      'Schedule preventive maintenance tasks',
      'Log maintenance history and costs',
      'Set reminders for upcoming service',
      'Upload warranty documents and receipts',
    ],
    example: 'Your Eureka Atom 75 needs monthly deep-cleaning. Set it up once, get reminded automatically, and log each service with notes.',
  },
  {
    id: 'admin-tasks',
    title: 'Administrative Tasks',
    description: 'Comprehensive task management with delegation, recurring tasks, and team collaboration for management activities.',
    icon: ClipboardList,
    price: '$19.99/mo',
    features: [
      'Create tasks with priorities and due dates',
      'Assign tasks to team members',
      'Set up recurring tasks (daily, weekly, monthly)',
      'Organize with custom categories',
      'Track completion and add comments',
      'View task history and team performance',
    ],
    example: 'Create a recurring task: "Re-Certify FOH Fire Extinguishers for this year" repeats every January 1. Track completion and add notes as needed.',
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

type ModuleType = typeof modules[number];

export default function Landing() {
  const [, setLocation] = useLocation();
  const [selectedModule, setSelectedModule] = useState<ModuleType | null>(null);

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
              <img src={logoPath} alt="Erwin Mills Coffee Management Suite" className="h-10 w-10" />
              <span className="text-xl font-bold" style={{ color: colors.brown }}>
                Erwin Mills Coffee Management Suite
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
                className="font-semibold"
                onClick={() => setLocation('/login')}
                style={{ background: goldGradient, color: localColors.black, border: 'none' }}
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
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                Built for Food Service
              </Badge>
              <h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
                style={{ color: colors.brown }}
              >
                Stop Working <em>For</em> Your Cafe.<br />Start Working <em>On</em> It.
              </h1>
              <p 
                className="text-lg md:text-xl mb-8"
                style={{ color: colors.brownLight }}
              >
                Tired of missing vacations and never enjoying the fruits of your labor? 
                Our Coffee Management Suite helps new owners quickly become profitable — and helps 
                seasoned owners delegate and scale. Delegation is the hardest part of ownership. 
                We make it safe, simple, and trackable.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg"
                  className="font-semibold"
                  onClick={() => setLocation('/login')}
                  style={{ background: goldGradient, color: localColors.black, border: 'none' }}
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
                className="hover-elevate cursor-pointer transition-transform"
                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                onClick={() => setSelectedModule(module)}
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
                <CardContent className="pt-0">
                  <p className="text-sm font-medium" style={{ color: colors.gold }}>
                    Click to see examples →
                  </p>
                </CardContent>
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
              className="relative overflow-hidden flex flex-col"
              style={{ 
                backgroundColor: localColors.charcoal, 
                borderColor: colors.gold,
                borderWidth: '2px'
              }}
            >
              <div 
                className="absolute top-0 right-0 px-3 py-1 text-sm font-semibold"
                style={{ background: goldGradient, color: localColors.black }}
              >
                Best Value
              </div>
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl" style={{ color: localColors.goldBright }}>
                  Premium Suite
                </CardTitle>
                <CardDescription style={{ color: colors.cream }}>
                  Everything you need to run your operation
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ color: localColors.goldBright }}>
                    $99.99
                  </span>
                  <span style={{ color: colors.cream }}>/month</span>
                  <p className="text-sm mt-1" style={{ color: colors.cream }}>
                    or $999.99/year
                  </p>
                  <p className="text-sm mt-2 font-semibold" style={{ color: localColors.goldBright }}>
                    Save $440/year vs individual modules!
                  </p>
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    All 6 modules included
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    Up to 5 locations
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    Unlimited users
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    Custom branding
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    Priority support
                  </li>
                </ul>
                <Button 
                  className="w-full font-semibold mt-auto"
                  size="lg"
                  onClick={() => setLocation('/login')}
                  style={{ background: goldGradient, color: localColors.black, border: 'none' }}
                  data-testid="button-premium-start"
                >
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>

            {/* À La Carte */}
            <Card 
              className="flex flex-col"
              style={{ 
                backgroundColor: localColors.charcoal, 
                borderColor: colors.gold,
                borderWidth: '2px'
              }}
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl" style={{ color: localColors.goldBright }}>
                  À La Carte
                </CardTitle>
                <CardDescription style={{ color: colors.cream }}>
                  Pick only the modules you need
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ color: localColors.goldBright }}>
                    $19.99
                  </span>
                  <span style={{ color: colors.cream }}>/month</span>
                  <p className="text-sm mt-1" style={{ color: colors.cream }}>
                    per module
                  </p>
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    Choose your modules
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    1 location included
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    Add more anytime
                  </li>
                  <li className="flex items-center gap-2" style={{ color: colors.cream }}>
                    <Check className="w-5 h-5" style={{ color: localColors.goldBright }} />
                    Upgrade to Premium anytime
                  </li>
                </ul>
                <Button 
                  className="w-full font-semibold mt-auto"
                  size="lg"
                  onClick={() => setLocation('/login')}
                  style={{ background: goldGradient, color: localColors.black, border: 'none' }}
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
      <section className="py-16 md:py-24" style={{ backgroundColor: localColors.charcoal }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: localColors.goldBright }}
          >
            Ready to Transform Your Operations?
          </h2>
          <p 
            className="text-lg mb-8"
            style={{ color: colors.cream }}
          >
            Join coffee shops and cafes that trust Erwin Mills to run their business.
          </p>
          <Button 
            size="lg"
            className="font-semibold"
            onClick={() => setLocation('/login')}
            style={{ background: goldGradient, color: localColors.black, border: 'none' }}
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

      {/* Module Details Modal */}
      <Dialog open={!!selectedModule} onOpenChange={() => setSelectedModule(null)}>
        <DialogContent 
          className="max-w-lg max-h-[85vh] overflow-y-auto"
          style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
        >
          {selectedModule && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.gold }}
                  >
                    <selectedModule.icon className="w-6 h-6" style={{ color: colors.brown }} />
                  </div>
                  <div>
                    <DialogTitle style={{ color: colors.brown }}>
                      {selectedModule.title}
                    </DialogTitle>
                    <Badge style={{ backgroundColor: colors.gold, color: colors.white }}>
                      {selectedModule.price}
                    </Badge>
                  </div>
                </div>
                <DialogDescription style={{ color: colors.brownLight }}>
                  {selectedModule.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Features List */}
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: colors.brown }}>
                    What You Can Do
                  </h4>
                  <ul className="space-y-2">
                    {selectedModule.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: colors.gold }} />
                        <span className="text-sm" style={{ color: colors.brownLight }}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Example */}
                <div 
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: colors.cream }}
                >
                  <h4 className="font-semibold mb-2" style={{ color: colors.brown }}>
                    Real Example
                  </h4>
                  <p className="text-sm" style={{ color: colors.brownLight }}>
                    {selectedModule.example}
                  </p>
                </div>

                {/* CTA */}
                <Button 
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setSelectedModule(null);
                    setLocation('/login');
                  }}
                  style={{ background: goldGradient, color: localColors.black, border: 'none' }}
                  data-testid="button-modal-start"
                >
                  Start Free Trial
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
