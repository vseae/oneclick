"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

interface ResultRowProps {
  label: string;
  value: string;
}

/** Read-only output row with a copy affordance, used by the epoch tool. */
export default function ResultRow({ label, value }: ResultRowProps) {
  const copyValue = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("[COPIED] 已复制到剪贴板");
    } catch {
      toast.error("[COPY_FAILED] 复制失败");
    }
  };

  return (
    <div className="flex items-start justify-between gap-2 border border-[var(--terminal-separator)] bg-[var(--terminal-card)] px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.08em] text-[var(--terminal-text-secondary)] uppercase">
          {label}
        </p>
        <p className="mt-1 font-mono text-[12px] break-all text-[var(--terminal-text)] tabular-nums">
          {value || "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void copyValue()}
        className="shrink-0 border border-transparent p-0.5 text-[var(--terminal-text-secondary)] transition-colors hover:border-[var(--terminal-separator)] hover:bg-[var(--terminal-hover)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
        aria-label={`复制 ${label}`}
        title={`复制 ${label}`}
      >
        <Copy size={11} aria-hidden="true" />
      </button>
    </div>
  );
}
