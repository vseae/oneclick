"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--terminal-card)",
          "--normal-text": "var(--terminal-text)",
          "--normal-border": "var(--terminal-separator)",
          "--border-radius": "0px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast border border-[var(--terminal-separator)] bg-[var(--terminal-card)] text-[var(--terminal-text)]",
          title: "text-[12px] font-bold tracking-[0.06em] uppercase",
          description: "text-[12px] text-[var(--terminal-text-secondary)]",
          actionButton: "border border-[var(--terminal-blue)] bg-transparent text-[var(--terminal-blue)]",
          cancelButton: "border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] text-[var(--terminal-text)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
