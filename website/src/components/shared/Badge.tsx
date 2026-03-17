import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'popular' | 'new' | 'coming-soon';
  className?: string;
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-caramel-400/10 text-caramel-400',
  popular: 'bg-caramel-400 text-espresso-950',
  new: 'bg-sage-400 text-espresso-950',
  'coming-soon': 'bg-espresso-700 text-cream-400',
};

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center',
        'text-xs font-semibold px-3 py-1 rounded-full',
        'uppercase tracking-wide',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
