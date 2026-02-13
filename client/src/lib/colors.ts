/**
 * Dynamic palette — maps to CSS custom properties set by ThemeProvider.
 * When a vertical (e.g. Pizzeria) is active, ThemeProvider overwrites
 * these CSS vars so every component that uses `colors.*` gets the
 * vertical's palette automatically.
 *
 * Import as: import { colors } from '@/lib/colors';
 */
export const colors = {
  // Core brand — driven by vertical theme
  gold: 'var(--color-primary, #2563EB)',
  goldLight: 'var(--color-primary-light, #EFF6FF)',
  goldDark: 'var(--color-primary-dark, #1D4ED8)',

  // Text — driven by vertical secondary
  brown: 'var(--color-secondary, #111827)',
  brownLight: 'var(--color-secondary-light, #6B7280)',

  // Surfaces / backgrounds — driven by vertical accent
  cream: 'var(--color-accent, #F9FAFB)',
  creamDark: 'var(--color-accent-dark, #E5E7EB)',
  white: 'var(--color-background, #FFFFFF)',
  inputBg: 'var(--color-input-bg, #F9FAFB)',

  // Semantic / status — not themed
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  orange: '#f97316',
  blue: '#3b82f6',
} as const;

export type Colors = typeof colors;
