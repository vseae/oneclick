"use client";

import { useMemo, useState } from "react";
import { useSpring, animated } from "react-spring";
import { ChevronDown, ChevronUp } from "lucide-react";
import ConvertField from "@/components/tools/ConvertField";
import ToolHeader from "@/components/tools/ToolHeader";
import { ETH_UNITS, formatAmount, parseAmount, type EthUnit } from "@/lib/convert";

/** The three denominations that cover day to day use; the rest stay collapsed. */
const PRIMARY_UNIT_NAMES = ["Wei", "GWei", "Ether"];

const DEFAULT_UNIT = "Ether";
const DEFAULT_VALUE = "1";

export default function UnitConverter() {
  const [activeUnit, setActiveUnit] = useState(DEFAULT_UNIT);
  const [draft, setDraft] = useState(DEFAULT_VALUE);
  const [showAllUnits, setShowAllUnits] = useState(false);

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const active = ETH_UNITS.find((unit) => unit.name === activeUnit) ?? ETH_UNITS[0];
  const parsed = draft.trim() === "" ? null : parseAmount(draft, active.decimals);
  const wei = parsed?.ok ? parsed.value : null;
  const activeError = parsed && !parsed.ok ? parsed.error : null;

  const { primaryUnits, extraUnits } = useMemo(
    () => ({
      primaryUnits: ETH_UNITS.filter((unit) => PRIMARY_UNIT_NAMES.includes(unit.name)),
      extraUnits: ETH_UNITS.filter((unit) => !PRIMARY_UNIT_NAMES.includes(unit.name)),
    }),
    []
  );

  /** The edited field keeps the user's raw text; every other field is derived. */
  const valueOf = (unit: EthUnit) => {
    if (unit.name === activeUnit) return draft;
    if (wei === null) return "";
    return formatAmount(wei, unit.decimals);
  };

  const focusUnit = (unit: EthUnit) => {
    if (unit.name === activeUnit) return;
    setActiveUnit(unit.name);
    setDraft(wei === null ? "" : formatAmount(wei, unit.decimals));
  };

  const fieldFor = (unit: EthUnit, hint?: string) => (
    <ConvertField
      key={unit.name}
      label={unit.name}
      exponent={unit.decimals}
      value={valueOf(unit)}
      onChange={(next) => {
        setActiveUnit(unit.name);
        setDraft(next);
      }}
      onFocus={() => focusUnit(unit)}
      active={unit.name === activeUnit}
      error={unit.name === activeUnit ? activeError : null}
      hint={hint}
    />
  );

  const reset = () => {
    setActiveUnit(DEFAULT_UNIT);
    setDraft(DEFAULT_VALUE);
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <ToolHeader
        title="UNIT_CONVERTER"
        subtitle="Wei / GWei / Ether 双向换算，编辑任意一栏即可联动"
        chip="ETH UNITS"
      />

      <div className="terminal-panel-body space-y-3">
        <p className="text-[11px] leading-relaxed text-[var(--terminal-text-secondary)]">
          支持粘贴 <code className="font-mono text-[var(--terminal-text)]">0x</code> 十六进制（按当前一栏的单位解析），
          全部换算走 BigInt，不经过浮点数。
        </p>

        <div className="space-y-2">{primaryUnits.map((unit) => fieldFor(unit))}</div>

        <button
          type="button"
          onClick={() => setShowAllUnits((current) => !current)}
          className="terminal-btn terminal-btn-secondary w-full py-2 text-[11px]"
          aria-expanded={showAllUnits}
        >
          {showAllUnits ? (
            <>
              <ChevronUp size={13} aria-hidden="true" /> 收起额外单位
            </>
          ) : (
            <>
              <ChevronDown size={13} aria-hidden="true" /> 展开全部 {ETH_UNITS.length} 个单位
            </>
          )}
        </button>

        {showAllUnits && (
          <div className="grid max-h-[36vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {extraUnits.map((unit) => fieldFor(unit))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-[var(--terminal-separator)] pt-3">
          <p className="text-[10px] leading-snug text-[var(--terminal-text-secondary)]">
            1 Ether = 10¹⁸ Wei = 10⁹ GWei
          </p>
          <button
            type="button"
            onClick={reset}
            className="terminal-btn terminal-btn-secondary shrink-0 px-2.5 py-1.5 text-[10px]"
          >
            RESET
          </button>
        </div>
      </div>
    </animated.div>
  );
}
