"use client";

import { useMemo, useState } from "react";
import { useSpring, animated } from "react-spring";
import ConvertField from "@/components/tools/ConvertField";
import ToolHeader from "@/components/tools/ToolHeader";
import { formatAmount, parseAmount, toSuperscript } from "@/lib/convert";

const DECIMALS_PRESETS = [
  { label: "USDC", decimals: 6 },
  { label: "WBTC", decimals: 8 },
  { label: "WAD", decimals: 18 },
  { label: "RAY", decimals: 27 },
  { label: "RAD", decimals: 45 },
];

const DEFAULT_DECIMALS = "18";
const DEFAULT_VALUE = "1";

type Field = "unit" | "base";

function parseDecimals(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value > 255) return null;
  return value;
}

/**
 * Convert between a token's human readable amount and its smallest unit for an
 * arbitrary `decimals` value (ERC-20 `decimals()`, or fixed point wad/ray/rad).
 */
export default function TokenUnitConverter() {
  const [decimalsInput, setDecimalsInput] = useState(DEFAULT_DECIMALS);
  const [activeField, setActiveField] = useState<Field>("unit");
  const [draft, setDraft] = useState(DEFAULT_VALUE);

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const decimals = parseDecimals(decimalsInput);
  const decimalsError =
    decimalsInput.trim() && decimals === null ? "decimals 必须是 0–255 的整数" : null;

  const parsed = useMemo(() => {
    if (decimals === null || !draft.trim()) return null;
    return parseAmount(draft, activeField === "unit" ? decimals : 0);
  }, [decimals, draft, activeField]);

  const base = parsed?.ok ? parsed.value : null;
  const activeError = parsed && !parsed.ok ? parsed.error : null;

  const unitDisplay =
    activeField === "unit"
      ? draft
      : base !== null && decimals !== null
        ? formatAmount(base, decimals)
        : "";
  const baseDisplay = activeField === "base" ? draft : base !== null ? formatAmount(base, 0) : "";

  /**
   * Decimals changes keep the human readable amount stable and let the base
   * unit follow, which is what users expect when correcting a token config.
   */
  const applyDecimals = (next: string) => {
    const currentUnits =
      base !== null && decimals !== null ? formatAmount(base, decimals) : "";
    setDecimalsInput(next);
    setActiveField("unit");
    setDraft(currentUnits);
  };

  const focusField = (field: Field) => {
    if (field === activeField) return;
    setDraft(field === "unit" ? unitDisplay : baseDisplay);
    setActiveField(field);
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <ToolHeader
        title="TOKEN_UNIT_CONVERTER"
        subtitle="按任意 decimals 在代币数量与最小单位之间互转"
        chip="DECIMALS"
      />

      <div className="terminal-panel-body space-y-3">
        <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="token-decimals"
              className="text-[10px] font-bold tracking-[0.08em] text-[var(--terminal-text-secondary)] uppercase"
            >
              Decimals
            </label>
            <span className="text-[10px] text-[var(--terminal-text-secondary)]">
              1 Units = 10{toSuperscript(decimals ?? 0)} Base
            </span>
          </div>

          <input
            id="token-decimals"
            name="token-decimals"
            value={decimalsInput}
            onChange={(event) => applyDecimals(event.target.value)}
            className="terminal-input mt-1 px-2.5 py-1.5 font-mono text-[12px] tabular-nums"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(decimalsError)}
          />

          <div className="mt-2 flex flex-wrap gap-1">
            {DECIMALS_PRESETS.map((preset) => {
              const isActive = decimals === preset.decimals;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyDecimals(String(preset.decimals))}
                  className={`terminal-btn px-2 py-1 text-[10px] ${
                    isActive ? "terminal-btn-primary" : "terminal-btn-secondary"
                  }`}
                  title={`${preset.decimals} decimals`}
                >
                  {preset.label}
                  <span className="opacity-70">{preset.decimals}</span>
                </button>
              );
            })}
          </div>

          {decimalsError && (
            <p className="mt-1 text-[10px] text-[var(--terminal-red)]" role="alert">
              {decimalsError}
            </p>
          )}
        </div>

        <ConvertField
          label="Units"
          exponent={decimals ?? undefined}
          value={unitDisplay}
          onChange={(next) => {
            setActiveField("unit");
            setDraft(next);
          }}
          onFocus={() => focusField("unit")}
          active={activeField === "unit"}
          error={activeField === "unit" ? activeError : null}
          hint="人类可读的数量，例如 1.5"
          inputMode="decimal"
        />

        <ConvertField
          label="Base"
          exponent={0}
          value={baseDisplay}
          onChange={(next) => {
            setActiveField("base");
            setDraft(next);
          }}
          onFocus={() => focusField("base")}
          active={activeField === "base"}
          error={activeField === "base" ? activeError : null}
          hint="最小单位整数，例如转账时实际写入的数额"
          inputMode="numeric"
        />

        <p className="border-t border-[var(--terminal-separator)] pt-3 text-[10px] leading-snug text-[var(--terminal-text-secondary)]">
          decimals 来自代币合约的 <code className="font-mono text-[var(--terminal-text)]">decimals()</code>
          ；USDC 为 6，原生 ETH 为 18，wad/ray/rad 分别为 18/27/45。
        </p>
      </div>
    </animated.div>
  );
}
