"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clearHistory as clearLocalHistory, type LocalHistoryRecord } from "@/lib/local-store";
import { historyKeys, useHistory } from "@/lib/queries";
import { useSpring, animated, useTrail } from "react-spring";
import { Trash2, Clock } from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import ValueDisplay from "@/components/ValueDisplay";
import { formatAmount } from "@/lib/convert";
import ValueDecimalsControl from "@/components/ValueDecimalsControl";

export default function HistoryView() {
  const { chainId } = useAccount();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();
  const { data: history = [], isPending, error } = useHistory(chainId);
  const [methodFilter, setMethodFilter] = useState<"all" | "read" | "write">("all");

  useEffect(() => {
    if (error) {
      console.error("获取历史失败:", error);
      toast.error("获取历史记录失败");
    }
  }, [error]);

  const clearHistory = async () => {
    if (!chainId) return;
    if (!confirm("确定清空当前网络历史记录？")) return;
    try {
      await clearLocalHistory(undefined, chainId);
      queryClient.setQueryData<LocalHistoryRecord[]>(historyKeys.byChain(chainId), []);
      toast.success("历史记录已清空");
    } catch {
      toast.error("清空失败");
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (methodFilter !== "all" && item.methodType !== methodFilter) return false;
      return true;
    });
  }, [history, methodFilter]);

  const trail = useTrail(filteredHistory.length, {
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    config: { tension: 280, friction: 24 },
    immediate: reducedMotion,
  });

  const fadeIn = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { duration: 300 },
    immediate: reducedMotion,
  });

  const formatTime = (timestamp: string) => {
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).format(new Date(timestamp));
    } catch { return timestamp; }
  };

  if (isPending) {
    return (
      <div
        id="system-logs"
        role="region"
        aria-label="系统日志"
        className="terminal-card scroll-mt-20 p-16 flex items-center justify-center"
        aria-live="polite"
      >
        <div className="w-6 h-6 border-2 border-[var(--terminal-blue)] border-t-transparent rounded-full animate-spin" role="status">
          <span className="sr-only">加载中…</span>
        </div>
      </div>
    );
  }

  return (
    <animated.div
      id="system-logs"
      role="region"
      aria-label="系统日志"
      style={fadeIn}
      className="terminal-card scroll-mt-20 bg-[var(--terminal-card)]"
    >
      <div className="border-b border-[var(--terminal-separator)] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="terminal-section-title">[SYSTEM_LOGS]</h2>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <ValueDecimalsControl />
            {history.length > 0 && (
              <button onClick={clearHistory} className="terminal-btn terminal-btn-secondary text-[var(--terminal-red)]">
                <Trash2 size={14} aria-hidden="true" />
                <span>清空</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="日志筛选"
            className="flex gap-1 p-1 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]"
          >
            {(["all", "read", "write"] as const).map((type) => (
              <button
                key={type}
                aria-pressed={methodFilter === type}
                onClick={() => setMethodFilter(type)}
                className={`px-3 py-1.5 text-[11px] font-medium tracking-[0.01em] transition-colors cursor-pointer border ${
                  methodFilter === type
                    ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                    : "border-transparent text-[var(--terminal-text-secondary)]"
                }`}
              >
                {type === "all" ? "ALL" : type === "read" ? "READ" : "WRITE"}
              </button>
            ))}
          </div>
          <span className="terminal-chip ml-auto">
            {hydrated && chainId ? `Chain ${chainId}` : "未连接"}
          </span>
        </div>
      </div>

      <div
        className={
          history.length > 0
            ? "terminal-scroll max-h-[460px] overflow-y-auto p-1"
            : "p-1"
        }
      >
        {history.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-center mx-auto mb-3" aria-hidden="true">
              <Clock size={20} className="text-[var(--terminal-text-secondary)]" />
            </div>
            <p className="text-[15px] font-medium">暂无日志记录</p>
            <p className="text-[13px] text-[var(--terminal-text-secondary)] mt-1">执行合约读写后会实时写入此区域</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-center mx-auto mb-3" aria-hidden="true">
              <Clock size={20} className="text-[var(--terminal-text-secondary)]" />
            </div>
            <p className="text-[15px] font-medium">无匹配日志</p>
            <p className="text-[13px] text-[var(--terminal-text-secondary)] mt-1">请调整筛选条件后重试</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--terminal-separator)]">
            {trail.map((style, i) => {
              const item = filteredHistory[i];
              return (
                <animated.div key={item.id} style={style} className="p-4 hover:bg-[var(--terminal-hover)] transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[14px] font-medium truncate">{item.contractName}</span>
                      <span className={`text-[10px] font-medium tracking-[0.08em] px-2 py-0.5 border shrink-0  ${
                        item.methodType === "read"
                          ? "border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 text-[var(--terminal-green)]"
                          : "border-[var(--terminal-blue)]/40 bg-[var(--terminal-blue)]/10 text-[var(--terminal-blue)]"
                      }`}>
                        {item.methodType === "read" ? "Read" : "Write"}
                      </span>
                    </div>
                    <span className="text-[12px] text-[var(--terminal-text-secondary)] tabular-nums shrink-0 ml-2">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="mb-1 text-[13px] font-mono text-[var(--terminal-text-secondary)] truncate">[{item.methodName}]</p>
                  {item.params.length > 0 && (
                    <p className="text-[12px] text-[var(--terminal-text-secondary)] truncate">PARAMS: {JSON.stringify(item.params)}</p>
                  )}
                  {item.value && (
                    <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                      VALUE: {formatAmount(BigInt(item.value), 18)} ETH
                      <span className="ml-1 font-mono opacity-60">({item.value} wei)</span>
                    </p>
                  )}
                  {item.result && (
                    <div className="mt-1 text-[12px] text-[var(--terminal-green)] break-all">
                      RESULT: <ValueDisplay value={item.result} />
                    </div>
                  )}
                  {item.error && (
                    <p className="mt-1 text-[12px] text-[var(--terminal-red)] break-all">ERROR: {item.error}</p>
                  )}
                  {item.txHash && (
                    <p className="text-[12px] font-mono text-[var(--terminal-text-secondary)] mt-1 truncate">
                      Tx: {item.txHash.slice(0, 10)}&hellip;{item.txHash.slice(-8)}
                    </p>
                  )}
                </animated.div>
              );
            })}
          </div>
        )}
      </div>
    </animated.div>
  );
}
