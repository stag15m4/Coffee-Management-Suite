/**
 * Changelog entries for the "What's New" feature review system.
 * Add new entries at the top — newest first.
 * Each entry has a unique `id` used for voting/feedback tracking.
 *
 * `tryIt` makes the entry clickable: navigates to the page and
 * optionally spotlights a specific element via data-spotlight attribute.
 */

export interface ChangelogEntry {
  id: string;
  date: string; // ISO date
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix';
  tryIt?: {
    href: string; // route to navigate to
    spotlight?: string; // data-spotlight attribute value to highlight
    hint?: string; // tooltip text shown on the spotlight
  };
}

/** Bump this when adding entries so the badge appears for users */
export const CHANGELOG_VERSION = '2025-02-11b';

export const changelog: ChangelogEntry[] = [
  {
    id: 'vendor-save-fix',
    date: '2025-02-11',
    title: 'Vendor Save Fix',
    description: 'Fixed an issue where saving a new vendor profile would silently fail. Vendors now save correctly with success/error feedback.',
    category: 'fix',
    tryIt: {
      href: '/recipe-costing?tab=vendors',
      hint: 'Try adding a new vendor',
    },
  },
  {
    id: 'reporting-module',
    date: '2025-02-11',
    title: 'Reporting & Analytics Module',
    description: 'New reporting dashboard with revenue trends, cash accuracy, tip distribution, and task overview charts.',
    category: 'feature',
    tryIt: { href: '/reporting', hint: 'Explore the new analytics dashboard' },
  },
  {
    id: 'sheet-edit-pattern',
    date: '2025-02-11',
    title: 'Improved Edit Drawers',
    description: 'Edit forms for Ingredients, Users, and Locations now slide in from the side instead of blocking modals.',
    category: 'improvement',
    tryIt: {
      href: '/recipe-costing?tab=ingredients',
      spotlight: 'ingredient-row',
      hint: 'Click any ingredient row to open the new side drawer',
    },
  },
  {
    id: 'ingredients-column-toggle',
    date: '2025-02-11',
    title: 'Ingredients Column Toggle',
    description: 'Hide or show extra columns (Cost/Unit, Usage Unit, Vendor) in the Ingredients table to reduce clutter.',
    category: 'improvement',
    tryIt: {
      href: '/recipe-costing?tab=ingredients',
      spotlight: 'column-toggle',
      hint: 'Click to show or hide extra columns',
    },
  },
  {
    id: 'command-palette',
    date: '2025-02-10',
    title: 'Command Palette (Cmd+K)',
    description: 'Quick search and navigation. Press Cmd+K (or Ctrl+K) to jump to any page or module instantly.',
    category: 'feature',
    tryIt: {
      href: '/',
      spotlight: 'search-trigger',
      hint: 'Click here or press Cmd+K to open the command palette',
    },
  },
  {
    id: 'keyboard-shortcuts',
    date: '2025-02-10',
    title: 'Keyboard Shortcuts',
    description: 'Press G then D for Dashboard, G then T for Tasks, G then C for Calendar, G then R for Recipe Costing.',
    category: 'feature',
  },
  {
    id: 'recipe-costing-tabs-split',
    date: '2025-02-10',
    title: 'Recipe Costing Tab Reorganization',
    description: 'Overhead calculator now has its own dedicated tab. Each tab loads independently for faster navigation.',
    category: 'improvement',
    tryIt: {
      href: '/recipe-costing?tab=overhead',
      spotlight: 'overhead-tab',
      hint: 'Overhead now has its own dedicated tab',
    },
  },
  {
    id: 'revenue-overhead-comparison',
    date: '2025-02-10',
    title: 'Revenue vs Overhead Chart',
    description: 'Recipe Costing overhead tab now shows daily revenue compared to overhead costs, helping you spot profitability at a glance.',
    category: 'feature',
    tryIt: {
      href: '/recipe-costing?tab=overhead',
      spotlight: 'revenue-chart',
      hint: 'Daily revenue vs overhead comparison',
    },
  },
  {
    id: 'vendor-profiles',
    date: '2025-02-10',
    title: 'Vendor Profiles',
    description: 'Ingredients can be linked to vendors with contact info, rep names, and notes.',
    category: 'feature',
    tryIt: {
      href: '/recipe-costing?tab=vendors',
      hint: 'Manage vendor profiles and link them to ingredients',
    },
  },
  {
    id: 'empty-states',
    date: '2025-02-10',
    title: 'Empty States & Guidance',
    description: 'Modules now show helpful guidance and quick-start actions when no data exists yet.',
    category: 'improvement',
  },
  {
    id: 'task-images',
    date: '2025-02-10',
    title: 'Task Images',
    description: 'Attach photos to tasks for visual context — useful for maintenance issues and documentation.',
    category: 'feature',
    tryIt: {
      href: '/admin-tasks',
      spotlight: 'task-attachment',
      hint: 'Attach images when creating or editing a task',
    },
  },
  {
    id: 'cash-outlier-exclusion',
    date: '2025-02-10',
    title: 'Cash Deposit Outlier Exclusion',
    description: 'Exclude unusual deposits from variance calculations to get a more accurate picture of cash accuracy.',
    category: 'feature',
    tryIt: {
      href: '/cash-deposit',
      spotlight: 'outlier-toggle',
      hint: 'Click any deposit row to mark it as an outlier',
    },
  },
  {
    id: 'sidebar-redesign',
    date: '2025-02-09',
    title: 'Sidebar Redesign',
    description: 'Categorized navigation, search trigger, consistent color palette, and mobile-responsive layout.',
    category: 'improvement',
  },
  {
    id: 'personal-dashboard',
    date: '2025-02-09',
    title: 'Personal Dashboard Card',
    description: 'Clock in/out widget and your weekly schedule right on the dashboard.',
    category: 'feature',
    tryIt: {
      href: '/',
      spotlight: 'my-dashboard-card',
      hint: 'Your personal clock in/out and weekly schedule',
    },
  },
  {
    id: 'calendar-workforce',
    date: '2025-02-09',
    title: 'Calendar & Workforce Module',
    description: 'Full scheduling, time-off requests, and time clock tracking with employee avatars on shifts.',
    category: 'feature',
    tryIt: {
      href: '/calendar-workforce',
      hint: 'Manage schedules, time-off, and time clock',
    },
  },
];
