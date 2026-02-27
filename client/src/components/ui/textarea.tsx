import * as React from "react"

import { cn } from "@/lib/utils"

// Track Tab key to differentiate keyboard navigation from tap/click/trackpad focus.
let lastTabTime = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') lastTabTime = Date.now();
  }, { capture: true });
}

/** Same scroll guard as Input — see input.tsx for detailed comments. */
function attachScrollGuard(input: HTMLElement): void {
  const onKeyDown = () => {
    const scrollY = window.scrollY;

    const onScroll = () => {
      if (Math.abs(window.scrollY - scrollY) > 1) {
        window.scrollTo(0, scrollY);
      }
    };

    window.addEventListener('scroll', onScroll);

    const cleanup = () => window.removeEventListener('scroll', onScroll);
    requestAnimationFrame(() => requestAnimationFrame(cleanup));
    setTimeout(cleanup, 300);
  };

  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', () => {
    input.removeEventListener('keydown', onKeyDown);
  }, { once: true });
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const input = e.target;
    const isTabFocus = Date.now() - lastTabTime < 200;

    if (isTabFocus) {
      input.select();
    }

    attachScrollGuard(input);

    if (!isTabFocus) {
      const scrollY = window.scrollY;
      const rect = input.getBoundingClientRect();
      const vpHeight = window.visualViewport?.height ?? window.innerHeight;

      if (rect.top >= 0 && rect.bottom <= vpHeight) {
        const onScroll = () => {
          if (Math.abs(window.scrollY - scrollY) > 1) {
            window.scrollTo(0, scrollY);
          }
        };
        window.addEventListener('scroll', onScroll);
        const cleanup = () => window.removeEventListener('scroll', onScroll);
        requestAnimationFrame(() => requestAnimationFrame(cleanup));
        setTimeout(cleanup, 300);
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
