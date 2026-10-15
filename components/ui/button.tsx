"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 border text-[12px] font-medium tracking-[0.01em] whitespace-nowrap transition-colors outline-none select-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--terminal-blue)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 rounded-xl",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(37,99,235,0.5)] bg-[linear-gradient(180deg,#3670f6_0%,var(--terminal-blue)_100%)] text-[var(--terminal-on-primary-fixed)] shadow-[0_8px_18px_rgba(37,99,235,0.18)] hover:bg-[linear-gradient(180deg,#3f76f7_0%,#1e5df0_100%)]",
        outline:
          "border-[var(--terminal-separator)] bg-white/95 text-[var(--terminal-text)] hover:bg-[var(--terminal-fill)]",
        secondary:
          "border-[var(--terminal-separator)] bg-white/95 text-[var(--terminal-text)] hover:border-[var(--terminal-outline)] hover:bg-[var(--terminal-fill)]",
        ghost:
          "border-transparent bg-transparent text-[var(--terminal-text-secondary)] hover:border-[var(--terminal-separator)] hover:bg-[var(--terminal-hover)] hover:text-[var(--terminal-text)]",
        destructive:
          "border-[var(--terminal-red)] bg-white/95 text-[var(--terminal-red)] hover:bg-[color-mix(in_srgb,var(--terminal-red)_10%,white)]",
        link: "border-transparent bg-transparent px-0 py-0 text-[var(--terminal-blue)] normal-case tracking-normal underline-offset-2 hover:underline",
      },
      size: {
        default: "h-9 px-3",
        xs: "h-7 px-2.5 text-[11px]",
        sm: "h-8 px-3 text-[11px]",
        lg: "h-10 px-4",
        icon: "size-9",
        "icon-xs": "size-7",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
