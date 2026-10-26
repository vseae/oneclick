"use client";

import type { ReactNode } from "react";

interface ToolHeaderProps {
  title: string;
  subtitle: string;
  chip?: string;
  action?: ReactNode;
}

/** Shared header for the calculator tools inside the tool dialog. */
export default function ToolHeader({ title, subtitle, chip, action }: ToolHeaderProps) {
  return (
    <div className="terminal-panel-header flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="terminal-section-title">[{title}]</h2>
        <p className="mt-1 text-[12px] text-[var(--terminal-text-secondary)]">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {chip && <span className="terminal-chip">{chip}</span>}
      </div>
    </div>
  );
}
