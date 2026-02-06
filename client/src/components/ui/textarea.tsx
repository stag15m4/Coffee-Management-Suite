import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Select all text on focus — tab selects all; click naturally overrides with cursor placement
    e.target.select();

    // iOS scroll jump prevention
    const scrollY = window.scrollY;
    const restore = () => window.scrollTo(0, scrollY);
    requestAnimationFrame(restore);
    setTimeout(restore, 50);
    setTimeout(restore, 100);
    setTimeout(restore, 150);

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
