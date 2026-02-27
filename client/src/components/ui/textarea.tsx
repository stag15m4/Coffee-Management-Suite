import * as React from "react"

import { cn } from "@/lib/utils"

// Track Tab key to differentiate keyboard navigation from tap/click/trackpad focus.
let lastTabTime = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') lastTabTime = Date.now();
  }, { capture: true });
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const isTabFocus = Date.now() - lastTabTime < 200;

    // Select all on Tab focus only
    if (isTabFocus) {
      e.target.select();
    }

    // iPad Safari scroll-jump prevention
    if (!isTabFocus) {
      const scrollY = window.scrollY;
      const rect = e.target.getBoundingClientRect();
      const vpHeight = window.visualViewport?.height ?? window.innerHeight;

      if (rect.top >= 0 && rect.bottom <= vpHeight) {
        const restore = () => {
          if (Math.abs(window.scrollY - scrollY) > 1) {
            window.scrollTo(0, scrollY);
          }
        };
        requestAnimationFrame(restore);
        setTimeout(restore, 50);
        setTimeout(restore, 100);
        setTimeout(restore, 300);
      }
    }

    onFocus?.(e);
  };

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      onFocus={handleFocus}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
