"use client";

import { useRef, useState } from "react";
import type { InterfaceAbi } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useSpring, animated } from "react-spring";
import {
  AlertTriangle,
  Braces,
  Copy,
  Database,
  Edit3,
  FileSearch,
  Fingerprint,
  ScrollText,
} from "lucide-react";
import {
  decodeRawLogWithAbi,
  decodeRawLogWithLocalAbis,
  decodeRawLogWithSignature,
  normalizeRawLogInput,
  type DecodedRawEvent,
  type RawEventDecodeSource,
  type RawEventLog,
} from "@/lib/event-log";
import {
  lookupRemoteSignatureCandidates,
  lookupSignatureCandidates,
  type SignatureCandidate,
  type SignatureLookupError,
} from "@/lib/signature-lookup";
import { useContracts } from "@/lib/queries";
import { copyToClipboard, shortenHash, SummaryRow } from "./log-shared";

type SignatureSourceMode = "4bytes" | "abi";
type AbiSourceMode = "saved" | "manual";

const TOPIC_FIELDS = 4;
const MAX_DECODED_RESULTS = 8;
const MAX_LISTED_CANDIDATES = 12;

const SOURCE_META: Record<RawEventDecodeSource, { label: string; className: string }> = {
  abi: {
    label: "ABI",
    className: "border-[var(--terminal-blue)]/40 bg-[var(--terminal-blue)]/10 text-[var(--terminal-blue)]",
  },
  local: {
    label: "LOCAL_ABI",
    className: "border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 text-[var(--terminal-green)]",
  },
  "4byte": {
    label: "4BYTE",
    className: "border-[var(--terminal-orange)]/40 bg-[var(--terminal-orange)]/10 text-[var(--terminal-orange)]",
  },
  sourcify: {
    label: "SOURCIFY",
    className: "border-[var(--terminal-purple)]/40 bg-[var(--terminal-purple)]/10 text-[var(--terminal-purple)]",
  },
};

function segmentClass(active: boolean): string {
  return `flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
    active
      ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
      : "border-transparent text-[var(--terminal-text-secondary)]"
  }`;
}

function sourceErrorLabel(source: SignatureLookupError["source"]): string {
  if (source === "local") return "本地 ABI";
  if (source === "4byte") return "4byte.directory";
  return "4byte.sourcify.dev";
}

interface SignatureLookupOutcome {
  local: boolean;
  results: DecodedRawEvent[];
  candidates: string[];
  errors: SignatureLookupError[];
  error: string | null;
}

function uniqueCandidates(candidates: SignatureCandidate[]): SignatureCandidate[] {
  const seen = new Set<string>();
  const unique: SignatureCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function DecodedEventCard({ event }: { event: DecodedRawEvent }) {
  const meta = SOURCE_META[event.source];

  return (
    <div className="border border-[var(--terminal-separator)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] px-3 py-2">
        <span className={`border px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] ${meta.className}`}>
          {meta.label}
        </span>
        <span className="font-mono text-[13px] font-medium text-[var(--terminal-text)]">{event.name}</span>
        {event.contractName && (
          <span className="min-w-0 truncate text-[11px] text-[var(--terminal-text-secondary)]">
            {event.contractName}
            {event.contractAddress ? ` (${shortenHash(event.contractAddress)})` : ""}
          </span>
        )}
        <button
          type="button"
          className="terminal-btn terminal-btn-secondary ml-auto h-7 shrink-0 px-2 text-[11px]"
          onClick={() => copyToClipboard(event.fullSignature)}
        >
          <Copy size={11} aria-hidden="true" />
          <span>签名</span>
        </button>
      </div>

      <div className="space-y-3 p-3">
        <code className="block break-all font-mono text-[12px] text-[var(--terminal-text-secondary)]">
          {event.fullSignature}
        </code>

        {(event.source === "4byte" || event.source === "sourcify") && (
          <p
            className={`text-[11px] leading-relaxed ${
              event.layoutAmbiguous
                ? "border border-[var(--terminal-orange)]/30 bg-[var(--terminal-orange)]/5 px-2 py-1.5 text-[var(--terminal-orange)]"
                : "text-[var(--terminal-text-secondary)]"
            }`}
          >
            indexed 参数位置由 Topic 数量推断
            {event.layoutAmbiguous
              ? "，且存在多种可解码布局；当前展示按“indexed 参数靠前”推断的一种，参数顺序可能错位。"
              : "。"}
            如需精确结果请使用 ABI 模式。
          </p>
        )}

        <div className="overflow-x-auto border border-[var(--terminal-separator)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--terminal-fill)]">
                <th className="px-3 py-2 text-left text-[12px] font-medium text-[var(--terminal-text-secondary)]">参数名</th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-[var(--terminal-text-secondary)]">类型</th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-[var(--terminal-text-secondary)]">值</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--terminal-separator)]">
              {event.params.map((param, index) => (
                <tr key={`${param.name}-${index}`} className="transition-colors hover:bg-[var(--terminal-hover)]">
                  <td className="px-3 py-2 font-mono text-[var(--terminal-text)]">
                    {param.name}
                    {param.indexed && (
                      <span className="ml-1.5 border border-[var(--terminal-blue)]/30 bg-[var(--terminal-blue)]/10 px-1.5 py-0.5 text-[10px] text-[var(--terminal-blue)]">
                        indexed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[var(--terminal-text-secondary)]">{param.type}</td>
                  <td className="break-all px-3 py-2 font-mono text-[var(--terminal-text)]">
                    {param.hashed && (
                      <span className="mr-1.5 border border-[var(--terminal-orange)]/30 bg-[var(--terminal-orange)]/10 px-1.5 py-0.5 text-[10px] text-[var(--terminal-orange)]">
                        hash
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(param.value)}
                      className="cursor-pointer break-all text-left transition-colors hover:text-[var(--terminal-blue)]"
                    >
                      {param.value}
                    </button>
                  </td>
                </tr>
              ))}
              {event.params.length === 0 && (
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
    </div>
  );
}

export default function RawLogDecoder() {
  const { chainId } = useAccount();
  const { data: contracts, isPending: contractsLoading } = useContracts(chainId);
  const savedContracts = contracts ?? [];

  const [signatureSource, setSignatureSource] = useState<SignatureSourceMode>("4bytes");
  const [abiSource, setAbiSource] = useState<AbiSourceMode>("saved");
  const [selectedContractId, setSelectedContractId] = useState<number | "">("");
  const [manualAbi, setManualAbi] = useState("");
  const [topics, setTopics] = useState<string[]>(Array.from({ length: TOPIC_FIELDS }, () => ""));
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [rawLog, setRawLog] = useState<RawEventLog | null>(null);
  const [results, setResults] = useState<DecodedRawEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [signatureCandidates, setSignatureCandidates] = useState<string[]>([]);
  const [lookupErrors, setLookupErrors] = useState<SignatureLookupError[]>([]);
  const requestIdRef = useRef(0);

  const resultSpring = useSpring({
    opacity: queried ? 1 : 0,
    transform: queried ? "translateY(0px)" : "translateY(4px)",
    config: { tension: 300, friction: 26 },
  });

  const resetResults = () => {
    setQueried(false);
    setRawLog(null);
    setResults([]);
    setError(null);
    setSignatureCandidates([]);
    setLookupErrors([]);
  };

  /** Invalidate any in-flight lookup so late responses cannot overwrite the UI. */
  const cancelPendingDecode = () => {
    requestIdRef.current += 1;
    setLoading(false);
  };

  const changeSignatureSource = (next: SignatureSourceMode) => {
    if (next === signatureSource) return;
    setSignatureSource(next);
    cancelPendingDecode();
    resetResults();
  };

  const changeAbiSource = (next: AbiSourceMode) => {
    if (next === abiSource) return;
    setAbiSource(next);
    cancelPendingDecode();
    resetResults();
  };

  const changeTopic = (index: number, value: string) => {
    setTopics((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const resolveAbi = (): InterfaceAbi | null => {
    if (abiSource === "saved") {
      const contract =
        selectedContractId === "" ? undefined : savedContracts.find((item) => item.id === selectedContractId);
      if (!contract) {
        toast.error("[INPUT_REQUIRED] 请选择一个已保存的合约");
        return null;
      }
      return contract.abi;
    }

    const trimmed = manualAbi.trim();
    if (!trimmed) {
      toast.error("[INPUT_REQUIRED] 请输入 ABI JSON");
      return null;
    }
    try {
      return JSON.parse(trimmed) as InterfaceAbi;
    } catch {
      toast.error("[INVALID_INPUT] ABI JSON 格式无效");
      return null;
    }
  };

  const runSignatureLookup = async (log: RawEventLog): Promise<SignatureLookupOutcome> => {
    const localDecoded = decodeRawLogWithLocalAbis(savedContracts, log);
    if (localDecoded.length > 0) {
      return { local: true, results: localDecoded, candidates: [], errors: [], error: null };
    }

    const lookup = chainId
      ? await lookupSignatureCandidates(log.topics[0], chainId)
      : await lookupRemoteSignatureCandidates(log.topics[0]);
    const errors = lookup.errors.filter((item) => item.source !== "local");

    const candidates = uniqueCandidates(
      lookup.candidates.filter((item) => item.kind === "event" && item.source !== "local")
    );

    const results: DecodedRawEvent[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      if (results.length >= MAX_DECODED_RESULTS) break;
      try {
        const result = decodeRawLogWithSignature(candidate.name, log, candidate.source);
        const key = result.signature.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(result);
      } catch {
        continue;
      }
    }

    return {
      local: false,
      results,
      candidates: candidates.map((item) => item.name),
      errors,
      error:
        results.length > 0
          ? null
          : candidates.length === 0
            ? "未找到与该 Topic0 匹配的事件签名，请检查 Topic 或改用 ABI 模式"
            : "候选事件签名均无法解码该日志：Topic 数量与参数不匹配，或 DATA 不属于这些事件",
    };
  };

  const handleDecode = async () => {
    let log: RawEventLog;
    try {
      log = normalizeRawLogInput({ topics, data });
    } catch (decodeError) {
      const message = decodeError instanceof Error ? decodeError.message : String(decodeError);
      cancelPendingDecode();
      resetResults();
      toast.error(`[INVALID_INPUT] ${message}`);
      return;
    }

    const requestId = ++requestIdRef.current;
    resetResults();
    setRawLog(log);
    setQueried(true);

    if (signatureSource === "abi") {
      const abi = resolveAbi();
      if (!abi) {
        setError("请先提供可用的 ABI");
        return;
      }

      setLoading(true);
      try {
        const decoded = decodeRawLogWithAbi(abi, log);
        setResults([decoded]);
        toast.success(`[DECODE_OK] 事件 ${decoded.name} 解码成功`);
      } catch (decodeError) {
        const message = decodeError instanceof Error ? decodeError.message : String(decodeError);
        setError(message);
        toast.error(`[DECODE_MISS] ${message}`);
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
      return;
    }

    setLoading(true);
    try {
      const outcome = await runSignatureLookup(log);
      if (requestIdRef.current !== requestId) return;

      setResults(outcome.results);
      setSignatureCandidates(outcome.candidates);
      setLookupErrors(outcome.errors);

      if (outcome.error) {
        setError(outcome.error);
        toast.error(`[DECODE_MISS] ${outcome.error}`);
      } else if (outcome.local) {
        toast.success(`[DECODE_OK] 通过本地 ABI 命中 ${outcome.results.length} 个事件`);
      } else {
        toast.success(`[DECODE_OK] 找到 ${outcome.results.length} 种可行解码`);
      }
    } catch (decodeError) {
      if (requestIdRef.current !== requestId) return;
      const message = decodeError instanceof Error ? decodeError.message : String(decodeError);
      setError(message);
      toast.error(`[DECODE_FAILED] ${message}`);
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleClear = () => {
    setTopics(Array.from({ length: TOPIC_FIELDS }, () => ""));
    setData("");
    setManualAbi("");
    setSelectedContractId("");
    cancelPendingDecode();
    resetResults();
  };

  const unresolvedCandidates = Math.max(signatureCandidates.length - results.length, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3">
        <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[RAW_LOG_INPUT]</p>

        <div className="space-y-2">
          {topics.map((topic, index) => (
            <div key={`topic-${index}`}>
              <label
                htmlFor={`raw-log-topic-${index}`}
                className="mb-1.5 block text-[12px] font-medium text-[var(--terminal-text-secondary)]"
              >
                TOPIC_{index}
                {index === 0 ? " · 事件签名哈希" : " · 索引参数哈希（可选）"}
              </label>
              <input
                id={`raw-log-topic-${index}`}
                name={`raw-log-topic-${index}`}
                type="text"
                value={topic}
                onChange={(event) => changeTopic(index, event.target.value)}
                className="terminal-input font-mono text-[12px]"
                placeholder="0x0..."
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}
        </div>

        <div>
          <label
            htmlFor="raw-log-data"
            className="mb-1.5 block text-[12px] font-medium text-[var(--terminal-text-secondary)]"
          >
            DATA · 非 indexed 参数编码
          </label>
          <textarea
            id="raw-log-data"
            name="raw-log-data"
            value={data}
            onChange={(event) => setData(event.target.value)}
            className="terminal-input font-mono text-[12px] resize-none"
            rows={3}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="border border-[var(--terminal-separator)]">
        <div className="border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] px-3 py-2">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
            [SIGNATURE_SOURCE]
          </p>
        </div>
        <div className="space-y-3 p-3">
          <div className="flex gap-1 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-1">
            <button
              type="button"
              aria-pressed={signatureSource === "4bytes"}
              className={segmentClass(signatureSource === "4bytes")}
              onClick={() => changeSignatureSource("4bytes")}
            >
              <Fingerprint size={13} aria-hidden="true" />
              4_BYTES
            </button>
            <button
              type="button"
              aria-pressed={signatureSource === "abi"}
              className={segmentClass(signatureSource === "abi")}
              onClick={() => changeSignatureSource("abi")}
            >
              <Braces size={13} aria-hidden="true" />
              ABI
            </button>
          </div>

          {signatureSource === "4bytes" ? (
            <p className="text-[11px] leading-relaxed text-[var(--terminal-text-secondary)]">
              通过 Topic0 反查事件签名。已导入合约会优先使用本地 ABI 精确解码；否则用 4byte.directory /
              Sourcify 的候选签名，并按 Topic 数量推断 indexed 参数位置。
              {!chainId && " 当前未连接钱包，仅查询远端签名库。"}
            </p>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                [ABI_SOURCE]
              </p>
              <div className="flex gap-1 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-1">
                <button
                  type="button"
                  aria-pressed={abiSource === "saved"}
                  className={segmentClass(abiSource === "saved")}
                  onClick={() => changeAbiSource("saved")}
                >
                  <Database size={13} aria-hidden="true" />
                  SAVED
                </button>
                <button
                  type="button"
                  aria-pressed={abiSource === "manual"}
                  className={segmentClass(abiSource === "manual")}
                  onClick={() => changeAbiSource("manual")}
                >
                  <Edit3 size={13} aria-hidden="true" />
                  MANUAL
                </button>
              </div>

              {abiSource === "saved" ? (
                <div>
                  <label
                    htmlFor="raw-log-contract-select"
                    className="mb-1.5 block text-[12px] font-medium text-[var(--terminal-text-secondary)]"
                  >
                    Select Contract ABI
                  </label>
                  <select
                    id="raw-log-contract-select"
                    name="raw-log-contract-select"
                    value={selectedContractId}
                    onChange={(event) =>
                      setSelectedContractId(event.target.value ? Number(event.target.value) : "")
                    }
                    className="terminal-input cursor-pointer text-[13px]"
                    disabled={contractsLoading}
                  >
                    <option value="">
                      {contractsLoading && chainId ? "Loading..." : "Select contract..."}
                    </option>
                    {savedContracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.name} ({shortenHash(contract.address)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="raw-log-manual-abi"
                    className="mb-1.5 block text-[12px] font-medium text-[var(--terminal-text-secondary)]"
                  >
                    ABI JSON
                  </label>
                  <textarea
                    id="raw-log-manual-abi"
                    name="raw-log-manual-abi"
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
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="terminal-btn terminal-btn-primary flex-1"
          onClick={() => void handleDecode()}
          disabled={loading}
        >
          {loading ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <FileSearch size={14} aria-hidden="true" />
          )}
          <span>{loading ? "DECODING..." : "DECODE_LOG"}</span>
        </button>
        <button type="button" className="terminal-btn terminal-btn-secondary" onClick={handleClear} disabled={loading}>
          CLEAR
        </button>
      </div>

      {queried && rawLog && (
        <animated.div style={resultSpring} className="space-y-4">
          {error && (
            <div
              className="border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-3 text-[12px] text-[var(--terminal-red)]"
              role="alert"
            >
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                  [DECODED_EVENTS]
                </span>
                <span className="terminal-chip">{results.length}</span>
              </div>
              {results.length > 1 && (
                <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                  多个候选签名都能解码同一条日志，请结合合约地址与事件语义判断；使用 ABI 模式可获得唯一结果。
                </p>
              )}
              {results.map((event, index) => (
                <DecodedEventCard key={`${event.fullSignature}-${index}`} event={event} />
              ))}
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="flex items-center gap-2 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-4 text-[13px] text-[var(--terminal-text-secondary)]">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--terminal-separator)] border-t-[var(--terminal-blue)]" />
              {signatureSource === "4bytes" ? "[QUERYING] 正在反查事件签名…" : "[DECODING] 正在解码…"}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-4 text-[13px] text-[var(--terminal-text-secondary)]">
              [EMPTY_RESULT] 未找到可解码的事件。
            </div>
          )}

          {signatureSource === "4bytes" && !loading && unresolvedCandidates > 0 && (
            <p className="text-[12px] text-[var(--terminal-text-secondary)]">
              另有 {unresolvedCandidates} 个候选签名未尝试或未能解码。
            </p>
          )}

          {signatureSource === "4bytes" && !loading && results.length === 0 && signatureCandidates.length > 0 && (
            <div className="border border-[var(--terminal-separator)]">
              <div className="border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                  [CANDIDATE_SIGNATURES] ({signatureCandidates.length})
                </span>
              </div>
              <div className="divide-y divide-[var(--terminal-separator)]">
                {signatureCandidates.slice(0, MAX_LISTED_CANDIDATES).map((signature) => (
                  <div key={signature} className="flex items-center justify-between gap-2 px-3 py-2">
                    <code className="break-all font-mono text-[12px] text-[var(--terminal-text)]">{signature}</code>
                    <button
                      type="button"
                      className="terminal-btn terminal-btn-secondary h-7 shrink-0 px-2"
                      onClick={() => copyToClipboard(signature)}
                      aria-label={`复制签名 ${signature}`}
                    >
                      <Copy size={11} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              {signatureCandidates.length > MAX_LISTED_CANDIDATES && (
                <p className="border-t border-[var(--terminal-separator)] px-3 py-2 text-[11px] text-[var(--terminal-text-secondary)]">
                  另有 {signatureCandidates.length - MAX_LISTED_CANDIDATES} 个候选签名未列出。
                </p>
              )}
            </div>
          )}

          {lookupErrors.length > 0 && (
            <div className="space-y-1 border border-[var(--terminal-orange)]/40 bg-[var(--terminal-orange)]/5 p-3 text-[12px]">
              <div className="flex items-center gap-1.5 text-[var(--terminal-orange)]">
                <AlertTriangle size={12} aria-hidden="true" />
                <span className="font-medium">部分签名来源查询失败</span>
              </div>
              {lookupErrors.map((item, index) => (
                <p key={`lookup-error-${index}`} className="break-all text-[var(--terminal-text-secondary)]">
                  {sourceErrorLabel(item.source)}: {item.message}
                </p>
              ))}
            </div>
          )}

          <div className="border border-[var(--terminal-separator)]">
            <div className="flex items-center gap-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] px-3 py-2">
              <ScrollText size={14} className="text-[var(--terminal-blue)]" aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                [RAW_LOG]
              </span>
            </div>
            <div className="space-y-0 p-3">
              <SummaryRow label="TOPIC_0" value={rawLog.topics[0]} />
              {rawLog.topics.slice(1).map((topic, index) => (
                <SummaryRow key={`raw-topic-${index + 1}`} label={`TOPIC_${index + 1}`} value={topic} />
              ))}
              <SummaryRow label="DATA" value={rawLog.data} />
            </div>
          </div>
        </animated.div>
      )}
    </div>
  );
}
