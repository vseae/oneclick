import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 border border-[var(--terminal-separator)] bg-white/96 px-3 py-1 text-[13px] font-normal text-[var(--terminal-text)] transition-colors outline-none placeholder:text-[var(--terminal-text-secondary)] rounded-xl focus-visible:border-[var(--terminal-blue)] focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.14)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--terminal-red)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
