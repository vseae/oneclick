"use client";

import { toast } from "sonner";

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("[COPIED] 已复制到剪贴板"),
    () => toast.error("[COPY_FAILED] 复制失败")
  );
}

export function shortenHash(value: string) {
  if (!value || value.length < 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-t border-[var(--terminal-separator)] first:border-t-0">
      <span className="text-[13px] text-[var(--terminal-text-secondary)] shrink-0">{label}</span>
      <button
        type="button"
        onClick={() => copyToClipboard(value)}
        className="text-[13px] font-mono text-[var(--terminal-text)] break-all text-right hover:text-[var(--terminal-blue)] transition-colors cursor-pointer"
      >
        {value}
      </button>
    </div>
  );
}
