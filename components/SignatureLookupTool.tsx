"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Search, Database, Globe, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  lookupSignatureCandidates,
  type SignatureCandidate,
  type SignatureLookupError,
  type SignatureLookupResult,
} from "@/lib/signature-lookup";

function sourceLabel(source: SignatureCandidate["source"]): string {
  if (source === "local") return "本地 ABI";
  if (source === "4byte") return "4byte.directory";
  return "4byte.sourcify.dev";
}

function sourceIcon(source: SignatureCandidate["source"]) {
  if (source === "local") {
    return <Database size={12} className="text-[var(--apple-green)]" aria-hidden="true" />;
  }
  return <Globe size={12} className="text-[var(--apple-blue)]" aria-hidden="true" />;
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
    <div className="apple-card">
      <div className="p-4 border-b border-[var(--apple-separator)]">
        <h2 className="text-[14px] font-bold tracking-[0.1em] uppercase">签名反查</h2>
        <p className="text-[13px] text-[var(--apple-text-secondary)] mt-1">
          根据 4 字节选择器或 32 字节 Topic 反查函数/事件签名
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="signature-lookup-input" className="block text-[13px] font-medium text-[var(--apple-text-secondary)]">
            输入签名
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--apple-text-secondary)]"
              aria-hidden="true"
            />
            <input
              id="signature-lookup-input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="示例: 0xa9059cbb 或 0xddf252ad..."
              className="apple-input pl-8 font-mono"
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading) {
                  void handleLookup();
                }
              }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => void handleLookup()} className="apple-btn apple-btn-primary flex-1" disabled={loading}>
            <Search size={13} aria-hidden="true" />
            <span>{loading ? "查询中…" : "开始反查"}</span>
          </button>
          <button type="button" onClick={handleReset} className="apple-btn apple-btn-secondary" disabled={loading}>
            清空
          </button>
        </div>

        {queryError && (
          <div className="p-3 border border-[var(--apple-red)]/50 bg-[var(--apple-red)]/10 text-[13px] text-[var(--apple-red)]">
            {queryError}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="p-3 border border-[var(--apple-separator)] bg-[var(--apple-fill)] space-y-1 text-[12px]">
              <p className="text-[var(--apple-text-secondary)]">
                类型: <span className="text-[var(--apple-text)] font-medium">{result.normalized.kind === "event" ? "Event Topic" : "Function / Error Selector"}</span>
              </p>
              <p className="text-[var(--apple-text-secondary)] font-mono break-all">
                规范化签名: <span className="text-[var(--apple-text)]">{result.normalized.hex}</span>
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-[12px] font-bold tracking-[0.08em] uppercase text-[var(--apple-text-secondary)]">本地匹配</h3>
              {grouped.local.length === 0 ? (
                <p className="text-[13px] text-[var(--apple-text-secondary)] border border-[var(--apple-separator)] p-3 bg-[var(--apple-fill)]">
                  本地未匹配到签名
                </p>
              ) : (
                <div className="divide-y divide-[var(--apple-separator)] border border-[var(--apple-separator)]">
                  {grouped.local.map((item, index) => (
                    <div key={`local-${index}-${item.name}`} className="p-3 flex items-start justify-between gap-2 bg-[var(--apple-card)]">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[13px] break-all text-[var(--apple-text)]">{item.name}</p>
                        {item.extra && (
                          <p className="text-[12px] text-[var(--apple-text-secondary)] mt-1 break-all">{item.extra}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="w-7 h-7 border border-[var(--apple-separator)] bg-[var(--apple-fill)] flex items-center justify-center hover:bg-[var(--apple-hover)]"
                        onClick={() => {
                          navigator.clipboard.writeText(item.name);
                          toast.success("已复制签名");
                        }}
                        aria-label="复制签名"
                      >
                        <Copy size={12} className="text-[var(--apple-text-secondary)]" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-[12px] font-bold tracking-[0.08em] uppercase text-[var(--apple-text-secondary)]">远端匹配</h3>
              {grouped.remote.length === 0 ? (
                <p className="text-[13px] text-[var(--apple-text-secondary)] border border-[var(--apple-separator)] p-3 bg-[var(--apple-fill)]">
                  远端未匹配到签名
                </p>
              ) : (
                <div className="divide-y divide-[var(--apple-separator)] border border-[var(--apple-separator)]">
                  {grouped.remote.map((item, index) => {
                    const link = sourceLink(item.source, result.normalized.hex);
                    return (
                      <div key={`remote-${index}-${item.source}-${item.name}`} className="p-3 bg-[var(--apple-card)]">
                        <div className="flex items-center gap-2 mb-1">
                          {sourceIcon(item.source)}
                          <span className="text-[11px] tracking-[0.06em] uppercase text-[var(--apple-text-secondary)]">
                            {sourceLabel(item.source)}
                          </span>
                        </div>
                        <p className="font-mono text-[13px] break-all text-[var(--apple-text)]">{item.name}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            className="apple-btn apple-btn-secondary text-[11px] py-1 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(item.name);
                              toast.success("已复制签名");
                            }}
                          >
                            <Copy size={11} aria-hidden="true" />
                            <span>复制</span>
                          </button>
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-[var(--apple-blue)] underline underline-offset-2"
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
            </div>

            {result.errors.length > 0 && (
              <div className="p-3 border border-[var(--apple-orange)]/50 bg-[var(--apple-orange)]/10 text-[12px] space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--apple-orange)]">
                  <AlertTriangle size={12} aria-hidden="true" />
                  <span className="font-medium">部分来源查询失败</span>
                </div>
                {result.errors.map((item, index) => (
                  <p key={`error-${index}`} className="text-[var(--apple-text-secondary)] break-all">
                    {sourceErrorLabel(item.source)}: {item.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
