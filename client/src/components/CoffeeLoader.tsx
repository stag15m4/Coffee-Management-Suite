import { useState, useEffect } from 'react';
import { useVertical } from '@/contexts/VerticalContext';
import { useTheme } from '@/contexts/ThemeProvider';

interface CoffeeLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  progressiveTexts?: string[];
  fullScreen?: boolean;
}

const sizes = {
  sm: 48,
  md: 72,
  lg: 96,
};

const PROGRESS_INTERVAL = 5000;

// ---------------------------------------------------------------------------
// Vertical-specific progressive loading texts
// ---------------------------------------------------------------------------

const VERTICAL_TEXTS: Record<string, string[]> = {
  'coffee-shop': [
    'What can I get started for you?',
    'Grinding fresh beans...',
    'Brewing a fresh pot...',
    'Almost ready...',
  ],
  pizzeria: [
    'Kneading the dough...',
    'Tossing it in the air...',
    'Spreading the sauce...',
    'Adding the toppings...',
    'Into the oven...',
    'Almost ready...',
  ],
};

const DEFAULT_TEXTS = ['Loading...', 'Almost ready...'];

// ---------------------------------------------------------------------------
// Coffee SVG — cup with stirring spoon and steam
// ---------------------------------------------------------------------------

function CoffeeSvg({ s, primary, secondary }: { s: number; primary: string; secondary: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none" role="img" aria-label="Loading">
      {/* Saucer */}
      <ellipse cx="36" cy="68" rx="28" ry="5" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />

      {/* Cup body */}
      <path
        d="M 18 30 L 21 63 Q 36 68 51 63 L 54 30"
        fill="#FFFFFF"
        stroke="#D1D5DB"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Handle */}
      <path
        d="M 54 36 C 64 36 67 48 67 48 C 67 48 64 60 54 58"
        fill="none"
        stroke="#D1D5DB"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Cup rim */}
      <ellipse cx="36" cy="30" rx="18" ry="6.5" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1.2" />

      {/* Coffee surface */}
      <ellipse cx="36" cy="31" rx="15.5" ry="5" fill={secondary} />

      {/* Coffee highlight */}
      <ellipse cx="31" cy="30" rx="5" ry="2" fill={secondary} opacity="0.5" />

      {/* Spoon — rocks gently to simulate stirring */}
      <g className="coffee-loader-stir" style={{ transformOrigin: '36px 31px' }}>
        <line x1="36" y1="31" x2="52" y2="15" stroke={primary} strokeWidth="2.2" strokeLinecap="round" />
        <ellipse
          cx="53.5"
          cy="13.5"
          rx="3.2"
          ry="2"
          fill={primary}
          stroke={primary}
          strokeWidth="0.6"
          transform="rotate(-45 53.5 13.5)"
        />
      </g>

      {/* Steam wisps */}
      <path className="coffee-loader-steam-1" d="M 28 24 Q 26 18 28 12 Q 30 6 28 2" stroke={primary} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
      <path className="coffee-loader-steam-2" d="M 36 22 Q 38 16 36 10 Q 34 4 36 0" stroke={primary} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
      <path className="coffee-loader-steam-3" d="M 44 24 Q 46 18 44 12 Q 42 6 44 2" stroke={primary} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pizza SVG — whole pie with slices that pop out one at a time
// ---------------------------------------------------------------------------
// 6 slices of 60° each. Center (40,40), radius 26. Crust ring behind.
// Each slice is its own <g> with a CSS animation that slides it outward
// from center, then back. Pepperoni use hardcoded red (not theme) so they
// look correct before the vertical theme loads.

const PIZZA_SLICES = [
  // { path, dx, dy, pepperoni?, basil? }  — toppings positioned per-slice
  { d: 'M 40 40 L 40 14 A 26 26 0 0 1 62.5 27 Z', dx: 4, dy: -7, pep: { cx: 48, cy: 24, r: 3 } },
  { d: 'M 40 40 L 62.5 27 A 26 26 0 0 1 62.5 53 Z', dx: 8, dy: 0, pep: { cx: 56, cy: 40, r: 3.5 }, basil: { cx: 52, cy: 34, rot: -20 } },
  { d: 'M 40 40 L 62.5 53 A 26 26 0 0 1 40 66 Z', dx: 4, dy: 7, pep: { cx: 48, cy: 56, r: 3 } },
  { d: 'M 40 40 L 40 66 A 26 26 0 0 1 17.5 53 Z', dx: -4, dy: 7, pep: { cx: 32, cy: 56, r: 3.5 }, basil: { cx: 36, cy: 52, rot: 25 } },
  { d: 'M 40 40 L 17.5 53 A 26 26 0 0 1 17.5 27 Z', dx: -8, dy: 0, pep: { cx: 24, cy: 40, r: 3 } },
  { d: 'M 40 40 L 17.5 27 A 26 26 0 0 1 40 14 Z', dx: -4, dy: -7, pep: { cx: 32, cy: 24, r: 3.5 }, basil: { cx: 28, cy: 30, rot: -15 } },
];

function PizzaSvg({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none" role="img" aria-label="Loading">
      {/* Plate / surface */}
      <ellipse cx="40" cy="70" rx="26" ry="4" fill="#E5E7EB" />

      {/* Sauce circle (visible when slices pull away) */}
      <circle cx="40" cy="40" r="26" fill="#CD212A" opacity="0.15" />

      {/* Crust ring */}
      <circle cx="40" cy="40" r="26" fill="none" stroke="#C8943F" strokeWidth="4" />

      {/* 6 animated slices */}
      {PIZZA_SLICES.map((slice, i) => (
        <g
          key={i}
          className={`pizza-slice pizza-slice-${i}`}
          style={{ '--slice-dx': `${slice.dx}px`, '--slice-dy': `${slice.dy}px` } as React.CSSProperties}
        >
          {/* Cheese slice */}
          <path d={slice.d} fill="#F5D076" stroke="#E8C94A" strokeWidth="0.5" />
          {/* Pepperoni */}
          <circle cx={slice.pep.cx} cy={slice.pep.cy} r={slice.pep.r} fill="#CD212A" />
          {/* Basil leaf (on some slices) */}
          {slice.basil && (
            <ellipse
              cx={slice.basil.cx} cy={slice.basil.cy}
              rx="3" ry="1.2"
              fill="#388E3C"
              transform={`rotate(${slice.basil.rot} ${slice.basil.cx} ${slice.basil.cy})`}
            />
          )}
        </g>
      ))}

      {/* Steam wisps */}
      <path className="pizza-loader-steam-1" d="M 32 10 Q 30 4 32 -2" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
      <path className="pizza-loader-steam-2" d="M 40 8 Q 42 2 40 -4" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
      <path className="pizza-loader-steam-3" d="M 48 10 Q 50 4 48 -2" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Default SVG — neutral pulsing circle, no vertical branding
// ---------------------------------------------------------------------------

function DefaultSvg({ s, primary }: { s: number; primary: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none" role="img" aria-label="Loading">
      {/* Outer ring — rotates */}
      <circle
        cx="40" cy="40" r="30"
        stroke="#E5E7EB"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M 40 10 A 30 30 0 0 1 70 40"
        stroke={primary}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        className="default-loader-spin"
        style={{ transformOrigin: '40px 40px' }}
      />
      {/* Center dot */}
      <circle cx="40" cy="40" r="4" fill={primary} className="default-loader-pulse" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main loader component — auto-detects vertical for SVG and texts
// ---------------------------------------------------------------------------

export function CoffeeLoader({ size = 'md', text, progressiveTexts, fullScreen = false }: CoffeeLoaderProps) {
  const { vertical } = useVertical();
  const { colors: themeColors } = useTheme();

  const s = sizes[size];
  const [textIndex, setTextIndex] = useState(0);

  // Auto-detect from vertical, fall back to cached slug from last session.
  // null = no context yet (show neutral loader)
  const cachedSlug = typeof localStorage !== 'undefined' ? localStorage.getItem('vertical_slug') : null;
  const slug = vertical?.slug ?? cachedSlug;

  // Use explicit texts, or fall back to vertical-specific texts for fullScreen
  const resolvedTexts = progressiveTexts ?? (fullScreen ? (slug ? (VERTICAL_TEXTS[slug] ?? DEFAULT_TEXTS) : DEFAULT_TEXTS) : undefined);
  const safeIndex = resolvedTexts ? textIndex % resolvedTexts.length : 0;
  const displayText = resolvedTexts ? resolvedTexts[safeIndex] : text;

  useEffect(() => {
    setTextIndex(0);
    if (!resolvedTexts || resolvedTexts.length <= 1) return;
    const timer = setInterval(() => {
      setTextIndex((i) => (i + 1) % resolvedTexts.length);
    }, PROGRESS_INTERVAL);
    return () => clearInterval(timer);
  }, [resolvedTexts]);

  // Pick SVG variant based on vertical — neutral spinner when unknown
  let svgElement: React.ReactNode;
  if (slug === 'pizzeria') {
    svgElement = <PizzaSvg s={s} />;
  } else if (slug === 'coffee-shop') {
    svgElement = <CoffeeSvg s={s} primary={themeColors.primary} secondary={themeColors.secondary} />;
  } else {
    svgElement = <DefaultSvg s={s} primary={themeColors.primary} />;
  }

  const loader = (
    <div className="flex flex-col items-center justify-center gap-3">
      {svgElement}
      {displayText && (
        <p className="text-sm font-medium" style={{ color: themeColors.secondary }}>
          {displayText}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: themeColors.background }}
      >
        {loader}
      </div>
    );
  }

  return loader;
}
