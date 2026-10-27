"use client";

import { useState } from "react";
import { useSpring, animated } from "react-spring";
import { FileSearch, ScrollText } from "lucide-react";
import ToolHeader from "@/components/tools/ToolHeader";
import RawLogDecoder from "@/components/events/RawLogDecoder";
import ReceiptLogDecoder from "@/components/events/ReceiptLogDecoder";

type Mode = "receipt" | "raw";

function segmentClass(active: boolean): string {
  return `flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
    active
      ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
      : "border-transparent text-[var(--terminal-text-secondary)]"
  }`;
}

export default function EventLogTool() {
  const [mode, setMode] = useState<Mode>("receipt");

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <ToolHeader
        title="EVENT_LOG_TOOL"
        subtitle="按交易回执或原始 Topic / DATA 解码事件日志"
        chip={mode === "receipt" ? "RECEIPT" : "RAW_LOG"}
      />

      <div className="terminal-panel-body space-y-4">
        <div
          className="flex gap-1 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-1"
          role="tablist"
          aria-label="事件日志模式"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "receipt"}
            className={segmentClass(mode === "receipt")}
            onClick={() => setMode("receipt")}
          >
            <FileSearch size={13} aria-hidden="true" />
            RECEIPT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "raw"}
            className={segmentClass(mode === "raw")}
            onClick={() => setMode("raw")}
          >
            <ScrollText size={13} aria-hidden="true" />
            RAW_LOG
          </button>
        </div>

        <div className={mode === "receipt" ? "space-y-4" : "hidden"}>
          <ReceiptLogDecoder />
        </div>
        <div className={mode === "raw" ? "space-y-4" : "hidden"}>
          <RawLogDecoder />
        </div>
      </div>
    </animated.div>
  );
}
