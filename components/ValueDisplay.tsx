"use client";

import { formatValueForDecimals, useValueDecimals } from "@/lib/value-decimals";

interface ValueDisplayProps {
  value: string;
  className?: string;
}

/**
 * Renders a raw contract return value and, when the shared precision preference
 * is set, a human readable line such as `= 1.5` underneath it.
 *
 * Only plain integer strings are candidates: arrays, objects and status text
 * are shown verbatim.
 */
export default function ValueDisplay({ value, className }: ValueDisplayProps) {
  const decimals = useValueDecimals();
  const formatted = formatValueForDecimals(value, decimals);

  return (
    <span className={className}>
      <span className="break-all font-mono">{value}</span>
      {formatted !== null && (
        <span className="mt-0.5 block text-[11px] text-[var(--terminal-text-secondary)]">
          = {formatted}
          <span className="ml-1 opacity-60">({decimals} 位小数)</span>
        </span>
      )}
    </span>
  );
}
