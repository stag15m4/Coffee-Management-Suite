import * as React from "react"

import { cn } from "@/lib/utils"
import { isTabFocus } from "@/lib/ios-scroll-fix"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Select all text on Tab-key focus only — useful for quickly replacing
      // a field value when tabbing through a form. Trackpad clicks and touch
      // taps should place the cursor normally; calling select() on those can
      // trigger Safari's scroll-to-selection behavior.
      if (isTabFocus()) {
        e.target.select();
        // Some browsers clear selection on number inputs; re-select after a tick
        requestAnimationFrame(() => e.target.select());
      }

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
