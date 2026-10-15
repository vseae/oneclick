"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex h-8 w-full min-w-0 items-center border border-[var(--terminal-separator)] bg-[var(--terminal-card)] transition-colors outline-none has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:border-[var(--terminal-blue)] has-[[data-slot=input-group-control]:focus-visible]:shadow-[0_0_0_1px_rgba(0,245,255,0.45)] has-[[data-slot][aria-invalid=true]]:border-[var(--terminal-red)] has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)] select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:border [&>kbd]:border-[var(--terminal-separator)] [&>kbd]:bg-[var(--terminal-fill)] [&>kbd]:px-1 [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-2 has-[>button]:ml-[-0.3rem]",
        "inline-end": "order-last pr-2 has-[>button]:mr-[-0.3rem]",
        "block-start": "order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
        "block-end": "order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({ className, align = "inline-start", ...props }: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva("flex items-center gap-2 text-[11px] shadow-none", {
  variants: {
    size: {
      xs: "h-6 gap-1 px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
      sm: "",
      "icon-xs": "size-6 p-0 has-[>svg]:p-0",
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  defaultVariants: {
    size: "xs",
  },
})

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }) {
  return <Button type={type} data-size={size} variant={variant} className={cn(inputGroupButtonVariants({ size }), className)} {...props} />
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("flex items-center gap-2 text-[12px] text-[var(--terminal-text-secondary)] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4", className)} {...props} />
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return <Input data-slot="input-group-control" className={cn("flex-1 border-0 bg-transparent shadow-none ring-0 focus-visible:shadow-none disabled:bg-transparent", className)} {...props} />
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <Textarea data-slot="input-group-control" className={cn("flex-1 resize-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:shadow-none disabled:bg-transparent", className)} {...props} />
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
