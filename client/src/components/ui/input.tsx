import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, style, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Select all text on focus — tab selects all; click naturally overrides with cursor placement
      e.target.select();

      // iOS scroll jump prevention: save scroll position and restore it
      // after the virtual keyboard animation shifts the viewport
      const scrollY = window.scrollY;
      const restore = () => window.scrollTo(0, scrollY);
      requestAnimationFrame(restore);
      setTimeout(restore, 50);
      setTimeout(restore, 100);
      setTimeout(restore, 150);

      // Call any additional onFocus handler from the caller
      onFocus?.(e);
    };

    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          type === "date" && "appearance-none",
          className
        )}
        style={type === "date" ? { WebkitAppearance: "none", ...style } : style}
        ref={ref}
        onFocus={handleFocus}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
