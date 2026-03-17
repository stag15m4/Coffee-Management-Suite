import { cn } from '@/lib/utils';
import Container from './Container';

interface SectionProps {
  bg?: 'light' | 'dark' | 'gradient';
  padding?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  id?: string;
}

const bgStyles: Record<NonNullable<SectionProps['bg']>, string> = {
  light: 'bg-cream-50',
  dark: 'bg-espresso-900',
  gradient: 'bg-gradient-to-br from-caramel-200 via-caramel-300 to-copper-400',
};

const paddingStyles: Record<NonNullable<SectionProps['padding']>, string> = {
  sm: 'py-16',
  md: 'py-24',
  lg: 'py-32',
};

export default function Section({ bg = 'light', padding = 'md', children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn(bgStyles[bg], paddingStyles[padding], className)}>
      <Container>{children}</Container>
    </section>
  );
}
