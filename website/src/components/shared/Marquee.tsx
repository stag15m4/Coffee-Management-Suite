'use client';

import { cn } from '@/lib/utils';

interface MarqueeProps {
  children: React.ReactNode;
  speed?: number;
  pauseOnHover?: boolean;
  className?: string;
  direction?: 'left' | 'right';
}

export default function Marquee({
  children,
  speed = 30,
  pauseOnHover = true,
  className,
  direction = 'left',
}: MarqueeProps) {
  return (
    <div className={cn('overflow-hidden', className)} aria-hidden="true">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marquee-left {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }
            @keyframes marquee-right {
              from { transform: translateX(-50%); }
              to { transform: translateX(0); }
            }
          `,
        }}
      />
      <div
        className={cn('flex w-max gap-8', pauseOnHover && 'hover:[animation-play-state:paused]')}
        style={{
          animation: `marquee-${direction} ${speed}s linear infinite`,
        }}
      >
        <div className="flex shrink-0 items-center gap-8">{children}</div>
        <div className="flex shrink-0 items-center gap-8">{children}</div>
      </div>
    </div>
  );
}
