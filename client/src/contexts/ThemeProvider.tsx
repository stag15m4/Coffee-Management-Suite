import { createContext, useContext, useEffect, useMemo } from 'react';
import { useVertical } from '@/contexts/VerticalContext';
import { useAuth } from '@/contexts/AuthContext';
// Raw hex fallbacks — used as defaults before any vertical/branding is loaded.
// These must be raw hex, NOT the CSS-var-based `colors` from @/lib/colors,
// because ThemeProvider sets these as CSS custom-property values.
const RAW = {
  gold: '#C9A227',
  goldLight: '#F5EDD0',
  goldDark: '#B8941F',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F5F5',
  creamDark: '#E5E7EB',
  white: '#FFFFFF',
  inputBg: '#F9FAFB',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  accent: string;
  accentDark: string;
  background: string;
  inputBg: string;
}

export interface ThemeMeta {
  logoUrl: string | null;
  companyName: string | null;
  iconEmoji: string;
  loadingText: string;
}

export interface ThemeContextType {
  colors: ThemeColors;
  meta: ThemeMeta;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp an integer to the 0-255 range.
 */
function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Parse a hex color string (#RGB or #RRGGBB) into [r, g, b].
 */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Convert [r, g, b] back to a hex string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => clamp(c).toString(16).padStart(2, '0')).join('');
}

/**
 * Lighten a hex color by a given percentage (0-1). Moves each channel
 * toward 255 by that fraction of the remaining distance.
 */
function lighten(hex: string, amount = 0.1): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

/**
 * Darken a hex color by a given percentage (0-1). Moves each channel
 * toward 0 by that fraction.
 */
function darken(hex: string, amount = 0.1): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r * (1 - amount),
    g * (1 - amount),
    b * (1 - amount),
  );
}

// ---------------------------------------------------------------------------
// Defaults (from the hardcoded colors palette)
// ---------------------------------------------------------------------------

const DEFAULT_COLORS: ThemeColors = {
  primary: RAW.gold,
  primaryLight: RAW.goldLight,
  primaryDark: RAW.goldDark,
  secondary: RAW.brown,
  secondaryLight: RAW.brownLight,
  accent: RAW.cream,
  accentDark: RAW.creamDark,
  background: RAW.white,
  inputBg: RAW.inputBg,
};

const DEFAULT_META: ThemeMeta = {
  logoUrl: null,
  companyName: null,
  iconEmoji: '',
  loadingText: 'Loading...',
};

// ---------------------------------------------------------------------------
// CSS custom property names mapped to ThemeColors keys
// ---------------------------------------------------------------------------

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  primary: '--color-primary',
  primaryLight: '--color-primary-light',
  primaryDark: '--color-primary-dark',
  secondary: '--color-secondary',
  secondaryLight: '--color-secondary-light',
  accent: '--color-accent',
  accentDark: '--color-accent-dark',
  background: '--color-background',
  inputBg: '--color-input-bg',
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { vertical } = useVertical();
  const { branding } = useAuth();

  // -------------------------------------------------------------------------
  // Resolve colors: tenant branding > vertical theme > hardcoded defaults
  // -------------------------------------------------------------------------
  const resolvedColors = useMemo<ThemeColors>(() => {
    // Start with defaults
    const result = { ...DEFAULT_COLORS };

    // Layer 1: vertical theme overrides
    if (vertical?.theme) {
      const vt = vertical.theme;
      if (vt.primaryColor) {
        result.primary = vt.primaryColor;
        result.primaryLight = lighten(vt.primaryColor, 0.82);
        result.primaryDark = darken(vt.primaryColor);
      }
      if (vt.secondaryColor) {
        result.secondary = vt.secondaryColor;
        result.secondaryLight = lighten(vt.secondaryColor, 0.3);
      }
      if (vt.accentColor) {
        result.accent = vt.accentColor;
        result.accentDark = darken(vt.accentColor);
      }
      if (vt.backgroundColor) {
        result.background = vt.backgroundColor;
      }
    }

    // Layer 2: tenant branding overrides (highest priority)
    if (branding) {
      if (branding.primary_color) {
        result.primary = branding.primary_color;
        result.primaryLight = lighten(branding.primary_color, 0.82);
        result.primaryDark = darken(branding.primary_color);
      }
      if (branding.secondary_color) {
        result.secondary = branding.secondary_color;
        result.secondaryLight = lighten(branding.secondary_color, 0.3);
      }
      if (branding.accent_color) {
        result.accent = branding.accent_color;
        result.accentDark = darken(branding.accent_color);
      }
      if (branding.background_color) {
        result.background = branding.background_color;
      }
    }

    return result;
  }, [vertical, branding]);

  // -------------------------------------------------------------------------
  // Resolve metadata: tenant branding > vertical theme > defaults
  // -------------------------------------------------------------------------
  const resolvedMeta = useMemo<ThemeMeta>(() => {
    const result = { ...DEFAULT_META };

    if (vertical?.theme) {
      if (vertical.theme.logoUrl) result.logoUrl = vertical.theme.logoUrl;
      if (vertical.theme.iconEmoji) result.iconEmoji = vertical.theme.iconEmoji;
      if (vertical.theme.loadingText) result.loadingText = vertical.theme.loadingText;
    }

    if (branding) {
      if (branding.logo_url) result.logoUrl = branding.logo_url;
      if (branding.company_name) result.companyName = branding.company_name;
    }

    return result;
  }, [vertical, branding]);

  // -------------------------------------------------------------------------
  // Apply CSS custom properties to document root
  // -------------------------------------------------------------------------
  useEffect(() => {
    const root = document.documentElement.style;
    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
      root.setProperty(cssVar, resolvedColors[key as keyof ThemeColors]);
    }
  }, [resolvedColors]);

  const value = useMemo<ThemeContextType>(
    () => ({ colors: resolvedColors, meta: resolvedMeta }),
    [resolvedColors, resolvedMeta],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the full theme context: resolved colors and metadata.
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Returns just the resolved color values as a plain object.
 * Useful for components that need direct color values rather than CSS vars.
 */
export function useThemeColors(): ThemeColors {
  const { colors: themeColors } = useTheme();
  return themeColors;
}
