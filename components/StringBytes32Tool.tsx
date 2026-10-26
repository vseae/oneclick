"use client";

import { useState } from "react";
import { useSpring, animated } from "react-spring";
import ConvertField from "@/components/tools/ConvertField";
import ToolHeader from "@/components/tools/ToolHeader";
import {
  bytes32ToString,
  normalizeBytes32,
  stringToBytes32,
  utf8ByteLength,
} from "@/lib/convert";

/**
 * Solidity stores short strings in `bytes32` as right zero padded UTF-8, which
 * is why both sides of this tool stay editable and update each other.
 */
export default function StringBytes32Tool() {
  const [stringValue, setStringValue] = useState("");
  const [bytes32Value, setBytes32Value] = useState("");
  const [stringError, setStringError] = useState<string | null>(null);
  const [bytes32Error, setBytes32Error] = useState<string | null>(null);

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const changeString = (next: string) => {
    setStringValue(next);
    setBytes32Error(null);

    if (!next) {
      setStringError(null);
      setBytes32Value("");
      return;
    }

    const encoded = stringToBytes32(next);
    if (encoded.ok) {
      setStringError(null);
      setBytes32Value(encoded.value);
    } else {
      setStringError(encoded.error);
      setBytes32Value("");
    }
  };

  const changeBytes32 = (next: string) => {
    setBytes32Value(next);
    setStringError(null);

    if (!next.trim()) {
      setBytes32Error(null);
      setStringValue("");
      return;
    }

    const normalized = normalizeBytes32(next);
    if (!normalized.ok) {
      setBytes32Error(normalized.error);
      setStringValue("");
      return;
    }

    setBytes32Error(null);
    const decoded = bytes32ToString(normalized.value);
    if (decoded.ok) {
      setStringValue(decoded.value);
    } else {
      setStringValue("");
      setStringError(decoded.error);
    }
  };

  const usedBytes = utf8ByteLength(stringValue);

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <ToolHeader
        title="STRING_BYTES32"
        subtitle="UTF-8 字符串与 bytes32 互转（右补零，最多 32 字节）"
        chip="ABI TYPE"
      />

      <div className="terminal-panel-body space-y-3">
        <ConvertField
          label="String"
          value={stringValue}
          onChange={changeString}
          error={stringError}
          hint={`${usedBytes} / 32 字节${usedBytes >= 32 ? "（已满）" : ""}`}
          placeholder="例如 USDC"
          inputMode="text"
        />

        <ConvertField
          label="Bytes32"
          value={bytes32Value}
          onChange={changeBytes32}
          error={bytes32Error}
          hint="0x + 64 位十六进制；不足 32 字节会自动右补零"
          placeholder="0x0000…"
          inputMode="text"
        />

        <p className="border-t border-[var(--terminal-separator)] pt-3 text-[10px] leading-snug text-[var(--terminal-text-secondary)]">
          解码时以第一个 <code className="font-mono text-[var(--terminal-text)]">00</code> 字节作为结束符，
          因此不满 32 字节的标识符可以正常还原；哈希类数据会提示不是合法 UTF-8。
        </p>
      </div>
    </animated.div>
  );
}
