import { cn } from '@/lib/utils';

interface DividerProps {
  variant?: 'wave' | 'angle' | 'straight';
  from?: 'light' | 'dark';
  to?: 'light' | 'dark';
  className?: string;
}

const bgColor = {
  light: 'var(--color-cream-50)',
  dark: 'var(--color-espresso-900)',
} as const;

function WaveDivider({ from, to }: { from: string; to: string }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      className="block w-full h-[60px] md:h-[80px]"
    >
      <rect width="1440" height="80" fill={from} />
      <path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z" fill={to} />
    </svg>
  );
}

function AngleDivider({ from, to }: { from: string; to: string }) {
  return (
    <div className="relative h-[60px] md:h-[80px]" style={{ backgroundColor: from }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: to,
          clipPath: 'polygon(0 100%, 100% 0, 100% 100%)',
        }}
      />
    </div>
  );
}

function StraightDivider({ from }: { from: 'light' | 'dark' }) {
  return <div className={cn('h-px w-full', from === 'light' ? 'bg-cream-300' : 'bg-espresso-700')} />;
}

export default function Divider({ variant = 'straight', from = 'light', to = 'dark', className }: DividerProps) {
  return (
    <div className={cn('w-full overflow-hidden', className)} aria-hidden="true">
      {variant === 'wave' && <WaveDivider from={bgColor[from]} to={bgColor[to]} />}
      {variant === 'angle' && <AngleDivider from={bgColor[from]} to={bgColor[to]} />}
      {variant === 'straight' && <StraightDivider from={from} />}
    </div>
  );
}
