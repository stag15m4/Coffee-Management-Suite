import { useState, useEffect } from 'react';

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

export function CoffeeLoader({ size = 'md', text, progressiveTexts, fullScreen = false }: CoffeeLoaderProps) {
  const s = sizes[size];
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    if (!progressiveTexts || progressiveTexts.length <= 1) return;
    const timer = setInterval(() => {
      setTextIndex(i => (i + 1) % progressiveTexts.length);
    }, PROGRESS_INTERVAL);
    return () => clearInterval(timer);
  }, [progressiveTexts]);

  const displayText = progressiveTexts ? progressiveTexts[textIndex] : text;

  const loader = (
    <div className="flex flex-col items-center justify-center gap-3">
      <svg
        width={s}
        height={s}
        viewBox="0 0 80 80"
        fill="none"
        role="img"
        aria-label="Loading"
      >
        {/* Saucer */}
        <ellipse cx="36" cy="68" rx="28" ry="5" fill="#E8E0CC" stroke="#D4C9A8" strokeWidth="1" />

        {/* Cup body */}
        <path
          d="M 18 30 L 21 63 Q 36 68 51 63 L 54 30"
          fill="#FFFDF7"
          stroke="#D4C9A8"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Handle */}
        <path
          d="M 54 36 C 64 36 67 48 67 48 C 67 48 64 60 54 58"
          fill="none"
          stroke="#D4C9A8"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Cup rim (back edge) */}
        <ellipse cx="36" cy="30" rx="18" ry="6.5" fill="#FFFDF7" stroke="#D4C9A8" strokeWidth="1.2" />

        {/* Coffee surface */}
        <ellipse cx="36" cy="31" rx="15.5" ry="5" fill="#5C3D2E" />

        {/* Coffee highlight */}
        <ellipse cx="31" cy="30" rx="5" ry="2" fill="#7A5440" opacity="0.5" />

        {/* Spoon — rocks gently to simulate stirring */}
        <g className="coffee-loader-stir" style={{ transformOrigin: '36px 31px' }}>
          <line
            x1="36" y1="31"
            x2="52" y2="15"
            stroke="#C9A227"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <ellipse
            cx="53.5" cy="13.5"
            rx="3.2" ry="2"
            fill="#C9A227"
            stroke="#B8911F"
            strokeWidth="0.6"
            transform="rotate(-45 53.5 13.5)"
          />
        </g>

        {/* Steam wisps */}
        <path
          className="coffee-loader-steam-1"
          d="M 28 24 Q 26 18 28 12 Q 30 6 28 2"
          stroke="#C9A227"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0"
        />
        <path
          className="coffee-loader-steam-2"
          d="M 36 22 Q 38 16 36 10 Q 34 4 36 0"
          stroke="#C9A227"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0"
        />
        <path
          className="coffee-loader-steam-3"
          d="M 44 24 Q 46 18 44 12 Q 42 6 44 2"
          stroke="#C9A227"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0"
        />
      </svg>
      {displayText && (
        <p className="text-sm font-medium" style={{ color: '#4A3728' }}>
          {displayText}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F5F0E1' }}
      >
        {loader}
      </div>
    );
  }

  return loader;
}
