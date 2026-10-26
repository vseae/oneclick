"use client";

import { useState, useMemo } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useSpring, animated } from "react-spring";
import { AlertTriangle, BookOpen, Send, ChevronDown, ChevronUp, Copy, X, Fuel, Search } from "lucide-react";
import { formatResult, isReadMethod, isWriteMethod, getReadableContractError } from "@/lib/contract-utils";
import { addHistory, updateHistory as updateLocalHistory } from "@/lib/local-store";
import type { ContractRecord } from "@/lib/types";

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
  chainId: number;
}

function getMethodKey(method: ethers.FunctionFragment) {
  return method.selector;
}

function MethodItem({
  method,
  isWrite,
  onExecute,
  onEstimateGas,
  loading,
  result,
}: {
  method: ethers.FunctionFragment;
  isWrite: boolean;
  onExecute: (params: string[]) => void;
  onEstimateGas?: (params: string[]) => Promise<GasEstimate>;
  loading: boolean;
  result?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState<string[]>(new Array(method.inputs.length).fill(""));
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [gasError, setGasError] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);

  const handleEstimateGas = async () => {
    if (!onEstimateGas) return;
    setEstimating(true);
    setGasEstimate(null);
    setGasError(null);
    try {
      const estimate = await onEstimateGas(params);
      setGasEstimate(estimate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gas 估算失败";
      setGasError(message);
    } finally {
      setEstimating(false);
    }
  };

  const contentSpring = useSpring({
    maxHeight: expanded ? 500 : 0,
    opacity: expanded ? 1 : 0,
    config: { tension: 280, friction: 24 },
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
            <div key={i}>
              <label htmlFor={`${method.name}-param-${i}`} className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1">
                {input.name || `param${i}`}
                <span className="ml-1 opacity-60">({input.type})</span>
              </label>
              <div className="terminal-prompt-wrap">
                <input
                  id={`${method.name}-param-${i}`}
                  name={`${method.name}-param-${i}`}
                  className="terminal-input font-mono text-[13px]"
                  placeholder={`${input.type}…`}
                  value={params[i]}
                  onChange={(e) => {
                    const p = [...params];
                    p[i] = e.target.value;
                    setParams(p);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          ))}
          {isWrite && onEstimateGas ? (
            <div className="flex gap-2">
              <button
                className="terminal-btn flex-1 terminal-btn-secondary"
                onClick={handleEstimateGas}
                disabled={estimating || loading}
              >
                {estimating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[var(--terminal-text-secondary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="估算中…" />
                    Estimating...
                  </span>
                ) : (
                  <><Fuel size={14} aria-hidden="true" /> Estimate Gas</>
                )}
              </button>
              <button
                className="terminal-btn flex-1 bg-[var(--terminal-orange)] text-white"
                onClick={() => onExecute(params)}
                disabled={loading}
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
              onClick={() => onExecute(params)}
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
          {result && (
            <div className="p-3 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]" aria-live="polite">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-[var(--terminal-text-secondary)]">Result</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(result); toast.success("已复制"); }}
                  className="p-1 border border-transparent hover:bg-[var(--terminal-hover)] hover:border-[var(--terminal-separator)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
                  aria-label="复制结果"
                >
                  <Copy size={12} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
                </button>
              </div>
              <p className="text-[13px] font-mono break-all text-[var(--terminal-text)]">{result}</p>
            </div>
          )}
        </div>
      </animated.div>
    </div>
  );
}

export default function ContractInteractView({ contract, onClose, onHistoryUpdate }: ContractInteractViewProps) {
  const { chainId } = useAccount();
  const [activeTab, setActiveTab] = useState<"read" | "write">("read");
  const [results, setResults] = useState<Record<string, string>>({});
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
  const filterMethods = (items: ethers.FunctionFragment[]) => {
    const query = methodSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((method) => {
      const signature = method.format("sighash").toLowerCase();
      return method.name.toLowerCase().includes(query) || signature.includes(query);
    });
  };

  const parseParams = (method: ethers.FunctionFragment, params: string[]) =>
    params.map((p, i) => {
      const param = method.inputs[i];
      if (param.type.includes("[]")) return JSON.parse(p || "[]");
      if (param.type.startsWith("uint") || param.type.startsWith("int")) return BigInt(p || "0");
      if (param.type === "bool") return p.toLowerCase() === "true";
      return p;
    });

  const getProvider = () => {
    const ethereum = (window as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!ethereum) throw new Error("未检测到钱包，请安装 MetaMask 等浏览器钱包");
    return new ethers.BrowserProvider(ethereum);
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
      const c = new ethers.Contract(contract.address, contract.abi, provider);
      const parsedParams = parseParams(method, params);
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

  const estimateGas = async (method: ethers.FunctionFragment, params: string[]): Promise<GasEstimate> => {
    const provider = getProvider();
    const c = new ethers.Contract(contract.address, contract.abi, provider);
    const parsedParams = parseParams(method, params);
    const estimatedGas = await c[method.format("sighash")].estimateGas(...parsedParams);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? BigInt(0);
    const totalCostWei = estimatedGas * gasPrice;
    return {
      gas: Number(estimatedGas).toLocaleString(),
      gasPrice: `${(Number(gasPrice) / 1e9).toFixed(2)} GWei`,
      totalCost: `${ethers.formatEther(totalCostWei)} ETH`,
    };
  };

  const executeWrite = async (method: ethers.FunctionFragment, params: string[]) => {
    const key = getMethodKey(method);
    setLoading(prev => ({ ...prev, [key]: true }));
    let historyId: number | null = null;
    let txHash: string | undefined;
    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const c = new ethers.Contract(contract.address, contract.abi, signer);
      const parsedParams = parseParams(method, params);
      const tx = await c[method.format("sighash")](...parsedParams);
      txHash = tx.hash;

      historyId = await saveHistory({
        ...getHistoryBase(method, parsedParams),
        txHash,
        result: "⏳ Transaction sent, waiting for confirmation...",
      });

      toast.success("交易已发送");
      const receipt = await tx.wait();
      const confirmedResult = `Tx: ${receipt.hash}`;

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
            txHash,
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
  const fadeIn = useSpring({ from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" }, config: { tension: 280, friction: 24 } });

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
            <div className="flex gap-1 p-1 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)] mb-4" role="tablist" aria-label="方法类型">
              <button
                role="tab"
                aria-selected={activeTab === "read"}
                className={`flex-1 py-2 text-[12px] font-medium tracking-[0.01em] border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                  activeTab === "read" ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]" : "border-transparent text-[var(--terminal-text-secondary)]"
                }`}
                onClick={() => setActiveTab("read")}
              >
                [READ] ({readMethods.length})
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "write"}
                className={`flex-1 py-2 text-[12px] font-medium tracking-[0.01em] border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                  activeTab === "write" ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]" : "border-transparent text-[var(--terminal-text-secondary)]"
                }`}
                onClick={() => setActiveTab("write")}
              >
                [WRITE] ({writeMethods.length})
              </button>
            </div>

            <div className="relative mb-4">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--terminal-text-secondary)]" aria-hidden="true" />
              <input
                type="text"
                value={methodSearch}
                onChange={(event) => setMethodSearch(event.target.value)}
                className="terminal-input pl-9 font-mono text-[13px]"
                placeholder="按函数名或签名搜索，例如 balanceOf 或 balanceOf(address)"
                aria-label="搜索合约函数"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto" role="tabpanel">
              {currentMethods.length === 0 ? (
                <p className="text-center py-12 text-[14px] text-[var(--terminal-text-secondary)]">
                  无{activeTab === "read" ? "读" : "写"}方法
                </p>
              ) : (
                currentMethods.map(method => (
                  <MethodItem
                    key={getMethodKey(method)}
                    method={method}
                    isWrite={activeTab === "write"}
                    onExecute={(params) => activeTab === "write" ? executeWrite(method, params) : executeRead(method, params)}
                    onEstimateGas={activeTab === "write" ? (params) => estimateGas(method, params) : undefined}
                    loading={!!loading[getMethodKey(method)]}
                    result={results[getMethodKey(method)]}
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
