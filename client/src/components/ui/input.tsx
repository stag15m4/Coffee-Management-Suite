import * as React from "react"

import { cn } from "@/lib/utils"

// Track last touch to differentiate touch-focus (tap) from keyboard-focus (tab).
// On iOS Safari, calling select() on touch-focus triggers an aggressive auto-scroll
// that makes the page jump to the input.
let lastTouchTime = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => { lastTouchTime = Date.now(); }, { passive: true, capture: true });
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const isTouchTriggered = Date.now() - lastTouchTime < 500;

      // Select all text on keyboard (tab) focus only.
      // Touch/click naturally places the cursor — calling select() on iOS
      // triggers unwanted auto-scroll that makes the page jump.
      if (!isTouchTriggered) {
        e.target.select();
        // Some browsers clear selection on number inputs; re-select after a tick
        requestAnimationFrame(() => e.target.select());
      }

      // iOS Safari scroll-jump prevention:
      // Only restore scroll position when the input is already visible on screen.
      // If it's off-screen, let the browser scroll to it naturally.
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

      // Call any additional onFocus handler from the caller
      onFocus?.(e);
    };

    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          (type === "date" || type === "time") && "appearance-none",
          className
        )}
        style={(type === "date" || type === "time") ? { WebkitAppearance: "none", ...style } : style}
        ref={ref}
        onFocus={handleFocus}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
