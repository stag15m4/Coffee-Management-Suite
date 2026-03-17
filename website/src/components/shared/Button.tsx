'use client';

import { cn } from '@/lib/utils';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'text';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: cn(
    'bg-caramel-400 text-espresso-950',
    'hover:bg-caramel-500 hover:scale-[1.02] hover:shadow-lg',
    'active:scale-[0.98]'
  ),
  secondary: cn(
    'bg-transparent border border-cream-300 text-espresso-900',
    'hover:bg-cream-100',
    'active:bg-cream-200'
  ),
  ghost: cn('bg-transparent text-caramel-400', 'hover:underline underline-offset-4'),
  text: cn('bg-transparent text-espresso-600', 'hover:text-espresso-900'),
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

function Spinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  href,
  onClick,
  icon,
  loading = false,
  fullWidth = false,
  className,
  type = 'button',
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center',
    'font-general font-semibold rounded-full',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-caramel-400 focus:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && 'w-full',
    'group',
    className
  );

  const content = (
    <>
      {loading && <Spinner />}
      <span>{children}</span>
      {icon && !loading && (
        <span className="ml-2 inline-flex transition-transform duration-200 group-hover:translate-x-1">{icon}</span>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} onClick={loading ? undefined : onClick} disabled={loading} className={classes}>
      {content}
    </button>
  );
}
