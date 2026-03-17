'use client';

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  variant?: 'light' | 'dark' | 'elevated';
  hover?: boolean;
  glow?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<NonNullable<CardProps['variant']>, string> = {
  light: 'bg-white border border-cream-300 shadow-sm',
  dark: 'bg-espresso-800 border border-espresso-700',
  elevated: 'bg-white border-none shadow-lg',
};

const paddingStyles: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8 md:p-10',
};

export default function Card({
  variant = 'light',
  hover = false,
  glow = false,
  padding = 'md',
  children,
  className,
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!glow || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      cardRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      cardRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    },
    [glow]
  );

  return (
    <div
      ref={cardRef}
      onMouseMove={glow ? handleMouseMove : undefined}
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-lg)]',
        'transition-all duration-300',
        variantStyles[variant],
        paddingStyles[padding],
        hover && 'hover:-translate-y-1 hover:shadow-xl hover:border-caramel-300 cursor-pointer',
        className
      )}
    >
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 hidden md:block"
          style={{
            background:
              'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(245,166,35,0.06), transparent 40%)',
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
