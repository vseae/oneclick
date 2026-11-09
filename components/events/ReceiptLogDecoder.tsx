"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Abi, Hex } from "viem";
import { normalizeAbi } from "@/lib/abi";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useSpring, animated } from "react-spring";
import {
  ChevronDown,
  ChevronUp,
  Database,
  Edit3,
  FileSearch,
  ScrollText,
} from "lucide-react";
import { decodeRawLogWithAbi } from "@/lib/event-log";
import { listContractsByChainId } from "@/lib/local-store";
import { useWalletClients } from "@/lib/use-wallet-clients";
import { copyToClipboard, shortenHash, SummaryRow } from "./log-shared";

interface SavedContract {
  id: number;
  name: string;
  address: string;
  abi: Abi;
  chainId: number;
}

interface DecodedParam {
  name: string;
  type: string;
  indexed: boolean | null;
  hashed: boolean;
  value: string;
}

interface ParsedLog {
  name: string;
  signature: string;
  address: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  params: DecodedParam[];
}

interface ReceiptSummary {
  from: string;
  to: string;
  blockNumber: number;
  status: string;
  decodedCount: number;
  unmatchedCount: number;
}

const EVENT_COLORS = [
  { color: "var(--terminal-blue)", bg: "var(--terminal-blue)" },
  { color: "var(--terminal-green)", bg: "var(--terminal-green)" },
  { color: "var(--terminal-orange)", bg: "var(--terminal-orange)" },
  { color: "var(--terminal-red)", bg: "var(--terminal-red)" },
];

function getEventColor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index++) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

function LogItem({ log }: { log: ParsedLog }) {
  const [expanded, setExpanded] = useState(false);
  const eventColor = getEventColor(log.name);

  const contentSpring = useSpring({
    maxHeight: expanded ? 600 : 0,
    opacity: expanded ? 1 : 0,
    config: { tension: 280, friction: 24 },
  });

  return (
    <div className="border border-[var(--terminal-separator)] overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--terminal-hover)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] focus-visible:outline-offset-[-2px]"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-[12px] font-mono text-[var(--terminal-text-secondary)] shrink-0 tabular-nums">
            #{log.logIndex}
          </span>
          <span
            className="text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 border shrink-0 uppercase"
            style={{
              backgroundColor: `color-mix(in srgb, ${eventColor.bg} 15%, transparent)`,
              color: eventColor.color,
            }}
          >
            {log.name}
          </span>
          <code className="text-[12px] font-mono text-[var(--terminal-text-secondary)] truncate">
            {shortenHash(log.address)}
          </code>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-[var(--terminal-text-secondary)] shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="text-[var(--terminal-text-secondary)] shrink-0" aria-hidden="true" />
        )}
      </button>

      <animated.div style={contentSpring} className="overflow-hidden">
        <div className="px-4 pb-4 space-y-3">
          <div className="text-[12px] text-[var(--terminal-text-secondary)] space-y-1">
            <p className="font-mono break-all">Signature: {log.signature}</p>
            <p className="font-mono break-all">Address: {log.address}</p>
            <p className="font-mono break-all">Tx: {log.transactionHash}</p>
          </div>

          <div className="border border-[var(--terminal-separator)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--terminal-fill)]">
                  <th className="text-left px-3 py-2 text-[12px] font-medium text-[var(--terminal-text-secondary)]">参数名</th>
                  <th className="text-left px-3 py-2 text-[12px] font-medium text-[var(--terminal-text-secondary)]">类型</th>
                  <th className="text-left px-3 py-2 text-[12px] font-medium text-[var(--terminal-text-secondary)]">值</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--terminal-separator)]">
                {log.params.map((param, index) => (
                  <tr key={`${param.name}-${index}`} className="hover:bg-[var(--terminal-hover)] transition-colors">
                    <td className="px-3 py-2 font-mono text-[var(--terminal-text)]">
                      {param.name}
                      {param.indexed && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 border border-[var(--terminal-blue)]/30 bg-[var(--terminal-blue)]/10 text-[var(--terminal-blue)]">
                          indexed
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[var(--terminal-text-secondary)]">{param.type}</td>
                    <td className="px-3 py-2 font-mono text-[var(--terminal-text)] break-all">
                      {param.hashed && (
                        <span className="mr-1.5 text-[10px] px-1.5 py-0.5 border border-[var(--terminal-orange)]/30 bg-[var(--terminal-orange)]/10 text-[var(--terminal-orange)]">
                          hash
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(param.value)}
                        className="text-left break-all hover:text-[var(--terminal-blue)] transition-colors cursor-pointer"
                      >
                        {param.value}
                      </button>
                    </td>
                  </tr>
                ))}
                {log.params.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-[var(--terminal-text-secondary)]">
                      该事件无参数
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </animated.div>
    </div>
  );
}

export default function ReceiptLogDecoder() {
  const { chainId } = useAccount();
  const { publicClient: provider } = useWalletClients();
  const [mode, setMode] = useState<"saved" | "manual">("saved");
  const [contracts, setContracts] = useState<SavedContract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [contractsLoading, setContractsLoading] = useState(false);
  const [manualAbi, setManualAbi] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [queried, setQueried] = useState(false);

  const resultSpring = useSpring({
    opacity: queried ? 1 : 0,
    transform: queried ? "translateY(0px)" : "translateY(4px)",
    config: { tension: 300, friction: 26 },
  });

  useEffect(() => {
    if (mode !== "saved") return;
    if (!chainId) {
      setContracts([]);
      setSelectedContractId("");
      return;
    }

    setContractsLoading(true);
    listContractsByChainId(chainId)
      .then((data) => {
        if (Array.isArray(data)) {
          setContracts(data);
        }
      })
      .catch(() => toast.error("[LOAD_FAILED] 加载合约列表失败"))
      .finally(() => setContractsLoading(false));
  }, [mode, chainId]);

  const currentAbi = useMemo(() => {
    if (mode === "saved") {
      const contract = contracts.find((item) => String(item.id) === selectedContractId);
      return contract?.abi ?? null;
    }

    if (!manualAbi.trim()) return null;
    try {
      return JSON.parse(manualAbi);
    } catch {
      return null;
    }
  }, [contracts, manualAbi, mode, selectedContractId]);

  const handleDecode = useCallback(async () => {
    const trimmedHash = txHash.trim();
    if (!trimmedHash || !/^0x([A-Fa-f0-9]{64})$/.test(trimmedHash)) {
      toast.error("[INVALID_INPUT] 请输入有效的交易哈希（66 位 0x 开头）");
      return;
    }

    if (!currentAbi) {
      toast.error("[INPUT_REQUIRED] 请提供有效的 ABI JSON");
      return;
    }

    if (!provider) {
      toast.error("[WALLET_MISSING] 请先连接钱包");
      return;
    }

    let iface: Abi;
    try {
      iface = normalizeAbi(currentAbi);
    } catch {
      toast.error("[INVALID_INPUT] ABI 格式无效，请检查 JSON 格式");
      return;
    }

    setLoading(true);
    setQueried(false);

    try {
      const [tx, receipt] = await Promise.all([
        provider.getTransaction({ hash: trimmedHash as Hex }),
        provider.getTransactionReceipt({ hash: trimmedHash as Hex }),
      ]);

      if (!tx || !receipt) {
        toast.error("[NOT_FOUND] 交易或回执未找到，请确认当前钱包网络");
        return;
      }

      let unmatchedCount = 0;
      const parsedLogs: ParsedLog[] = [];

      for (const log of receipt.logs) {
        try {
          const parsed = decodeRawLogWithAbi(iface, { topics: [...log.topics], data: log.data });
          parsedLogs.push({
            name: parsed.name,
            signature: parsed.signature,
            address: log.address,
            transactionHash: log.transactionHash,
            blockNumber: Number(log.blockNumber),
            logIndex: log.logIndex,
            params: parsed.params,
          });
        } catch {
          unmatchedCount += 1;
        }
      }

      setLogs(parsedLogs);
      setSummary({
        from: tx.from,
        to: tx.to ?? "Contract Creation",
        blockNumber: Number(receipt.blockNumber),
        status: receipt.status === "success" ? "Success" : "Failed",
        decodedCount: parsedLogs.length,
        unmatchedCount,
      });
      setQueried(true);
      toast.success(`[DECODE_OK] 解析完成，命中 ${parsedLogs.length} 条事件`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      toast.error(`[DECODE_FAILED] 查询事件日志失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [currentAbi, txHash, provider]);

  const handleClear = () => {
    setTxHash("");
    setManualAbi("");
    setSelectedContractId("");
    setLogs([]);
    setSummary(null);
    setQueried(false);
  };

  return (
    <div className="space-y-4">
      <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 space-y-3">
        <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[TRANSACTION_HASH]</p>
        <div className="terminal-prompt-wrap">
          <input
            id="event-tx-hash"
            name="event-tx-hash"
            type="text"
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            className="terminal-input font-mono text-[13px]"
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="border border-[var(--terminal-separator)]">
        <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)]">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
            [ABI_SOURCE]
          </p>
        </div>
        <div className="p-3 space-y-3">
          <div className="flex gap-1 p-1 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]" role="tablist" aria-label="ABI 来源">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "saved"}
              onClick={() => setMode("saved")}
              className={`flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                mode === "saved"
                  ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                  : "border-transparent text-[var(--terminal-text-secondary)]"
              }`}
            >
              <Database size={13} aria-hidden="true" />
              SAVED
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "manual"}
              onClick={() => setMode("manual")}
              className={`flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                mode === "manual"
                  ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                  : "border-transparent text-[var(--terminal-text-secondary)]"
              }`}
            >
              <Edit3 size={13} aria-hidden="true" />
              MANUAL
            </button>
          </div>

          {mode === "saved" ? (
            <div>
              <label htmlFor="saved-contract-select" className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                Select Contract ABI
              </label>
              <select
                id="saved-contract-select"
                name="saved-contract-select"
                value={selectedContractId}
                onChange={(event) => setSelectedContractId(event.target.value)}
                className="terminal-input cursor-pointer text-[13px]"
                disabled={contractsLoading}
              >
                <option value="">{contractsLoading ? "Loading..." : "Select contract..."}</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={String(contract.id)}>
                    {contract.name} ({shortenHash(contract.address)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="manual-abi" className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                ABI JSON
              </label>
              <textarea
                id="manual-abi"
                name="manual-abi"
                value={manualAbi}
                onChange={(event) => setManualAbi(event.target.value)}
                className="terminal-input font-mono text-[13px] resize-none"
                rows={6}
                placeholder="Paste ABI JSON array..."
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="terminal-btn terminal-btn-primary flex-1"
          onClick={handleDecode}
          disabled={loading}
        >
          {loading ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FileSearch size={14} aria-hidden="true" />
          )}
          <span>{loading ? "DECODING..." : "DECODE_EVENTS"}</span>
        </button>
        <button type="button" className="terminal-btn terminal-btn-secondary" onClick={handleClear}>
          CLEAR
        </button>
      </div>

      {queried && summary && (
        <animated.div style={resultSpring} className="space-y-4">
          <div className="border border-[var(--terminal-separator)]">
            <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center gap-2">
              <ScrollText size={14} className="text-[var(--terminal-blue)]" aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[RECEIPT_SUMMARY]</span>
            </div>
            <div className="p-3 space-y-0">
              <SummaryRow label="Tx Hash" value={txHash.trim()} />
              <SummaryRow label="From" value={summary.from} />
              <SummaryRow label="To" value={summary.to} />
              <SummaryRow label="Block" value={summary.blockNumber.toString()} />
              <SummaryRow label="Status" value={summary.status} />
              <SummaryRow label="Decoded Logs" value={summary.decodedCount.toString()} />
              <SummaryRow label="Unmatched Logs" value={summary.unmatchedCount.toString()} />
            </div>
          </div>

          {logs.length > 0 ? (
            <div className="border border-[var(--terminal-separator)]">
              <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[DECODED_LOGS]</span>
                <span className="terminal-chip">{logs.length}</span>
              </div>
              <div className="p-3 space-y-3">
                {logs.map((log) => (
                  <LogItem key={`${log.transactionHash}-${log.logIndex}-${log.signature}`} log={log} />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)] text-[13px] text-[var(--terminal-text-secondary)]">
              [EMPTY_RESULT] 未匹配到当前 ABI 可解析的事件。
            </div>
          )}

          {summary.unmatchedCount > 0 && (
            <div className="p-4 bg-[var(--terminal-orange)]/5 border border-[var(--terminal-orange)]/20 text-[13px] text-[var(--terminal-text-secondary)]">
              有 {summary.unmatchedCount} 条日志未能被当前 ABI 解析，通常表示这笔交易还触发了其他合约事件，或者 ABI 不完整。
            </div>
          )}
        </animated.div>
      )}
    </div>
  );
}
