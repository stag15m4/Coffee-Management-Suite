import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  badge?: string;
  align?: 'left' | 'center';
  theme?: 'light' | 'dark';
}

export default function SectionHeading({
  title,
  subtitle,
  badge,
  align = 'center',
  theme = 'light',
}: SectionHeadingProps) {
  const isCenter = align === 'center';
  const isDark = theme === 'dark';

  return (
    <div className={cn(isCenter && 'text-center', 'mb-12 md:mb-16')}>
      {badge && (
        <span
          className={cn(
            'text-overline inline-block mb-4',
            'bg-caramel-400/10 text-caramel-400',
            'px-4 py-1.5 rounded-full'
          )}
        >
          {badge}
        </span>
      )}
      <h2 className={cn('text-h2', isDark ? 'text-cream-50' : 'text-espresso-900')}>{title}</h2>
      {subtitle && (
        <p
          className={cn(
            'text-body-lg mt-4 max-w-2xl',
            isDark ? 'text-cream-400' : 'text-espresso-600',
            isCenter && 'mx-auto'
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
