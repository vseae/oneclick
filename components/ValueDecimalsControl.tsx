"use client";

import { useId, useState } from "react";
import { setValueDecimals, useValueDecimals } from "@/lib/value-decimals";

const PRESETS = [18, 6, 8];

/**
 * Shared precision switch for raw contract values. The preference is global, so
 * changing it here also updates every result in the system log and decides
 * whether copy actions copy the raw or the converted amount.
 */
export default function ValueDecimalsControl({ className }: { className?: string }) {
  const id = useId();
  const decimals = useValueDecimals();
  const [customMode, setCustomMode] = useState(false);

  const isPreset = decimals === null || PRESETS.includes(decimals);
  const selectValue = customMode
    ? "custom"
    : decimals === null
      ? "raw"
      : PRESETS.includes(decimals)
        ? String(decimals)
        : "custom";
  const showCustomInput = customMode || (!isPreset && decimals !== null);

  const handleSelect = (next: string) => {
    if (next === "raw") {
      setCustomMode(false);
      setValueDecimals(null);
      return;
    }
    if (next === "custom") {
      setCustomMode(true);
      if (decimals === null) setValueDecimals(18);
      return;
    }
    setCustomMode(false);
    setValueDecimals(Number(next));
  };

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <label htmlFor={id} className="sr-only">
        结果小数位
      </label>
      <div className="w-[112px] shrink-0">
        <select
          id={id}
          value={selectValue}
          onChange={(event) => handleSelect(event.target.value)}
          className="terminal-input cursor-pointer"
          title="按此小数位换算结果显示与复制（18 常用于 ETH，6 常用于 USDC，8 常用于 WBTC）"
        >
          <option value="raw">原始值</option>
          <option value="18">18 位小数</option>
          <option value="6">6 位小数</option>
          <option value="8">8 位小数</option>
          <option value="custom">自定义…</option>
        </select>
      </div>
      {showCustomInput && (
        <div className="w-[64px] shrink-0">
          <input
            type="number"
            min={0}
            max={255}
            value={decimals ?? ""}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isInteger(next) && next >= 0 && next <= 255) setValueDecimals(next);
            }}
            className="terminal-input tabular-nums"
            aria-label="自定义小数位"
          />
        </div>
      )}
    </div>
  );
}
