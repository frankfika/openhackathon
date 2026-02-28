import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold tracking-[0.01em] ring-offset-background transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"

    const variants = {
      default:
        "bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white shadow-[0_14px_30px_rgba(6,182,212,0.28)] hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(6,182,212,0.34)]",
      destructive:
        "bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(239,68,68,0.28)] hover:-translate-y-0.5 hover:bg-destructive/92",
      outline:
        "border border-white/80 bg-white/78 text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-md hover:-translate-y-0.5 hover:bg-white/92 dark:border-slate-700/70 dark:bg-slate-900/60 dark:hover:bg-slate-900/75",
      secondary:
        "border border-white/75 bg-white/66 text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.06)] backdrop-blur-md hover:-translate-y-0.5 hover:bg-white/82 dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:bg-slate-900/72",
      ghost:
        "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      glass:
        "border border-white/35 bg-white/15 text-white shadow-[0_12px_28px_rgba(2,132,199,0.2)] backdrop-blur-xl hover:-translate-y-0.5 hover:bg-white/24",
    }

    const sizes = {
      default: "h-10 px-4 py-2.5",
      sm: "h-9 px-3.5",
      lg: "h-11 px-8",
      icon: "h-10 w-10 rounded-xl",
    }

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
