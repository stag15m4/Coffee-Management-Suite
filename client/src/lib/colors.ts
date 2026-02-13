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
  gold: 'var(--color-primary, #C9A227)',
  goldLight: 'var(--color-primary-light, #F5EDD0)',
  goldDark: 'var(--color-primary-dark, #B8941F)',

  // Browns — driven by vertical secondary
  brown: 'var(--color-secondary, #4A3728)',
  brownLight: 'var(--color-secondary-light, #6B5344)',

  // Creams / backgrounds — driven by vertical accent
  cream: 'var(--color-accent, #F5F0E1)',
  creamDark: 'var(--color-accent-dark, #E8E0CC)',
  white: 'var(--color-background, #FFFDF7)',
  inputBg: 'var(--color-input-bg, #FDF8E8)',

  // Semantic / status — not themed
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  orange: '#f97316',
  blue: '#3b82f6',
} as const;

export type Colors = typeof colors;
