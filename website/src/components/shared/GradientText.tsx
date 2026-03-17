import { cn } from '@/lib/utils';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4';
}

export default function GradientText({ children, className, as: Tag = 'span' }: GradientTextProps) {
  return (
    <Tag className={cn('bg-gradient-to-r from-caramel-400 to-copper-500 bg-clip-text text-transparent', className)}>
      {children}
    </Tag>
  );
}
