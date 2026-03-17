export const SITE_NAME = 'Coffee Management Suite';
export const SITE_URL = 'https://coffeemanagementsuite.com';
export const APP_URL = 'https://app.coffeemanagementsuite.com';
export const CONTACT_EMAIL = 'hello@coffeemanagementsuite.com';
export const DEMO_URL = 'https://cal.com/coffeemanagementsuite/demo';

export const MODULES = [
  {
    id: 'recipe-cost',
    name: 'Recipe Cost Manager',
    price: 29,
    description:
      'Track ingredients with real-time pricing, create recipes with precise cost breakdowns, and see exactly where your margins are.',
    ideal: 'Any shop making food, specialty drinks, or house-made syrups',
    features: [
      'Track unlimited ingredients with real-time pricing',
      'Build recipes with drag-and-drop ingredient assembly',
      'Auto-calculate food cost percentage per menu item',
      'See margin impact when ingredient prices change',
      'Compare theoretical vs actual food costs',
      'Export cost reports for accounting',
    ],
  },
  {
    id: 'tip-payout',
    name: 'Tip Payout Calculator',
    price: 29,
    description:
      'Automated tip distribution calculations with support for tip pooling, percentage-based splits, and role-based distribution.',
    ideal: 'Any shop with tipped employees',
    features: [
      'Automated tip pool calculations',
      'Support for percentage splits, role-based, and hourly distribution',
      'Per-shift and per-employee payout breakdowns',
      'Exportable reports for payroll integration',
      'Historical tip data and trend analysis',
      'Employee self-service view of their payouts',
    ],
  },
  {
    id: 'cash-deposit',
    name: 'Cash Deposit Record',
    price: 29,
    description:
      'Daily cash reconciliation workflow with deposit tracking, variance detection, and complete audit trails.',
    ideal: 'Any shop handling cash transactions',
    features: [
      'Daily cash count and reconciliation workflow',
      'Automatic variance detection and alerts',
      'Complete audit trail for every deposit',
      'Historical reporting by day, week, month',
      'Multi-register support',
      'Manager sign-off workflow',
    ],
  },
  {
    id: 'bulk-ordering',
    name: 'Bulk Ordering',
    price: 29,
    description:
      'Wholesale order management with vendor-direct email forms, order history tracking, and supplier contact management.',
    ideal: 'Shops ordering from multiple vendors regularly',
    features: [
      'Create and manage vendor contacts and catalogs',
      'Build orders with saved product lists',
      'Send orders directly via vendor email forms',
      'Track order history and spending per vendor',
      'Reorder from previous orders with one click',
      'Set par levels and reorder reminders',
    ],
  },
  {
    id: 'equipment-maintenance',
    name: 'Equipment Maintenance',
    price: 29,
    description: 'Schedule preventive maintenance, get automated reminders, and track repair costs for all equipment.',
    ideal: 'Any shop with espresso machines, grinders, refrigeration',
    features: [
      'Track every piece of equipment with service schedules',
      'Automated reminders before maintenance is due',
      'Log repairs with costs, service providers, and notes',
      'Warranty tracking and expiration alerts',
      'Photo documentation for repairs',
      'Lifetime cost tracking per piece of equipment',
    ],
  },
  {
    id: 'admin-tasks',
    name: 'Administrative Tasks',
    price: 29,
    description: 'Task management with assignment, recurring scheduling, team collaboration, and due date management.',
    ideal: 'Any shop wanting to systematize operations',
    features: [
      'Create and assign tasks to any team member',
      'Set up recurring tasks (daily, weekly, monthly)',
      'Due date tracking with overdue alerts',
      'Task delegation with role-based visibility',
      'Completion confirmations with timestamps',
      'Daily, weekly, and custom task templates',
    ],
  },
] as const;

export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: { monthly: 0, annual: 0 },
    descriptor: 'Free forever',
    subtitle: 'Get started with one module, no credit card required',
    cta: 'Start Free',
    popular: false,
    features: [
      '1 module of your choice',
      '1 location',
      'Up to 3 users',
      '14-day full access trial',
      'Community support',
    ],
  },
  {
    id: 'essential',
    name: 'Essential',
    price: { monthly: 49, annual: 39 },
    descriptor: '/mo per location',
    subtitle: 'Pick the modules that matter most to your shop',
    cta: 'Start Free Trial',
    popular: false,
    features: ['Up to 3 modules', 'Unlimited users', 'Per-location pricing', 'Email support', 'Data export'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: { monthly: 99, annual: 79 },
    descriptor: '/mo per location',
    subtitle: 'Everything you need to run your full operation',
    cta: 'Start Free Trial',
    popular: true,
    features: [
      'All 6 modules included',
      'Unlimited users',
      'Per-location pricing',
      'Custom branding (your logo & colors)',
      'Priority support',
      'Advanced reporting',
      'API access (coming soon)',
    ],
  },
] as const;

export const NAV_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Customers', href: '/customers' },
  { label: 'Blog', href: '/blog' },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      'We were tracking tips in a notebook and costs in a spreadsheet that nobody updated. CMS replaced both in a day. My team actually knows their exact payout now before they leave for the night.',
    name: 'Sarah M.',
    title: 'Owner',
    shop: 'Groundwork Coffee',
    location: 'Portland, OR',
    image: '/images/testimonials/customer-1.jpg',
  },
  {
    quote:
      "I used to dread end-of-month when I'd realize our food costs had drifted 4% higher than I thought. Recipe Cost Manager caught that in the first week. Paid for itself immediately.",
    name: 'Marcus T.',
    title: 'Owner-Operator',
    shop: 'Daily Grind Cafe',
    location: 'Austin, TX',
    image: '/images/testimonials/customer-2.jpg',
  },
  {
    quote:
      'With three locations, I was driving between shops just to check on things. Now I see everything from one dashboard on my phone. I actually took a vacation last month. First one in two years.',
    name: 'Priya K.',
    title: 'Multi-Location Owner',
    shop: 'Bloom Coffee Co.',
    location: 'Nashville, TN',
    image: '/images/testimonials/customer-3.jpg',
  },
] as const;
