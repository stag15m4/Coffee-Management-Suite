/**
 * Module Registry — Single source of truth for all module metadata.
 *
 * When adding a new module:
 * 1. Add an entry to MODULE_REGISTRY below
 * 2. Add its icon to ICON_MAP if not already present
 * 3. Add its page route in App.tsx
 * That's it — all navigation, sidebar, billing, command palette, etc. derive from this file.
 */

import {
  Calculator,
  DollarSign,
  Receipt,
  PiggyBank,
  Coffee,
  Wrench,
  ListTodo,
  ClipboardList,
  CalendarDays,
  BarChart3,
  FileText,
  type LucideIcon,
} from 'lucide-react';

// =====================================================
// Icon map — string key to React component
// =====================================================

const ICON_MAP: Record<string, LucideIcon> = {
  Calculator,
  DollarSign,
  Receipt,
  PiggyBank,
  Coffee,
  Wrench,
  ListTodo,
  ClipboardList,
  CalendarDays,
  BarChart3,
  FileText,
};

export function resolveIcon(key: string): LucideIcon {
  return ICON_MAP[key] || FileText;
}

// =====================================================
// Types
// =====================================================

export const MODULE_IDS = [
  'recipe-costing',
  'tip-payout',
  'cash-deposit',
  'bulk-ordering',
  'equipment-maintenance',
  'admin-tasks',
  'calendar-workforce',
  'reporting',
  'document-library',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type UserRole = 'owner' | 'manager' | 'lead' | 'employee';

export interface NavTab {
  id: string;
  label: string;
}

export interface ModuleShowcaseData {
  title: string;
  description: string;
  iconKey: string;
  price: string;
  features: string[];
  example: string;
}

export interface ModuleDefinition {
  id: ModuleId;

  // Display names
  name: string;
  shortName: string;

  // Routing
  route: string;
  tabs?: NavTab[];

  // Navigation
  iconKey: string;
  category: string;
  mobilePriority: number;

  // Access control
  minRole: UserRole;

  // Navigation label (for use-term integration)
  labelKey: string;
  staticLabel?: string;

  // Command palette
  commandLabel: string;
  commandKeywords: string[];

  // Landing page showcase (null = not shown on landing page)
  showcase: ModuleShowcaseData | null;

  // Billing preview tagline
  previewTagline?: string;
}

// =====================================================
// THE REGISTRY
// =====================================================

export const MODULE_REGISTRY: Record<ModuleId, ModuleDefinition> = {
  'recipe-costing': {
    id: 'recipe-costing',
    name: 'Recipe Costing',
    shortName: 'Recipes',
    route: '/recipe-costing',
    tabs: [
      { id: 'pricing', label: 'Pricing Matrix' },
      { id: 'ingredients', label: 'Ingredients' },
      { id: 'recipes', label: 'Recipes' },
      { id: 'vendors', label: 'Vendors' },
      { id: 'bases', label: 'Bases' },
      { id: 'overhead', label: 'Overhead' },
      { id: 'settings', label: 'Settings' },
    ],
    iconKey: 'Calculator',
    category: 'Kitchen',
    mobilePriority: 1,
    minRole: 'manager',
    labelKey: 'recipe',
    commandLabel: 'Recipe Costing',
    commandKeywords: ['recipes', 'ingredients', 'pricing', 'overhead', 'vendors', 'bases'],
    showcase: {
      title: 'Recipe Cost Manager',
      description: 'Track ingredients, create recipes, and calculate precise food costs to protect your margins.',
      iconKey: 'Calculator',
      price: '$29/mo',
      features: [
        'Create and manage ingredient usage with real-time pricing',
        'Build recipes with automatic cost calculations',
        'Factor in Ops Costs on a per-item basis',
        'Track food cost percentages and profit margins',
        'Organize ingredients by category',
        'Export recipe cards and cost breakdowns',
      ],
      example: 'Enter your recipe with ingredients and quantities. See instantly what it costs to make and your exact margin.',
    },
    previewTagline: 'Know your costs. Protect your margins.',
  },

  'tip-payout': {
    id: 'tip-payout',
    name: 'Tip Payout',
    shortName: 'Tips',
    route: '/tip-payout',
    iconKey: 'DollarSign',
    category: 'Operations',
    mobilePriority: 3,
    minRole: 'lead',
    labelKey: 'tipPayout',
    commandLabel: 'Tip Payout',
    commandKeywords: ['tips', 'gratuity'],
    showcase: {
      title: 'Tip Payout Calculator',
      description: 'Streamline tip distribution with automated calculations and detailed payout reports.',
      iconKey: 'DollarSign',
      price: '$29/mo',
      features: [
        'Automatic tip pool calculations based on hours worked',
        'Handle credit card fee deductions automatically',
        'Track multiple tip periods (weekly, bi-weekly)',
        'Generate detailed payout summaries',
        'Export reports for payroll and W2 tracking',
      ],
      example: "Enter weekly tips across your team. The system calculates each person's share based on their hours and shows exact payout amounts.",
    },
    previewTagline: 'Fair tips, calculated in seconds.',
  },

  'cash-deposit': {
    id: 'cash-deposit',
    name: 'Cash Deposit',
    shortName: 'Cash',
    route: '/cash-deposit',
    iconKey: 'Receipt',
    category: 'Operations',
    mobilePriority: 2,
    minRole: 'manager',
    labelKey: 'deposit',
    commandLabel: 'Cash Deposit',
    commandKeywords: ['deposit', 'cash', 'register', 'drawer'],
    showcase: {
      title: 'Cash Deposit Record',
      description: 'Manage daily cash reconciliation and deposits with complete audit trails.',
      iconKey: 'PiggyBank',
      price: '$29/mo',
      features: [
        'Daily cash drawer reconciliation',
        'Track deposits by date with running totals',
        'Auto-calculate expected vs actual cash',
        'Flag discrepancies for review',
        'Complete audit trail of all entries',
        'Export deposit history to CSV',
      ],
      example: 'Staff counts the drawer at close, logs it, and any discrepancies are flagged. No spreadsheets necessary.',
    },
    previewTagline: 'Every dollar tracked. Every deposit verified.',
  },

  'bulk-ordering': {
    id: 'bulk-ordering',
    name: 'Coffee Orders',
    shortName: 'Orders',
    route: '/coffee-order',
    iconKey: 'Coffee',
    category: 'Operations',
    mobilePriority: 7,
    minRole: 'lead',
    labelKey: '',
    staticLabel: 'Bulk Ordering',
    commandLabel: 'Coffee Orders',
    commandKeywords: ['order', 'bulk', 'wholesale'],
    showcase: {
      title: 'Bulk Ordering',
      description: 'Handle wholesale orders efficiently with a vendor-direct email form.',
      iconKey: 'Coffee',
      price: '$29/mo',
      features: [
        'Manage wholesale products from multiple suppliers',
        'Track product pricing and order history',
        'Create and submit email-based orders directly',
        'View order history and spending trends',
      ],
      example: "Delegate ordering to your team lead. Track what's been ordered and what you've spent this quarter.",
    },
    previewTagline: 'Streamline your supply chain.',
  },

  'equipment-maintenance': {
    id: 'equipment-maintenance',
    name: 'Equipment Maintenance',
    shortName: 'Equipment',
    route: '/equipment-maintenance',
    tabs: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'equipment', label: 'Equipment' },
    ],
    iconKey: 'Wrench',
    category: 'Maintenance',
    mobilePriority: 4,
    minRole: 'employee',
    labelKey: 'equipment',
    commandLabel: 'Equipment',
    commandKeywords: ['maintenance', 'repair', 'machine'],
    showcase: {
      title: 'Equipment Maintenance',
      description: 'Schedule and track equipment maintenance with reminders and history.',
      iconKey: 'Wrench',
      price: '$29/mo',
      features: [
        'Catalog all equipment with specs',
        'Schedule preventive maintenance tasks',
        'Log maintenance history and costs',
        'Get reminders for upcoming service',
        'Track warranty status and expiration dates',
      ],
      example: 'Set up your equipment once, get reminded automatically when maintenance is due, and log each service.',
    },
    previewTagline: 'Never miss a maintenance window.',
  },

  'admin-tasks': {
    id: 'admin-tasks',
    name: 'Admin Tasks',
    shortName: 'Tasks',
    route: '/admin-tasks',
    iconKey: 'ListTodo',
    category: 'Scheduling',
    mobilePriority: 6,
    minRole: 'manager',
    labelKey: 'task',
    commandLabel: 'Tasks',
    commandKeywords: ['todo', 'checklist', 'assign'],
    showcase: {
      title: 'Administrative Tasks',
      description: 'Task management with delegation, recurring tasks, and team collaboration.',
      iconKey: 'ClipboardList',
      price: '$29/mo',
      features: [
        'Create tasks with priorities and due dates',
        'Assign tasks to team members',
        'Set up recurring tasks (daily, weekly, monthly)',
        'Track completion and add comments',
      ],
      example: 'Create a recurring task for annual certifications. Track completion and add notes as needed.',
    },
    previewTagline: 'Delegate, track, and get things done.',
  },

  'calendar-workforce': {
    id: 'calendar-workforce',
    name: 'Personnel',
    shortName: 'Personnel',
    route: '/calendar-workforce',
    tabs: [
      { id: 'schedule', label: 'Schedule' },
      { id: 'time-off', label: 'Time Off' },
      { id: 'time-clock', label: 'Time Clock' },
      { id: 'export', label: 'Export' },
    ],
    iconKey: 'CalendarDays',
    category: 'Scheduling',
    mobilePriority: 5,
    minRole: 'employee',
    labelKey: '',
    staticLabel: 'Personnel',
    commandLabel: 'Personnel',
    commandKeywords: ['schedule', 'shifts', 'time off', 'clock', 'personnel', 'calendar'],
    showcase: null, // Internal module — not shown publicly
  },

  'reporting': {
    id: 'reporting',
    name: 'Reporting',
    shortName: 'Reports',
    route: '/reporting',
    iconKey: 'BarChart3',
    category: 'Analytics',
    mobilePriority: 8,
    minRole: 'lead',
    labelKey: '',
    staticLabel: 'Reporting',
    commandLabel: 'Reporting',
    commandKeywords: ['reports', 'analytics', 'statistics', 'revenue', 'charts'],
    showcase: null, // Not yet on landing page
  },

  'document-library': {
    id: 'document-library',
    name: 'Document Library',
    shortName: 'Documents',
    route: '/document-library',
    iconKey: 'FileText',
    category: 'Resources',
    mobilePriority: 9,
    minRole: 'employee',
    labelKey: '',
    staticLabel: 'Documents',
    commandLabel: 'Documents',
    commandKeywords: ['documents', 'files', 'policies', 'procedures'],
    showcase: null, // TODO: add showcase data when ready for landing page
  },
};

// =====================================================
// Helpers
// =====================================================

/** Get the Lucide icon component for a module's nav icon */
export function getModuleIcon(id: ModuleId): LucideIcon {
  return resolveIcon(MODULE_REGISTRY[id].iconKey);
}

/** Get the showcase icon (may differ from nav icon, e.g. PiggyBank vs Receipt) */
export function getModuleShowcaseIcon(id: ModuleId): LucideIcon {
  const showcase = MODULE_REGISTRY[id].showcase;
  return showcase ? resolveIcon(showcase.iconKey) : getModuleIcon(id);
}

/** Get route for a module */
export function getModuleRoute(id: ModuleId): string {
  return MODULE_REGISTRY[id].route;
}

/** Get all module IDs */
export function getAllModuleIds(): ModuleId[] {
  return [...MODULE_IDS];
}

/** Get modules that have showcase data (for landing page) */
export function getShowcaseModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(
    (m): m is ModuleDefinition & { showcase: ModuleShowcaseData } => m.showcase !== null
  );
}

/** Get the count of modules with showcase data (for "All N included" text) */
export function getPublicModuleCount(): number {
  return getShowcaseModules().length;
}

/** Get modules grouped by category (for sidebar) */
export function getModulesByCategory(): { label: string; modules: ModuleId[] }[] {
  const categoryOrder = ['Operations', 'Kitchen', 'Scheduling', 'Maintenance', 'Analytics', 'Resources'];
  const grouped = new Map<string, ModuleId[]>();

  for (const mod of Object.values(MODULE_REGISTRY)) {
    if (!grouped.has(mod.category)) grouped.set(mod.category, []);
    grouped.get(mod.category)!.push(mod.id);
  }

  return categoryOrder
    .filter(cat => grouped.has(cat))
    .map(cat => ({ label: cat, modules: grouped.get(cat)! }));
}

/** Get modules sorted by mobile priority */
export function getMobileModulePriority(): ModuleId[] {
  return Object.values(MODULE_REGISTRY)
    .sort((a, b) => a.mobilePriority - b.mobilePriority)
    .map(m => m.id);
}
