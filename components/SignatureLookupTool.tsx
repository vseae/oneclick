"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Search, Database, Globe, AlertTriangle, Copy } from "lucide-react";
import { useSpring, animated } from "react-spring";
import { toast } from "sonner";
import {
  lookupSignatureCandidates,
  type SignatureCandidate,
  type SignatureCandidateKind,
  type SignatureLookupError,
  type SignatureLookupResult,
} from "@/lib/signature-lookup";

function candidateKindLabel(kind: SignatureCandidateKind): string {
  if (kind === "event") return "事件";
  if (kind === "error") return "Error";
  if (kind === "ambiguous") return "函数/Error";
  return "函数";
}

function candidateKindClass(kind: SignatureCandidateKind): string {
  if (kind === "event") {
    return "border-[var(--terminal-blue)]/40 text-[var(--terminal-blue)]";
  }
  if (kind === "error") {
    return "border-[var(--terminal-red)]/40 text-[var(--terminal-red)]";
  }
  if (kind === "ambiguous") {
    return "border-[var(--terminal-orange)]/40 text-[var(--terminal-orange)]";
  }
  return "border-[var(--terminal-green)]/40 text-[var(--terminal-green)]";
}

function CandidateKindBadge({ kind }: { kind: SignatureCandidateKind }) {
  return (
    <span
      className={`shrink-0 border px-1.5 py-0.5 text-[10px] leading-none tracking-[0.04em] ${candidateKindClass(kind)}`}
    >
      {candidateKindLabel(kind)}
    </span>
  );
}

function sourceLabel(source: SignatureCandidate["source"]): string {
  if (source === "local") return "本地 ABI";
  if (source === "4byte") return "4byte.directory";
  return "4byte.sourcify.dev";
}

function sourceIcon(source: SignatureCandidate["source"]) {
  if (source === "local") {
    return <Database size={12} className="text-[var(--terminal-green)]" aria-hidden="true" />;
  }
  return <Globe size={12} className="text-[var(--terminal-blue)]" aria-hidden="true" />;
}

function sourceLink(source: SignatureCandidate["source"], normalizedHex: string): string | null {
  if (source === "4byte") {
    return `https://www.4byte.directory/signatures/?bytes4_signature=${encodeURIComponent(normalizedHex)}`;
  }
  if (source === "sourcify") {
    return `https://4byte.sourcify.dev/?query=${encodeURIComponent(normalizedHex)}`;
  }
  return null;
}

function sourceErrorLabel(source: SignatureLookupError["source"]): string {
  if (source === "local") return "本地 ABI";
  if (source === "4byte") return "4byte.directory";
  return "4byte.sourcify.dev";
}

export default function SignatureLookupTool() {
  const { chainId } = useAccount();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SignatureLookupResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const grouped = useMemo(() => {
    if (!result) {
      return {
        local: [] as SignatureCandidate[],
        remote: [] as SignatureCandidate[],
      };
    }

    return {
      local: result.candidates.filter((item) => item.source === "local"),
      remote: result.candidates.filter((item) => item.source !== "local"),
    };
  }, [result]);

  const copySignature = async (signature: string) => {
    try {
      await navigator.clipboard.writeText(signature);
      toast.success("已复制签名");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  const handleLookup = async () => {
    if (!input.trim()) {
      toast.error("请输入签名或 Topic");
      return;
    }
    if (!chainId) {
      toast.error("请先连接钱包并选择网络");
      return;
    }

    setLoading(true);
    setQueryError(null);

    try {
      const data = await lookupSignatureCandidates(input, chainId);
      setResult(data);
      if (data.candidates.length === 0) {
        toast.warning("未找到匹配签名");
      } else {
        toast.success(`找到 ${data.candidates.length} 条候选签名`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResult(null);
      setQueryError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput("");
    setResult(null);
    setQueryError(null);
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <div className="terminal-panel-header flex items-center justify-between gap-3">
        <div>
          <h2 className="terminal-section-title">[SIGNATURE_LOOKUP]</h2>
          <p className="mt-1 text-[12px] text-[var(--terminal-text-secondary)]">
            根据 4 字节选择器或 32 字节 Topic 反查函数/事件签名
          </p>
        </div>
        <span className="terminal-chip">4BYTE / TOPIC</span>
      </div>

      <div className="terminal-panel-body space-y-4">
        <div className="space-y-3 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
            [INPUT_SIGNATURE]
          </p>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--terminal-text-secondary)]"
              aria-hidden="true"
            />
            <input
              id="signature-lookup-input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="示例: 0xa9059cbb 或 0xddf252ad..."
              className="terminal-input terminal-input-search font-mono text-[13px]"
              aria-label="输入签名或 Topic"
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading) {
                  void handleLookup();
                }
              }}
            />
          </div>
          <p className="text-[11px] text-[var(--terminal-text-secondary)]">
            支持 0x + 8 位函数/Error 选择器，或 0x + 64 位事件 Topic。
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleLookup()}
            className="terminal-btn terminal-btn-primary flex-1"
            disabled={loading}
          >
            <Search size={14} aria-hidden="true" />
            <span>{loading ? "查询中…" : "开始反查"}</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="terminal-btn terminal-btn-secondary"
            disabled={loading}
          >
            清空
          </button>
        </div>

        {queryError && (
          <div
            className="border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-3 text-[12px] text-[var(--terminal-red)]"
            role="alert"
          >
            {queryError}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="space-y-1 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 text-[12px]">
              <p className="text-[var(--terminal-text-secondary)]">
                类型:{" "}
                <span className="font-medium text-[var(--terminal-text)]">
                  {result.normalized.kind === "event" ? "Event Topic" : "Function / Error Selector"}
                </span>
              </p>
              <p className="break-all font-mono text-[var(--terminal-text-secondary)]">
                规范化签名: <span className="text-[var(--terminal-text)]">{result.normalized.hex}</span>
              </p>
              {result.normalized.kind === "function" && (
                <p className="text-[11px] text-[var(--terminal-text-secondary)]">
                  4 字节选择器在远端无法区分函数与 Error，标为“函数/Error”；本地 ABI 可精确识别。
                </p>
              )}
            </div>

            <section className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                [LOCAL_MATCH]
              </h3>
              {grouped.local.length === 0 ? (
                <p className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 text-[13px] text-[var(--terminal-text-secondary)]">
                  本地未匹配到签名
                </p>
              ) : (
                <div className="divide-y divide-[var(--terminal-separator)] border border-[var(--terminal-separator)]">
                  {grouped.local.map((item, index) => (
                    <div
                      key={`local-${index}-${item.kind}-${item.name}`}
                      className="flex items-start justify-between gap-2 bg-[var(--terminal-card)] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CandidateKindBadge kind={item.kind} />
                          <p className="break-all font-mono text-[13px] text-[var(--terminal-text)]">{item.name}</p>
                        </div>
                        {item.extra && (
                          <p className="mt-1 break-all text-[12px] text-[var(--terminal-text-secondary)]">{item.extra}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="terminal-btn terminal-btn-secondary h-7 shrink-0 px-2"
                        onClick={() => void copySignature(item.name)}
                        aria-label={`复制签名 ${item.name}`}
                      >
                        <Copy size={12} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                [REMOTE_MATCH]
              </h3>
              {grouped.remote.length === 0 ? (
                <p className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 text-[13px] text-[var(--terminal-text-secondary)]">
                  远端未匹配到签名
                </p>
              ) : (
                <div className="divide-y divide-[var(--terminal-separator)] border border-[var(--terminal-separator)]">
                  {grouped.remote.map((item, index) => {
                    const link = sourceLink(item.source, result.normalized.hex);
                    return (
                      <div key={`remote-${index}-${item.source}-${item.kind}-${item.name}`} className="bg-[var(--terminal-card)] p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {sourceIcon(item.source)}
                          <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--terminal-text-secondary)]">
                            {sourceLabel(item.source)}
                          </span>
                          <CandidateKindBadge kind={item.kind} />
                        </div>
                        <p className="break-all font-mono text-[13px] text-[var(--terminal-text)]">{item.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="terminal-btn terminal-btn-secondary h-7 px-2 text-[11px]"
                            onClick={() => void copySignature(item.name)}
                          >
                            <Copy size={11} aria-hidden="true" />
                            <span>复制</span>
                          </button>
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[var(--terminal-blue)] underline underline-offset-2"
                            >
                              查看来源
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {result.errors.length > 0 && (
              <div className="space-y-1 border border-[var(--terminal-orange)]/40 bg-[var(--terminal-orange)]/5 p-3 text-[12px]">
                <div className="flex items-center gap-1.5 text-[var(--terminal-orange)]">
                  <AlertTriangle size={12} aria-hidden="true" />
                  <span className="font-medium">部分来源查询失败</span>
                </div>
                {result.errors.map((item, index) => (
                  <p key={`error-${index}`} className="break-all text-[var(--terminal-text-secondary)]">
                    {sourceErrorLabel(item.source)}: {item.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </animated.div>
  );
}
