import * as React from "react"

import { cn } from "@/lib/utils"

// Track Tab key to differentiate keyboard navigation from tap/click/trackpad focus.
let lastTabTime = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') lastTabTime = Date.now();
  }, { capture: true });
}

/**
 * On each keydown, snapshot window.scrollY and install a temporary
 * scroll listener that snaps back instantly if Safari moves it.
 * The scroll event fires synchronously with the scroll (before paint),
 * so the user never sees the wrong position — unlike rAF/setTimeout
 * which fire after the browser has already painted the jump.
 */
function attachScrollGuard(input: HTMLElement): void {
  const onKeyDown = () => {
    const scrollY = window.scrollY;

    const onScroll = () => {
      if (Math.abs(window.scrollY - scrollY) > 1) {
        window.scrollTo(0, scrollY);
      }
    };

    window.addEventListener('scroll', onScroll);

    // Remove after the React re-render + Safari scroll window passes.
    // Two rAFs covers one full render cycle; timeout is a safety net.
    const cleanup = () => window.removeEventListener('scroll', onScroll);
    requestAnimationFrame(() => requestAnimationFrame(cleanup));
    setTimeout(cleanup, 300);
  };

  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('blur', () => {
    input.removeEventListener('keydown', onKeyDown);
  }, { once: true });
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const input = e.target;
      const isTabFocus = Date.now() - lastTabTime < 200;

      // Select all text on Tab focus only.
      if (isTabFocus) {
        input.select();
        requestAnimationFrame(() => input.select());
      }

      // Persistent scroll guard for all keystrokes while focused.
      attachScrollGuard(input);

      // Also guard the initial focus event for tap/trackpad clicks.
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
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
