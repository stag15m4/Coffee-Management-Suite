/**
 * Changelog entries for the "What's New" feature review system.
 * Add new entries at the top — newest first.
 * Each entry has a unique `id` used for voting/feedback tracking.
 */

export interface ChangelogEntry {
  id: string;
  date: string; // ISO date
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'fix';
}

/** Bump this when adding entries so the badge appears for users */
export const CHANGELOG_VERSION = '2025-02-11';

export const changelog: ChangelogEntry[] = [
  {
    id: 'reporting-module',
    date: '2025-02-11',
    title: 'Reporting & Analytics Module',
    description: 'New reporting dashboard with revenue trends, cash accuracy, tip distribution, and task overview charts.',
    category: 'feature',
  },
  {
    id: 'sheet-edit-pattern',
    date: '2025-02-11',
    title: 'Improved Edit Drawers',
    description: 'Edit forms for Ingredients, Users, and Locations now slide in from the side instead of blocking modals.',
    category: 'improvement',
  },
  {
    id: 'ingredients-column-toggle',
    date: '2025-02-11',
    title: 'Ingredients Column Toggle',
    description: 'Hide or show extra columns (Cost/Unit, Usage Unit, Vendor) in the Ingredients table to reduce clutter.',
    category: 'improvement',
  },
  {
    id: 'command-palette',
    date: '2025-02-10',
    title: 'Command Palette (Cmd+K)',
    description: 'Quick search and navigation. Press Cmd+K (or Ctrl+K) to jump to any page or module instantly.',
    category: 'feature',
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
  },
  {
    id: 'revenue-overhead-comparison',
    date: '2025-02-10',
    title: 'Revenue vs Overhead Chart',
    description: 'Dashboard now shows daily revenue compared to overhead costs, helping you spot profitability at a glance.',
    category: 'feature',
  },
  {
    id: 'vendor-profiles',
    date: '2025-02-10',
    title: 'Vendor Profiles',
    description: 'Ingredients can be linked to vendors with contact info, rep names, and notes.',
    category: 'feature',
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
  },
  {
    id: 'cash-outlier-exclusion',
    date: '2025-02-10',
    title: 'Cash Deposit Outlier Exclusion',
    description: 'Exclude unusual deposits from variance calculations to get a more accurate picture of cash accuracy.',
    category: 'feature',
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
  },
  {
    id: 'calendar-workforce',
    date: '2025-02-09',
    title: 'Calendar & Workforce Module',
    description: 'Full scheduling, time-off requests, and time clock tracking with employee avatars on shifts.',
    category: 'feature',
  },
];
