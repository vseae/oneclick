"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { toast } from "sonner";
import { useSpring, animated } from "react-spring";
import { Hash, Copy } from "lucide-react";

export default function Keccak256Tool() {
  const [input, setInput] = useState("");
  const [hash, setHash] = useState("");

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const resultSpring = useSpring({
    opacity: hash ? 1 : 0,
    transform: hash ? "translateY(0px)" : "translateY(4px)",
    config: { tension: 300, friction: 26 },
  });

  const handleHash = () => {
    if (!input) { toast.error("[INPUT_REQUIRED] 请输入要哈希的字符串"); return; }
    try {
      setHash(ethers.keccak256(ethers.toUtf8Bytes(input)));
      toast.success("[HASH_READY] 哈希生成成功");
    } catch { toast.error("[HASH_FAILED] 生成哈希失败"); }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("[COPIED] 已复制到剪贴板");
    } catch { toast.error("[COPY_FAILED] 复制失败"); }
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <div className="terminal-panel-header flex items-center justify-between gap-3">
        <div>
          <h2 className="terminal-section-title">[KECCAK256_TOOL]</h2>
          <p className="text-[12px] text-[var(--terminal-text-secondary)] mt-1">Compute hash and selector from UTF-8 text</p>
        </div>
        <span className="terminal-chip">HASHING</span>
      </div>

      <div className="terminal-panel-body space-y-4">
        <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 space-y-3">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[INPUT_TEXT]</p>
          <textarea
            id="keccak-input"
            name="keccak-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="terminal-input font-mono text-[13px] resize-none"
            placeholder="transfer(address,uint256)"
            rows={5}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex gap-2">
          <button className="terminal-btn terminal-btn-primary flex-1" onClick={handleHash}>
            <Hash size={14} aria-hidden="true" />
            <span>GENERATE_HASH</span>
          </button>
          <button
            className="terminal-btn terminal-btn-secondary"
            onClick={() => { setInput(""); setHash(""); }}
          >
            CLEAR
          </button>
        </div>

        {hash && (
          <animated.div style={resultSpring} className="space-y-3">
            <div className="border border-[var(--terminal-separator)]">
              <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[FULL_HASH]</span>
                <button
                  onClick={() => copyToClipboard(hash)}
                  className="terminal-btn terminal-btn-secondary h-7 px-2"
                  aria-label="复制完整哈希"
                >
                  <Copy size={12} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
                </button>
              </div>
              <p className="p-3 text-[13px] font-mono break-all text-[var(--terminal-text)]">{hash}</p>
            </div>

            <div className="border border-[var(--terminal-blue)]/25 bg-[var(--terminal-blue)]/5">
              <div className="px-3 py-2 border-b border-[var(--terminal-blue)]/20 flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-blue)]">[SELECTOR_4_BYTES]</p>
                <button
                  onClick={() => copyToClipboard(hash.slice(0, 10))}
                  className="terminal-btn terminal-btn-secondary h-7 px-2"
                  aria-label="复制函数选择器"
                >
                  <Copy size={12} className="text-[var(--terminal-blue)]" aria-hidden="true" />
                </button>
              </div>
              <p className="p-3 text-[15px] font-mono font-semibold text-[var(--terminal-text)]">{hash.slice(0, 10)}</p>
              <p className="px-3 pb-3 text-[12px] text-[var(--terminal-text-secondary)]">
                First 4 bytes of Keccak256, commonly used as function selector.
              </p>
            </div>
          </animated.div>
        )}
      </div>
    </animated.div>
  );
}
