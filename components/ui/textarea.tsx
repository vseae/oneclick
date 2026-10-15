import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full border border-[var(--terminal-separator)] bg-white/96 px-3 py-2 text-[13px] font-normal text-[var(--terminal-text)] transition-colors outline-none rounded-xl placeholder:text-[var(--terminal-text-secondary)] focus-visible:border-[var(--terminal-blue)] focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.14)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--terminal-red)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
