import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border px-2 py-0.5 text-[10px] font-medium tracking-[0.01em] whitespace-nowrap rounded-full transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--terminal-blue)] [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-[rgba(37,99,235,0.2)] bg-[var(--terminal-blue)]/10 text-[var(--terminal-blue)]",
        secondary: "border-[var(--terminal-separator)] bg-white/95 text-[var(--terminal-text-secondary)]",
        destructive: "border-[rgba(220,38,38,0.2)] bg-[var(--terminal-red)]/10 text-[var(--terminal-red)]",
        outline: "border-[var(--terminal-separator)] bg-white/95 text-[var(--terminal-text)]",
        ghost: "border-transparent bg-transparent text-[var(--terminal-text-secondary)]",
        link: "border-transparent bg-transparent px-0 text-[var(--terminal-blue)] normal-case tracking-normal underline-offset-2 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
