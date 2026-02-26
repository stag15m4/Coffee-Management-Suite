import * as React from "react"

import { cn } from "@/lib/utils"
import { isTouchFocus, preventScrollJump } from "@/lib/ios-scroll-fix"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const isTouch = isTouchFocus();

      // Select all text on keyboard (tab) focus only.
      // Touch/click naturally places the cursor — calling select() on iOS
      // triggers unwanted auto-scroll that makes the page jump.
      if (!isTouch) {
        e.target.select();
        // Some browsers clear selection on number inputs; re-select after a tick
        requestAnimationFrame(() => e.target.select());
      }

      // Prevent iOS Safari scroll jump on touch focus.
      if (isTouch) {
        preventScrollJump(e.target);
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
