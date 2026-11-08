"use client";

import { useState, useMemo, useRef } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useSpring, animated } from "react-spring";
import {
  AlertTriangle,
  BookOpen,
  Send,
  ChevronDown,
  ChevronUp,
  Copy,
  X,
  Fuel,
  Search,
  FlaskConical,
  ScrollText,
} from "lucide-react";
import {
  formatResult,
  isReadMethod,
  isWriteMethod,
  isPayableMethod,
  getReadableContractError,
  parseMethodParams,
} from "@/lib/contract-utils";
import { parseAmount } from "@/lib/convert";
import { formatNativeAmount, getNativeChain, getNativeCurrency } from "@/lib/native-currency";
import AbiParamInput from "@/components/AbiParamInput";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatValueForDecimals, useValueDecimals } from "@/lib/value-decimals";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useEthersProvider } from "@/lib/use-ethers-provider";
import { addHistory, updateHistory as updateLocalHistory } from "@/lib/local-store";
import type { ContractRecord } from "@/lib/types";
import ValueDisplay from "@/components/ValueDisplay";
import ValueDecimalsControl from "@/components/ValueDecimalsControl";
import TransactionHash from "@/components/TransactionHash";

interface ContractInteractViewProps {
  contract: ContractRecord;
  onClose?: () => void;
  onHistoryUpdate?: () => void;
}

interface GasEstimate {
  gas: string;
  gasPrice: string;
  totalCost: string;
}

/** Optional transaction overrides collected by a method form. */
interface ExecuteOptions {
  /** Decimal smallest-unit amount; absent means no native currency is attached. */
  valueWei?: string;
  expectedAccount?: string;
}

interface SimulationResult {
  ok: boolean;
  message: string;
}

interface HistoryPayload {
  contractId: number;
  contractName: string;
  contractAddress: string;
  methodName: string;
  methodType: "read" | "write";
  params: unknown[];
  result?: string;
  error?: string;
  txHash?: string;
  /** Decimal wei string for payable writes. */
  value?: string;
  chainId: number;
}

function getMethodKey(method: ethers.FunctionFragment) {
  return method.selector;
}

function buildOverrides(options?: ExecuteOptions) {
  return options?.valueWei ? { value: BigInt(options.valueWei) } : {};
}

function MethodItem({
  method,
  isWrite,
  onExecute,
  onEstimateGas,
  onSimulate,
  loading,
  result,
  transaction,
  contract,
  onCheckWallet,
}: {
  method: ethers.FunctionFragment;
  isWrite: boolean;
  onExecute: (params: string[], options: ExecuteOptions) => void;
  onEstimateGas?: (params: string[], options: ExecuteOptions) => Promise<GasEstimate>;
  onSimulate?: (params: string[], options: ExecuteOptions) => Promise<SimulationResult>;
  loading: boolean;
  result?: string;
  transaction?: { hash: string; chainId: number };
  contract: ContractRecord;
  onCheckWallet: (expectedAccount?: string) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState<string[]>(new Array(method.inputs.length).fill(""));
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [gasError, setGasError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [valueInput, setValueInput] = useState("");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [showParamErrors, setShowParamErrors] = useState(false);
  const [pendingWrite, setPendingWrite] = useState<{ params: string[]; options: ExecuteOptions; parsed: unknown[]; error?: string } | null>(null);
  const [failedWrite, setFailedWrite] = useState<{ params: string[]; options: ExecuteOptions; parsed: unknown[]; error?: string } | null>(null);
  const revision = useRef(0);
  const decimals = useValueDecimals();
  const reducedMotion = useReducedMotion();
  const convertedResult = result ? formatValueForDecimals(result, decimals) : null;

  const payable = isPayableMethod(method);

  const currency = getNativeCurrency(contract.chainId);
  const valueText = valueInput.trim();
  const validNumber = /^(?:\d+(?:\.\d*)?|\.\d+|0x[0-9a-f]+)$/i.test(valueText);
  const unknownZero = /^(?:0+(?:\.0*)?|\.0+|0x0+)$/i.test(valueText);
  const valueParse = payable && valueText && currency && validNumber ? parseAmount(valueText, currency.decimals) : null;
  const valueError = !payable || !valueText ? null : !validNumber ? "请输入有效的原生币金额" :
    !currency && !unknownZero ? "此网络缺少原生币信息，不能发送非零金额" :
    valueParse && !valueParse.ok ? valueParse.error :
    valueParse?.ok && valueParse.value >= BigInt(2) ** BigInt(256) ? "金额超出交易支持的范围" : null;

  const buildOptions = (): ExecuteOptions =>
    valueParse?.ok && valueParse.value > BigInt(0) ? { valueWei: valueParse.value.toString() } : {};

  const invalidate = () => {
    revision.current += 1;
    setPreflightError(null);
    setFailedWrite(null);
    setSimulation(null);
    setPendingWrite(null);
    setGasEstimate(null);
  };
  const validate = () => {
    setShowParamErrors(true);
    try { return parseMethodParams(method, params); }
    catch (error) { toast.error(error instanceof Error ? error.message : "参数无效"); return null; }
  };

  const busy = loading || simulating;

  /**
   * Copy the text shown in the result body: when a display precision is set the
   * human readable conversion is copied, otherwise the raw return value is.
   */
  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(convertedResult ?? result);
      toast.success(
        convertedResult !== null ? "[COPIED] 已复制转换值" : "[COPIED] 已复制原始值"
      );
    } catch {
      toast.error("[COPY_FAILED] 复制失败");
    }
  };

  const handleEstimateGas = async () => {
    if (!onEstimateGas || !validate() || valueError) return;
    const currentRevision = revision.current;
    setEstimating(true);
    setGasEstimate(null);
    setGasError(null);
    try {
      const estimate = await onEstimateGas(params, buildOptions());
      if (revision.current === currentRevision) setGasEstimate(estimate);
    } catch (error) {
      if (revision.current === currentRevision) setGasError(error instanceof Error ? error.message : "Gas 估算失败");
    } finally {
      setEstimating(false);
    }
  };

  const handleSimulate = async () => {
    if (!onSimulate || !validate() || valueError) return;
    const currentRevision = revision.current;
    setSimulating(true);
    setSimulation(null);
    setPreflightError(null);
    try {
      const result = await onSimulate(params, buildOptions());
      if (revision.current === currentRevision) setSimulation(result);
    } catch (error) {
      if (revision.current === currentRevision) {
        setSimulation({
          ok: false,
          message: error instanceof Error ? error.message : "预演失败",
        });
      }
    } finally {
      setSimulating(false);
    }
  };

  const handleSend = async () => {
    const parsed = validate();
    if (!parsed || valueError || !onSimulate) return;
    const currentRevision = revision.current;
    const raw = [...params];
    const options = buildOptions();
    setPreflightError(null);
    setFailedWrite(null);
    setSimulation(null);
    setSimulating(true);
    try {
      const account = await onCheckWallet();
      const sim = await onSimulate(raw, options);
      await onCheckWallet(account);
      if (revision.current !== currentRevision) return;
      const snapshot = { params: raw, options: { ...options, expectedAccount: account }, parsed };
      if (!sim.ok) {
        setPreflightError(sim.message);
        setFailedWrite({ ...snapshot, error: sim.message });
        toast.error("预演失败，交易未发送");
        return;
      }
      setSimulation(sim);
      setPendingWrite(snapshot);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法准备交易");
    } finally {
      setSimulating(false);
    }
  };

  const contentSpring = useSpring({
    maxHeight: expanded ? 10000 : 0,
    opacity: expanded ? 1 : 0,
    config: { tension: 280, friction: 24 },
    immediate: reducedMotion,
  });

  return (
    <div className="overflow-hidden border border-[var(--terminal-separator)]">
      <button
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-[var(--terminal-hover)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] focus-visible:outline-offset-[-2px]"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 ${isWrite ? "bg-[var(--terminal-orange)]" : "bg-[var(--terminal-green)]"}`} aria-hidden="true" />
          <span className="font-mono text-[13px] font-medium">{method.name}</span>
          <code className="text-[11px] font-mono bg-[var(--terminal-fill)] px-1.5 py-0.5 border border-[var(--terminal-separator)] text-[var(--terminal-text-secondary)]">
            {method.selector}
          </code>
          {method.inputs.length > 0 && (
            <span className="text-[12px] text-[var(--terminal-text-secondary)]">
              ({method.inputs.length} params)
            </span>
          )}
          {payable && (
            <span className="border border-[var(--terminal-orange)]/40 bg-[var(--terminal-orange)]/10 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.06em] text-[var(--terminal-orange)]">
              PAYABLE
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
        )}
      </button>

      <animated.div style={contentSpring} className="overflow-hidden">
        <div className="space-y-3 px-4 pb-4">
          {method.inputs.map((input, i) => (
            <AbiParamInput key={i} index={i} input={input} id={`${method.selector}-param-${i}`} value={params[i]} showError={showParamErrors} onChange={(value) => { const next = [...params]; next[i] = value; setParams(next); invalidate(); }} />
          ))}

          {payable && (
            <div>
              <label htmlFor={`${method.selector}-value`} className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1">
                Value
                <span className="ml-1 opacity-60">({currency ? currency.name ? `${currency.name} / ${currency.symbol}` : currency.symbol : "币种未知"})</span>
              </label>
              <div className="terminal-prompt-wrap">
                <input
                  id={`${method.selector}-value`}
                  name={`${method.selector}-value`}
                  className="terminal-input font-mono text-[13px]"
                  placeholder="0.0"
                  inputMode="decimal"
                  value={valueInput}
                  onChange={(e) => { setValueInput(e.target.value); invalidate(); }}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(valueError)}
                />
              </div>
              {valueError ? (
                <p className="mt-1 text-[11px] text-[var(--terminal-red)]" role="alert">
                  {valueError}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-[var(--terminal-text-secondary)]">
                  payable 方法随交易附带的原生币，留空即为 0
                  {valueParse?.ok && valueParse.value > BigInt(0)
                    ? ` · ${valueParse.value.toString()} 最小单位`
                    : ""}
                </p>
              )}
            </div>
          )}

          {isWrite && onEstimateGas ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="terminal-btn terminal-btn-secondary min-w-[104px] flex-1"
                onClick={handleEstimateGas}
                disabled={estimating || busy || Boolean(valueError)}
              >
                {estimating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[var(--terminal-text-secondary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="估算中…" />
                    Estimating...
                  </span>
                ) : (
                  <><Fuel size={14} aria-hidden="true" /> Estimate</>
                )}
              </button>
              <button
                className="terminal-btn terminal-btn-secondary min-w-[84px] flex-1"
                onClick={handleSimulate}
                disabled={simulating || loading || Boolean(valueError)}
              >
                {simulating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[var(--terminal-text-secondary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="预演中…" />
                    预演中
                  </span>
                ) : (
                  <><FlaskConical size={14} aria-hidden="true" /> 预演</>
                )}
              </button>
              <button
                className="terminal-btn min-w-[110px] flex-1 bg-[var(--terminal-orange)] text-white disabled:opacity-50"
                onClick={handleSend}
                disabled={busy || Boolean(valueError)}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" role="status" aria-label="执行中…" />
                    Executing...
                  </span>
                ) : (
                  <><Send size={14} aria-hidden="true" /> Send Tx</>
                )}
              </button>
            </div>
          ) : (
            <button
              className={`terminal-btn w-full ${isWrite ? "bg-[var(--terminal-orange)] text-white" : "terminal-btn-primary"}`}
              onClick={() => { if (validate()) onExecute(params, buildOptions()); }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" role="status" aria-label="执行中…" />
                  Executing...
                </span>
              ) : (
                <><BookOpen size={14} aria-hidden="true" /> Query</>
              )}
            </button>
          )}

          {preflightError && (
            <div className="border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-2.5" role="alert">
              <p className="text-[11px] font-medium text-[var(--terminal-red)]">
                预演失败 · 交易未发送
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-[var(--terminal-red)]/80">
                {preflightError}
              </p>
              <button
                type="button"
                onClick={() => { if (failedWrite) setPendingWrite(failedWrite); }}
                disabled={!failedWrite || Boolean(valueError)}
                className="terminal-btn terminal-btn-secondary mt-2 w-full text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                忽略预演，仍然发送
              </button>
            </div>
          )}

          {gasEstimate && (
            <div className="p-3 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]" aria-live="polite">
              <div className="flex items-center gap-2 mb-2">
                <Fuel size={12} className="text-[var(--terminal-orange)]" aria-hidden="true" />
                <span className="text-[12px] font-medium text-[var(--terminal-text-secondary)]">Gas Estimate</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[13px]">
                <div>
                  <p className="text-[11px] text-[var(--terminal-text-secondary)] mb-0.5">Gas</p>
                  <p className="font-mono text-[var(--terminal-text)]">{gasEstimate.gas}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--terminal-text-secondary)] mb-0.5">Gas Price</p>
                  <p className="font-mono text-[var(--terminal-text)]">{gasEstimate.gasPrice}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--terminal-text-secondary)] mb-0.5">Total Cost</p>
                  <p className="font-mono text-[var(--terminal-text)]">{gasEstimate.totalCost}</p>
                </div>
              </div>
            </div>
          )}
          {gasError && (
            <div className="p-3 bg-[var(--terminal-red)]/5 border border-[var(--terminal-red)]/20" aria-live="polite">
              <div className="flex items-center gap-2 mb-1">
                <Fuel size={12} className="text-[var(--terminal-red)]" aria-hidden="true" />
                <span className="text-[12px] font-medium text-[var(--terminal-red)]">Estimate Failed</span>
              </div>
              <p className="text-[12px] text-[var(--terminal-red)]/80 font-mono break-all">{gasError}</p>
            </div>
          )}

          {simulation && (
            <div
              className={`p-2.5 border ${
                simulation.ok
                  ? "border-[var(--terminal-green)]/30 bg-[var(--terminal-green)]/5"
                  : "border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5"
              }`}
              aria-live="polite"
            >
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical
                  size={12}
                  className={simulation.ok ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}
                  aria-hidden="true"
                />
                <span
                  className={`text-[11px] font-medium ${
                    simulation.ok ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"
                  }`}
                >
                  {simulation.ok ? "预演通过" : "预演失败"}
                </span>
              </div>
              <p className="break-all font-mono text-[11px] text-[var(--terminal-text-secondary)]">
                {simulation.message}
              </p>
            </div>
          )}

          {result && (
            <div className="p-3 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]" aria-live="polite">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-[var(--terminal-text-secondary)]">Result</span>
                <div className="flex items-center gap-1.5">
                  <ValueDecimalsControl />
                  <button
                    onClick={() => void copyResult()}
                    className="p-1 border border-transparent hover:bg-[var(--terminal-hover)] hover:border-[var(--terminal-separator)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
                    aria-label={convertedResult !== null ? "复制转换后的值" : "复制原始值"}
                    title={convertedResult !== null ? "复制转换后的值" : "复制原始值"}
                  >
                    <Copy size={12} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <ValueDisplay value={result} className="text-[13px] text-[var(--terminal-text)]" />
            </div>
          )}
          {transaction && (
            <div className="p-3 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]" aria-live="polite">
              <p className="mb-1 text-[12px] font-medium text-[var(--terminal-text-secondary)]">Transaction Hash</p>
              <TransactionHash hash={transaction.hash} chainId={transaction.chainId} />
            </div>
          )}
        </div>
      </animated.div>
      {pendingWrite && (
        <Dialog open onOpenChange={(open) => { if (!open) setPendingWrite(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto" showCloseButton={false}>
            <DialogTitle>确认写入交易</DialogTitle>
            <DialogDescription>请核对交易内容，确认后将在钱包中请求签名。</DialogDescription>
            <dl className="space-y-2 text-[12px]">
              {[
                ["网络", `${getNativeChain(contract.chainId)?.name ?? "未知网络"} (Chain ID: ${contract.chainId})`],
                ["账户", pendingWrite.options.expectedAccount ?? ""],
                ["合约地址", contract.address],
                ["方法", method.format("sighash")],
                ["附带金额", formatNativeAmount(BigInt(pendingWrite.options.valueWei ?? "0"), contract.chainId)],
              ].map(([label, value]) => <div key={label}><dt className="text-[var(--terminal-text-secondary)]">{label}</dt><dd className="break-all font-mono">{value}</dd></div>)}
              <div><dt className="text-[var(--terminal-text-secondary)]">参数</dt><dd className="break-all font-mono whitespace-pre-wrap">{method.inputs.length ? method.inputs.map((input, index) => `${input.name || `param${index}`} (${input.format("sighash")}): ${JSON.stringify(pendingWrite.parsed[index], (_, value) => typeof value === "bigint" ? value.toString() : value)}`).join("\n") : "无"}</dd></div>
            </dl>
            {pendingWrite.error && <p className="break-all text-[12px] text-[var(--terminal-red)]" role="alert">预演失败：{pendingWrite.error}</p>}
            <div className="flex gap-2">
              <button type="button" className="terminal-btn terminal-btn-secondary flex-1" onClick={() => setPendingWrite(null)}>取消</button>
              <button type="button" className="terminal-btn flex-1 bg-[var(--terminal-orange)] text-white" onClick={() => { const snapshot = pendingWrite; setPendingWrite(null); onExecute(snapshot.params, snapshot.options); }}>确认并打开钱包</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function ContractInteractView({ contract, onClose, onHistoryUpdate }: ContractInteractViewProps) {
  const { chainId, address } = useAccount();
  const provider = useEthersProvider();
  const [activeTab, setActiveTab] = useState<"read" | "write">("read");
  const [results, setResults] = useState<Record<string, string>>({});
  const [transactions, setTransactions] = useState<Record<string, { hash: string; chainId: number }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [methodSearch, setMethodSearch] = useState("");

  const ifaceState = useMemo(() => {
    try {
      return { iface: new ethers.Interface(contract.abi), error: null as string | null };
    } catch (error) {
      return {
        iface: null,
        error: error instanceof Error ? error.message : "ABI 无法解析",
      };
    }
  }, [contract.abi]);
  const iface = ifaceState.iface;
  const methods = useMemo(
    () => (iface ? (iface.fragments.filter(f => f.type === "function") as ethers.FunctionFragment[]) : []),
    [iface]
  );
  const readMethods = useMemo(() => methods.filter(isReadMethod), [methods]);
  const writeMethods = useMemo(() => methods.filter(isWriteMethod), [methods]);
  const payableWriteCount = useMemo(
    () => writeMethods.filter(isPayableMethod).length,
    [writeMethods]
  );
  const filterMethods = (items: ethers.FunctionFragment[]) => {
    const query = methodSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((method) => {
      const signature = method.format("sighash").toLowerCase();
      return method.name.toLowerCase().includes(query) || signature.includes(query);
    });
  };

  const getProvider = () => {
    if (!provider) throw new Error("请先连接钱包");
    return provider;
  };

  const checkWriteWallet = async (expectedAccount?: string) => {
    const wallet = getProvider();
    const actualChain = Number(await wallet.send("eth_chainId", []));
    const accounts = await wallet.send("eth_accounts", []) as string[];
    const account = accounts.find((entry) => entry.toLowerCase() === address?.toLowerCase());
    if (actualChain !== contract.chainId || chainId !== contract.chainId) throw new Error(`钱包网络与合约网络不一致，请切换到 Chain ID ${contract.chainId}`);
    if (!account || !address || account.toLowerCase() !== address.toLowerCase() || (expectedAccount && account.toLowerCase() !== expectedAccount.toLowerCase())) throw new Error("钱包账户已变化，请重新核对交易");
    return account;
  };

  /**
   * Reads and simulations should run as the connected account: many contracts
   * branch on `msg.sender`, and a provider-only call would use the zero address.
   */
  const getReadRunner = async (provider: ethers.BrowserProvider) => {
    try {
      return await provider.getSigner();
    } catch {
      return provider;
    }
  };

  const serializeBigInt = (value: unknown): unknown => {
    if (typeof value === "bigint") {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map(serializeBigInt);
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [key, serializeBigInt(entryValue)])
      );
    }

    return value;
  };

  const saveHistory = async (payload: HistoryPayload) => {
    const serializedPayload = {
      ...payload,
      params: serializeBigInt(payload.params) as unknown[],
      result: payload.result ? String(serializeBigInt(payload.result)) : payload.result,
    };
    const id = await addHistory(serializedPayload);
    onHistoryUpdate?.();
    return id ?? null;
  };

  const updateHistory = async (
    historyId: number,
    updates: Pick<HistoryPayload, "result" | "error" | "txHash">
  ) => {
    await updateLocalHistory(historyId, {
      result: updates.result,
      error: updates.error,
      txHash: updates.txHash,
    });
    onHistoryUpdate?.();
  };

  const getHistoryBase = (method: ethers.FunctionFragment, params: unknown[]): HistoryPayload => ({
    contractId: contract.id,
    contractName: contract.name,
    contractAddress: contract.address,
    methodName: method.name,
    methodType: isReadMethod(method) ? "read" : "write",
    params,
    chainId: chainId ?? contract.chainId,
  });

  const executeRead = async (method: ethers.FunctionFragment, params: string[]) => {
    const key = getMethodKey(method);
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const provider = getProvider();
      const runner = await getReadRunner(provider);
      const c = new ethers.Contract(contract.address, contract.abi, runner);
      const parsedParams = parseMethodParams(method, params);
      const result = await c[method.format("sighash")](...parsedParams);
      const formattedResult = formatResult(result);

      await saveHistory({
        ...getHistoryBase(method, parsedParams),
        result: formattedResult,
      });

      setResults(prev => ({ ...prev, [key]: formattedResult }));
      toast.success("查询成功");
    } catch (error) {
      const message = getReadableContractError(error, contract.abi as any[]);

      try {
        await saveHistory({
          ...getHistoryBase(method, params),
          error: message,
        });
      } catch (historyError) {
        console.error("保存读取历史失败:", historyError);
      }

      setResults(prev => ({ ...prev, [key]: `错误: ${message}` }));
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const estimateGas = async (
    method: ethers.FunctionFragment,
    params: string[],
    options: ExecuteOptions
  ): Promise<GasEstimate> => {
    await checkWriteWallet();
    const provider = getProvider();
    const runner = await getReadRunner(provider);
    const c = new ethers.Contract(contract.address, contract.abi, runner);
    const parsedParams = parseMethodParams(method, params);
    const estimatedGas = await c[method.format("sighash")].estimateGas(
      ...parsedParams,
      buildOverrides(options)
    );
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    return {
      gas: estimatedGas.toLocaleString(),
      gasPrice: gasPrice === null ? "未知" : `${ethers.formatUnits(gasPrice, 9)} GWei`,
      totalCost: gasPrice === null ? "未知" : formatNativeAmount(estimatedGas * gasPrice, contract.chainId),
    };
  };

  /** Run the write as an `eth_call` from the connected account, without sending. */
  const simulateWrite = async (
    method: ethers.FunctionFragment,
    params: string[],
    options: ExecuteOptions
  ): Promise<SimulationResult> => {
    try {
      await checkWriteWallet();
      const provider = getProvider();
      const signer = await provider.getSigner();
      const from = await signer.getAddress();
      const c = new ethers.Contract(contract.address, contract.abi, signer);
      const parsedParams = parseMethodParams(method, params);
      const result = await c[method.format("sighash")].staticCall(
        ...parsedParams,
        { ...buildOverrides(options), from }
      );
      if (result === null || result === undefined) {
        return { ok: true, message: "调用成功（无返回值）" };
      }
      return { ok: true, message: formatResult(result) };
    } catch (error) {
      return { ok: false, message: getReadableContractError(error, contract.abi as any[]) };
    }
  };

  const executeWrite = async (
    method: ethers.FunctionFragment,
    params: string[],
    options: ExecuteOptions
  ) => {
    const key = getMethodKey(method);
    setLoading(prev => ({ ...prev, [key]: true }));
    setResults(prev => ({ ...prev, [key]: "" }));
    setTransactions(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    let historyId: number | null = null;
    let txHash: string | undefined;
    let transactionChainId = chainId ?? contract.chainId;
    try {
      const provider = getProvider();
      if (!options.expectedAccount) throw new Error("请先确认交易");
      await checkWriteWallet(options.expectedAccount);
      const signer = await provider.getSigner(options.expectedAccount);
      await checkWriteWallet(options.expectedAccount);
      const c = new ethers.Contract(contract.address, contract.abi, signer);
      const parsedParams = parseMethodParams(method, params);
      const tx = await c[method.format("sighash")](
        ...parsedParams,
        buildOverrides(options)
      );
      txHash = tx.hash;
      transactionChainId = Number(tx.chainId);
      setTransactions(prev => ({ ...prev, [key]: { hash: tx.hash, chainId: transactionChainId } }));
      setResults(prev => ({ ...prev, [key]: "交易已发送，等待确认…" }));

      historyId = await saveHistory({
        ...getHistoryBase(method, parsedParams),
        chainId: transactionChainId,
        txHash,
        value: options.valueWei,
        result: "⏳ Transaction sent, waiting for confirmation...",
      });

      toast.success("交易已发送");
      const receipt = await tx.wait();
      const confirmedResult = "交易已确认";
      setTransactions(prev => ({ ...prev, [key]: { hash: receipt.hash, chainId: transactionChainId } }));

      if (historyId) {
        await updateHistory(historyId, {
          txHash: receipt.hash,
          result: `✅ Transaction confirmed! Gas used: ${receipt.gasUsed.toString()}`,
        });
      }

      setResults(prev => ({ ...prev, [key]: confirmedResult }));
      toast.success("交易已确认");
    } catch (error) {
      const message = getReadableContractError(error, contract.abi as any[]);

      try {
        if (historyId) {
          await updateHistory(historyId, {
            txHash,
            error: message,
          });
        } else {
          await saveHistory({
            ...getHistoryBase(method, params),
            chainId: transactionChainId,
            txHash,
            value: options.valueWei,
            error: message,
          });
        }
      } catch (historyError) {
        console.error("保存写入历史失败:", historyError);
      }

      setResults(prev => ({ ...prev, [key]: `错误: ${message}` }));
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const currentMethods = filterMethods(activeTab === "read" ? readMethods : writeMethods);
  const reducedMotion = useReducedMotion();
  const fadeIn = useSpring({ from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" }, config: { tension: 280, friction: 24 }, immediate: reducedMotion });

  return (
    <animated.div style={fadeIn} className="terminal-card bg-[var(--terminal-card)]">
      <div className="p-5 border-b border-[var(--terminal-separator)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-center shrink-0" aria-hidden="true">
              <span className="text-sm font-semibold text-[var(--terminal-blue)]">
                {contract.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold tracking-[0.06em] ">[{contract.name}]</h2>
              <p className="text-[13px] font-mono text-[var(--terminal-text-secondary)] truncate">{contract.address}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href="#system-logs"
              className="terminal-btn terminal-btn-secondary h-8 px-2 text-[11px]"
              aria-label="查看系统日志"
              title="查看系统日志"
            >
              <ScrollText size={13} aria-hidden="true" />
              <span className="hidden sm:inline">日志</span>
            </a>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 border border-transparent hover:bg-[var(--terminal-red)]/10 hover:border-[var(--terminal-separator)] flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
                aria-label={`关闭 ${contract.name}`}
              >
                <X size={16} className="text-[var(--terminal-red)]" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        {!iface ? (
          <div className="border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 p-4" role="alert">
            <div className="mb-2 flex items-center gap-2 text-[var(--terminal-red)]">
              <AlertTriangle size={16} aria-hidden="true" />
              <h3 className="text-[13px] font-medium">ABI 无法解析</h3>
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--terminal-text-secondary)]">
              该合约保存的 ABI 不是合法数组，交互面板无法加载。请在左侧合约列表中编辑该合约并粘贴合法的 ABI，或删除后重新导入。
            </p>
            {ifaceState.error && (
              <p className="mt-2 break-all font-mono text-[11px] text-[var(--terminal-red)]/80">{ifaceState.error}</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 inline-flex gap-1 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-1" role="tablist" aria-label="方法类型">
              <button
                id="methods-tab-read"
                role="tab"
                aria-selected={activeTab === "read"}
                aria-controls="methods-panel"
                className={`px-3 py-1.5 text-[12px] font-medium tracking-[0.01em] border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                  activeTab === "read" ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]" : "border-transparent text-[var(--terminal-text-secondary)]"
                }`}
                onClick={() => setActiveTab("read")}
              >
                [READ] ({readMethods.length})
              </button>
              <button
                id="methods-tab-write"
                role="tab"
                aria-selected={activeTab === "write"}
                aria-controls="methods-panel"
                className={`px-3 py-1.5 text-[12px] font-medium tracking-[0.01em] border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                  activeTab === "write" ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]" : "border-transparent text-[var(--terminal-text-secondary)]"
                }`}
                onClick={() => setActiveTab("write")}
              >
                [WRITE] ({writeMethods.length}
                {payableWriteCount > 0 ? ` · ${payableWriteCount} payable` : ""})
              </button>
            </div>

            <div className="relative mb-4">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--terminal-text-secondary)]" aria-hidden="true" />
              <input
                type="text"
                value={methodSearch}
                onChange={(event) => setMethodSearch(event.target.value)}
                className="terminal-input terminal-input-search font-mono text-[13px]"
                placeholder="按函数名或签名搜索，例如 balanceOf 或 balanceOf(address)"
                aria-label="搜索合约函数"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div
              id="methods-panel"
              role="tabpanel"
              aria-labelledby={activeTab === "read" ? "methods-tab-read" : "methods-tab-write"}
              className="terminal-scroll max-h-[500px] space-y-2 overflow-y-auto"
            >
              {currentMethods.length === 0 ? (
                <p className="text-center py-12 text-[14px] text-[var(--terminal-text-secondary)]">
                  无{activeTab === "read" ? "读" : "写"}方法
                </p>
              ) : (
                currentMethods.map(method => (
                  <MethodItem
                    key={`${getMethodKey(method)}-${contract.address}-${chainId}-${address}`}
                    method={method}
                    contract={contract}
                    onCheckWallet={checkWriteWallet}
                    isWrite={activeTab === "write"}
                    onExecute={(params, options) =>
                      activeTab === "write"
                        ? executeWrite(method, params, options)
                        : executeRead(method, params)
                    }
                    onEstimateGas={
                      activeTab === "write"
                        ? (params, options) => estimateGas(method, params, options)
                        : undefined
                    }
                    onSimulate={
                      activeTab === "write"
                        ? (params, options) => simulateWrite(method, params, options)
                        : undefined
                    }
                    loading={!!loading[getMethodKey(method)]}
                    result={results[getMethodKey(method)]}
                    transaction={transactions[getMethodKey(method)]}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </animated.div>
  );
}
