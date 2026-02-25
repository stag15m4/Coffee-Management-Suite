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
  gold: 'var(--color-primary, #334155)',
  goldLight: 'var(--color-primary-light, #F1F5F9)',
  goldDark: 'var(--color-primary-dark, #1E293B)',

  // Text — driven by vertical secondary
  brown: 'var(--color-secondary, #0F172A)',
  brownLight: 'var(--color-secondary-light, #64748B)',

  // Surfaces / backgrounds — driven by vertical accent
  cream: 'var(--color-accent, #F1F5F9)',
  creamDark: 'var(--color-accent-dark, #CBD5E1)',
  white: 'var(--color-background, #FFFFFF)',
  inputBg: 'var(--color-input-bg, #F8FAFC)',

  // Semantic / status — not themed
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  orange: '#f97316',
  blue: '#3b82f6',
} as const;

export type Colors = typeof colors;
