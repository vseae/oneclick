"use client";

import { useMemo, useState } from "react";
import { useSpring, animated } from "react-spring";
import ConvertField from "@/components/tools/ConvertField";
import ToolHeader from "@/components/tools/ToolHeader";
import { BASE_FIELDS, formatBaseValue, parseBaseValue, type BaseField } from "@/lib/convert";

const DEFAULT_FIELD = "hexadecimal";
const DEFAULT_VALUE = "0xff";

/** Four-way conversion between binary, octal, decimal and hexadecimal. */
export default function BaseConversionTool() {
  const [activeKey, setActiveKey] = useState<BaseField["key"]>(DEFAULT_FIELD);
  const [draft, setDraft] = useState(DEFAULT_VALUE);

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const active = BASE_FIELDS.find((field) => field.key === activeKey) ?? BASE_FIELDS[0];
  const parsed = useMemo(
    () => (draft.trim() === "" ? null : parseBaseValue(draft, active.radix)),
    [draft, active.radix]
  );
  const value = parsed?.ok ? parsed.value : null;
  const activeError = parsed && !parsed.ok ? parsed.error : null;

  const valueOf = (field: BaseField) => {
    if (field.key === activeKey) return draft;
    if (value === null) return "";
    return formatBaseValue(value, field.radix);
  };

  const focusField = (field: BaseField) => {
    if (field.key === activeKey) return;
    setActiveKey(field.key);
    setDraft(value === null ? "" : formatBaseValue(value, field.radix));
  };

  const bitLength = value === null || value === BigInt(0) ? 0 : value.toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <ToolHeader
        title="BASE_CONVERTER"
        subtitle="二进制 / 八进制 / 十进制 / 十六进制四向联动"
        chip="NUMBER BASE"
      />

      <div className="terminal-panel-body space-y-3">
        <p className="text-[11px] leading-relaxed text-[var(--terminal-text-secondary)]">
          支持 <code className="font-mono text-[var(--terminal-text)]">0x</code> /{" "}
          <code className="font-mono text-[var(--terminal-text)]">0b</code> /{" "}
          <code className="font-mono text-[var(--terminal-text)]">0o</code> 前缀与下划线分隔符，
          任意长度（BigInt）不丢精度。
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BASE_FIELDS.map((field) => (
            <ConvertField
              key={field.key}
              label={field.label}
              value={valueOf(field)}
              onChange={(next) => {
                setActiveKey(field.key);
                setDraft(next);
              }}
              onFocus={() => focusField(field)}
              active={field.key === activeKey}
              error={field.key === activeKey ? activeError : null}
              inputMode="text"
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--terminal-separator)] pt-3 text-[10px] text-[var(--terminal-text-secondary)]">
          <span>{value === null ? "—" : `${byteLength} 字节 / ${bitLength} 位`}</span>
          <button
            type="button"
            onClick={() => {
              setActiveKey(DEFAULT_FIELD);
              setDraft(DEFAULT_VALUE);
            }}
            className="terminal-btn terminal-btn-secondary shrink-0 px-2.5 py-1.5 text-[10px]"
          >
            RESET
          </button>
        </div>
      </div>
    </animated.div>
  );
}
