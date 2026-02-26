import * as React from "react"

import { cn } from "@/lib/utils"
import { isTouchFocus, preventScrollJump } from "@/lib/ios-scroll-fix"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const isTouch = isTouchFocus();

    // Prevent iPadOS Safari scroll jump on ANY focus — touch (virtual keyboard)
    // AND trackpad/keyboard (Magic Keyboard).
    preventScrollJump(e.target);

    // Select all on keyboard (tab) focus only
    if (!isTouch) {
      e.target.select();
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
