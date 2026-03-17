import * as React from 'react';

import { cn } from '@/lib/utils';

// Track Tab key to differentiate keyboard navigation from tap/click/trackpad focus.
let lastTabTime = 0;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Tab') lastTabTime = Date.now();
    },
    { capture: true }
  );
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, style, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const input = e.target;
      const isTabFocus = Date.now() - lastTabTime < 200;

      // Select all text on Tab focus only.
      if (isTabFocus) {
        input.select();
        requestAnimationFrame(() => input.select());
      }

      onFocus?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          (type === 'date' || type === 'time') && 'appearance-none',
          className
        )}
        style={type === 'date' || type === 'time' ? { WebkitAppearance: 'none', ...style } : style}
        ref={ref}
        onFocus={handleFocus}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
