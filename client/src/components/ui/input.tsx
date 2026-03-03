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
 * Snapshot window.scrollY and install a brief scroll listener that
 * snaps back if Safari moves it. The scroll event fires synchronously
 * with the scroll (before paint), so the user never sees the jump.
 */
function guardScroll(): void {
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
}

/**
 * Attach a keydown listener that runs guardScroll on every keystroke
 * while the input is focused. Cleans up on blur.
 */
function attachKeystrokeGuard(input: HTMLElement): void {
  const onKeyDown = () => guardScroll();
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

      // Guard the focus event FIRST — before select() or parent onFocus
      // that might call select(). Runs on ALL focus types (tap, Tab,
      // trackpad) so it catches the 7+ places that use
      // onFocus={(e) => e.target.select()}.
      const rect = input.getBoundingClientRect();
      const vpHeight = window.visualViewport?.height ?? window.innerHeight;
      if (rect.top >= 0 && rect.bottom <= vpHeight) {
        guardScroll();
      }

      // Select all text on Tab focus only.
      if (isTabFocus) {
        input.select();
        requestAnimationFrame(() => input.select());
      }

      // Persistent keystroke guard while focused.
      attachKeystrokeGuard(input);

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
