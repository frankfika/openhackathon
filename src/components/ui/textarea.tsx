import * as React from "react"

import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-xl border border-white/80 bg-white/78 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-offset-background backdrop-blur-sm transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:border-primary/40 dark:border-slate-700/70 dark:bg-slate-900/58 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
