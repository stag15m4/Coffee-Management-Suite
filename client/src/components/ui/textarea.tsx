import * as React from "react"

import { cn } from "@/lib/utils"

// Track last touch to differentiate touch-focus (tap) from keyboard-focus (tab).
let lastTouchTime = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => { lastTouchTime = Date.now(); }, { passive: true, capture: true });
}

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const isTouchTriggered = Date.now() - lastTouchTime < 500;

    // Select all on keyboard (tab) focus only
    if (!isTouchTriggered) {
      e.target.select();
    }

    // iOS Safari scroll-jump prevention:
    // Only restore scroll when the element is already visible on screen.
    if (isTouchTriggered) {
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
        setTimeout(restore, 100);
        setTimeout(restore, 300);
      }
    }

    onFocus?.(e);
  };

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
