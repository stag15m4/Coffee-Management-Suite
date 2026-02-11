/**
 * Canonical coffee palette — single source of truth.
 * Import as: import { colors } from '@/lib/colors';
 */
export const colors = {
  // Core brand
  gold: '#C9A227',
  goldLight: '#D4B23A',
  goldDark: '#B8941F',

  // Browns
  brown: '#4A3728',
  brownLight: '#6B5344',

  // Creams / backgrounds
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
  inputBg: '#FDF8E8',

  // Semantic / status
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  orange: '#f97316',
  blue: '#3b82f6',
} as const;

export type Colors = typeof colors;
