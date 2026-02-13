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
// Pizza SVG — pizza on a pan with a rocking cutter and steam
// ---------------------------------------------------------------------------

function PizzaSvg({ s, primary }: { s: number; primary: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none" role="img" aria-label="Loading">
      {/* Pizza pan */}
      <ellipse cx="38" cy="66" rx="28" ry="5" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1" />

      {/* Pizza body */}
      <circle cx="38" cy="38" r="24" fill="#F5D076" />

      {/* Crust ring */}
      <circle cx="38" cy="38" r="24" fill="none" stroke="#C8943F" strokeWidth="3" />

      {/* Sauce layer (peeking through) */}
      <circle cx="38" cy="38" r="20" fill={primary} opacity="0.2" />

      {/* Cheese */}
      <circle cx="38" cy="38" r="20" fill="#F5D076" opacity="0.6" />

      {/* Slice lines */}
      <line x1="38" y1="14" x2="38" y2="62" stroke="#E8C94A" strokeWidth="0.8" opacity="0.4" />
      <line x1="14" y1="38" x2="62" y2="38" stroke="#E8C94A" strokeWidth="0.8" opacity="0.4" />
      <line x1="21" y1="21" x2="55" y2="55" stroke="#E8C94A" strokeWidth="0.8" opacity="0.4" />
      <line x1="55" y1="21" x2="21" y2="55" stroke="#E8C94A" strokeWidth="0.8" opacity="0.4" />

      {/* Pepperoni */}
      <circle cx="30" cy="28" r="3.5" fill={primary} />
      <circle cx="46" cy="30" r="3" fill={primary} />
      <circle cx="48" cy="46" r="3.5" fill={primary} />
      <circle cx="32" cy="48" r="3" fill={primary} />
      <circle cx="24" cy="40" r="3.5" fill={primary} />

      {/* Basil leaves */}
      <ellipse cx="38" cy="34" rx="2.5" ry="1" fill="#4CAF50" transform="rotate(-30 38 34)" />
      <ellipse cx="42" cy="43" rx="2.5" ry="1" fill="#4CAF50" transform="rotate(20 42 43)" />

      {/* Pizza cutter — rocks gently like the coffee spoon */}
      <g className="pizza-loader-cut" style={{ transformOrigin: '38px 38px' }}>
        {/* Handle */}
        <line x1="38" y1="38" x2="56" y2="16" stroke="#9E9E9E" strokeWidth="2.2" strokeLinecap="round" />
        {/* Circular blade */}
        <circle cx="58" cy="14" r="4.5" fill="none" stroke="#BDBDBD" strokeWidth="2" />
        {/* Grip knob */}
        <circle cx="60" cy="11" r="2" fill="#757575" />
      </g>

      {/* Steam wisps */}
      <path className="pizza-loader-steam-1" d="M 30 12 Q 28 6 30 0" stroke={primary} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
      <path className="pizza-loader-steam-2" d="M 38 10 Q 40 4 38 -2" stroke={primary} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
      <path className="pizza-loader-steam-3" d="M 46 12 Q 48 6 46 0" stroke={primary} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0" />
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
    svgElement = <PizzaSvg s={s} primary={themeColors.primary} />;
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
