"use client";

import { useEffect, useState } from "react";
import { useSpring, animated } from "react-spring";
import { Clock } from "lucide-react";
import ConvertField from "@/components/tools/ConvertField";
import ResultRow from "@/components/tools/ResultRow";
import ToolHeader from "@/components/tools/ToolHeader";
import {
  describeRelative,
  parseDateTimeLocalUtc,
  parseEpochInput,
  toDateTimeLocalValue,
  toLocalString,
  toUtcString,
  utcPartsToEpochSeconds,
  type EpochUnit,
} from "@/lib/convert";

/**
 * Two way conversion between unix timestamps and UTC. `datetime-local` values
 * are deliberately interpreted as UTC so the result never depends on the
 * browser timezone.
 */
export default function UnixEpochTool() {
  // Only mounted from a user gesture inside the tool dialog, so reading the
  // clock in the initializer cannot cause a hydration mismatch.
  const [now, setNow] = useState(() => Date.now());
  const [epochInput, setEpochInput] = useState("");
  const [utcInput, setUtcInput] = useState("");

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  let epochMs: number | null = null;
  let epochUnit: EpochUnit | null = null;
  let epochError: string | null = null;

  if (epochInput.trim()) {
    const parsed = parseEpochInput(epochInput);
    if (parsed.ok) {
      epochMs = parsed.value.ms;
      epochUnit = parsed.value.unit;
    } else {
      epochError = parsed.error;
    }
  }

  let utcSeconds: number | null = null;
  let utcError: string | null = null;

  if (utcInput) {
    const parts = parseDateTimeLocalUtc(utcInput);
    if (!parts.ok) {
      utcError = parts.error;
    } else {
      const seconds = utcPartsToEpochSeconds(parts.value);
      if (seconds.ok) utcSeconds = seconds.value;
      else utcError = seconds.error;
    }
  }

  const useNow = () => {
    const current = Date.now();
    setNow(current);
    setEpochInput(String(Math.floor(current / 1000)));
    setUtcInput(toDateTimeLocalValue(current));
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <ToolHeader
        title="UNIX_EPOCH"
        subtitle="Unix 时间戳与 UTC 日期双向互转"
        chip="UTC"
      />

      <div className="terminal-panel-body space-y-3">
        <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] text-[var(--terminal-text-secondary)] uppercase">
              <Clock size={11} aria-hidden="true" /> Now
            </span>
            <button
              type="button"
              onClick={useNow}
              className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px]"
            >
              填入当前时间
            </button>
          </div>
          <p className="mt-1 font-mono text-[20px] leading-none text-[var(--terminal-text)] tabular-nums">
            {Math.floor(now / 1000)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-[var(--terminal-text-secondary)]">
            {toUtcString(now)}
          </p>
        </div>

        <section className="space-y-2">
          <p className="text-[10px] font-bold tracking-[0.08em] text-[var(--terminal-text-secondary)] uppercase">
            [Timestamp → UTC]
          </p>

          <ConvertField
            label="Unix Timestamp"
            value={epochInput}
            onChange={setEpochInput}
            error={epochError}
            inputMode="numeric"
            hint={
              epochUnit
                ? `自动识别为${epochUnit === "seconds" ? "秒" : "毫秒"}`
                : "10 位按秒解析，13 位按毫秒解析"
            }
          />

          {epochMs !== null && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ResultRow label="UTC" value={toUtcString(epochMs)} />
              <ResultRow label="Local" value={toLocalString(epochMs)} />
              <ResultRow label="ISO 8601" value={new Date(epochMs).toISOString()} />
              <ResultRow
                label="Relative"
                value={describeRelative(epochMs, now)}
              />
            </div>
          )}
        </section>

        <section className="space-y-2 border-t border-[var(--terminal-separator)] pt-3">
          <p className="text-[10px] font-bold tracking-[0.08em] text-[var(--terminal-text-secondary)] uppercase">
            [UTC → Timestamp]
          </p>

          <div>
            <label
              htmlFor="utc-datetime"
              className="mb-1 block text-[12px] font-medium text-[var(--terminal-text-secondary)]"
            >
              UTC 日期时间
            </label>
            <input
              id="utc-datetime"
              name="utc-datetime"
              type="datetime-local"
              step={1}
              value={utcInput}
              onChange={(event) => setUtcInput(event.target.value)}
              className="terminal-input px-2.5 py-1.5 font-mono text-[12px] tabular-nums"
              aria-invalid={Boolean(utcError)}
            />
            <p className="mt-1 text-[10px] text-[var(--terminal-text-secondary)]">
              该时间按 UTC 解析，与浏览器时区无关
            </p>
            {utcError && (
              <p className="mt-1 text-[10px] text-[var(--terminal-red)]" role="alert">
                {utcError}
              </p>
            )}
          </div>

          {utcSeconds !== null && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ResultRow label="Unix（秒）" value={String(utcSeconds)} />
              <ResultRow label="Unix（毫秒）" value={String(utcSeconds * 1000)} />
            </div>
          )}
        </section>
      </div>
    </animated.div>
  );
}
