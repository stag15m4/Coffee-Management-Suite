import * as React from "react"

import { cn } from "@/lib/utils"
import { isTouchFocus, preventScrollJump } from "@/lib/ios-scroll-fix"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const isTouch = isTouchFocus();

    // Select all on keyboard (tab) focus only
    if (!isTouch) {
      e.target.select();
    }

    // Prevent iOS Safari scroll jump on touch focus.
    if (isTouch) {
      preventScrollJump(e.target);
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
