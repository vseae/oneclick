"use client";

import { useId } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { toSuperscript } from "@/lib/convert";

interface ConvertFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  /** Denomination exponent rendered as `10ⁿ` next to the label. */
  exponent?: number;
  error?: string | null;
  hint?: string;
  placeholder?: string;
  active?: boolean;
  inputMode?: "decimal" | "numeric" | "text";
  ariaLabel?: string;
}

/**
 * One editable row in a conversion list. Every field is editable so the user
 * can drive the conversion from any side, and each value can be copied.
 */
export default function ConvertField({
  label,
  value,
  onChange,
  onFocus,
  exponent,
  error,
  hint,
  placeholder = "0",
  active = false,
  inputMode = "decimal",
  ariaLabel,
}: ConvertFieldProps) {
  const id = useId();

  const copyValue = async () => {
    if (!value) {
      toast.error("没有可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("[COPIED] 已复制到剪贴板");
    } catch {
      toast.error("[COPY_FAILED] 复制失败");
    }
  };

  return (
    <div
      className={`border px-2.5 py-2 transition-colors ${
        active
          ? "border-[var(--terminal-blue)]/50 bg-[var(--terminal-blue)]/5"
          : "border-[var(--terminal-separator)] bg-[var(--terminal-card)]"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className={`flex min-w-0 items-center gap-1.5 text-[10px] font-bold tracking-[0.08em] uppercase ${
            active ? "text-[var(--terminal-blue)]" : "text-[var(--terminal-text-secondary)]"
          }`}
        >
          <span className="truncate">{label}</span>
          {typeof exponent === "number" && (
            <span
              className="shrink-0 font-normal normal-case tracking-normal opacity-70"
              title={`10^${exponent}`}
            >
              10{toSuperscript(exponent)}
            </span>
          )}
        </label>
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

      <input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        className="terminal-input px-2.5 py-1.5 font-mono text-[12px] tabular-nums"
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        inputMode={inputMode}
        aria-label={ariaLabel ?? label}
        aria-invalid={Boolean(error)}
      />

      {error ? (
        <p className="mt-1 text-[10px] leading-snug text-[var(--terminal-red)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[10px] leading-snug text-[var(--terminal-text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}
