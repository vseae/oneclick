"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useSpring, animated } from "react-spring";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const units = [
  { name: "Wei", decimals: 0 },
  { name: "GWei", decimals: 9 },
  { name: "Ether", decimals: 18 },
];

export default function UnitConverter() {
  const [inputValue, setInputValue] = useState("1");
  const [inputUnit, setInputUnit] = useState("Ether");

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const handleInputChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) setInputValue(value);
  };

  const convertToWei = (value: string, fromUnit: string): bigint => {
    if (!value || value === "0" || value === ".") return BigInt(0);
    try {
      if (fromUnit === "Ether") return ethers.parseEther(value);
      if (fromUnit === "GWei") return ethers.parseUnits(value, 9);
      return BigInt(value);
    } catch { return BigInt(0); }
  };

  const convertFromWei = (wei: bigint, toUnit: string): string => {
    if (wei === BigInt(0)) return "0";
    try {
      if (toUnit === "Ether") return ethers.formatEther(wei);
      if (toUnit === "GWei") return ethers.formatUnits(wei, 9);
      return wei.toString();
    } catch { return "0"; }
  };

  const weiValue = convertToWei(inputValue, inputUnit);

  const copyValue = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("[COPIED] 已复制到剪贴板");
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <div className="terminal-panel-header flex items-center justify-between gap-3">
        <div>
          <h2 className="terminal-section-title">[UNIT_CONVERTER]</h2>
          <p className="text-[12px] text-[var(--terminal-text-secondary)] mt-1">
            Convert between Wei, GWei and Ether
          </p>
        </div>
        <span className="terminal-chip">PRECISION</span>
      </div>

      <div className="terminal-panel-body space-y-4">
        <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 space-y-3">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[INPUT]</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="unit-input" className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">Amount</label>
              <div className="terminal-prompt-wrap">
                <input
                  id="unit-input"
                  type="text"
                  inputMode="decimal"
                  name="unit-value"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="terminal-input font-mono tabular-nums"
                  placeholder="0.0"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="w-32">
              <label htmlFor="unit-select" className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">Unit</label>
              <select
                id="unit-select"
                name="unit-type"
                value={inputUnit}
                onChange={(e) => setInputUnit(e.target.value)}
                className="terminal-input cursor-pointer"
              >
                {units.map((u) => (
                  <option key={u.name} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border border-[var(--terminal-separator)]">
          <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-between">
            <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[RESULTS]</p>
            <button
              type="button"
              onClick={() => {
                setInputValue("1");
                setInputUnit("Ether");
              }}
              className="terminal-btn terminal-btn-secondary px-2.5 py-1.5 text-[10px]"
            >
              RESET
            </button>
          </div>
          <div className="space-y-0">
            {units.map((unit) => {
              const converted = convertFromWei(weiValue, unit.name);
              const isActive = unit.name === inputUnit;
              return (
                <div
                  key={unit.name}
                  className={`flex items-center justify-between p-3.5 border-t transition-colors first:border-t-0 ${
                    isActive
                      ? "border-[var(--terminal-blue)]/30 bg-[var(--terminal-blue)]/5"
                      : "border-[var(--terminal-separator)] bg-transparent"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-bold tracking-[0.08em] uppercase ${isActive ? "text-[var(--terminal-blue)]" : "text-[var(--terminal-text-secondary)]"}`}>
                      {unit.name}
                    </p>
                    <p className="text-[14px] font-mono font-medium text-[var(--terminal-text)] mt-1 break-all tabular-nums">
                      {converted}
                    </p>
                  </div>
                  <button
                    onClick={() => copyValue(converted)}
                    className="terminal-btn terminal-btn-secondary h-8 w-8 p-0 shrink-0"
                    aria-label={`复制 ${unit.name} 值`}
                  >
                    <Copy size={13} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </animated.div>
  );
}
