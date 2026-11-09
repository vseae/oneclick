"use client";

import AbiParamInput from "@/components/AbiParamInput";

import { useMemo, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, type Abi, type AbiFunction, type Address, type Hex } from "viem";
import { abiSelector, functionAbi, normalizeAbi } from "@/lib/abi";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { Copy, Play } from "lucide-react";
import ToolHeader from "@/components/tools/ToolHeader";
import ValueDisplay from "@/components/ValueDisplay";
import { useContracts } from "@/lib/queries";
import { MULTICALL3_ABI, getMulticall3Address } from "@/lib/multicall3";
import { useWalletClients } from "@/lib/use-wallet-clients";
import { formatValueForDecimals, useValueDecimals } from "@/lib/value-decimals";
import {
  formatResult,
  getReadableContractError,
  isReadMethod,
  parseMethodParams,
} from "@/lib/contract-utils";

type Mode = "multi_method" | "multi_contract";

interface RunResult {
  key: string;
  /** Method name in MULTI_METHOD mode, contract name in MULTI_CONTRACT mode. */
  label: string;
  address?: string;
  success: boolean;
  value?: string;
  error?: string;
}

/** One read to include in a Multicall3 `aggregate3` batch. */
interface AggregateCall {
  key: string;
  label: string;
  address?: string;
  target: string;
  fragment: AbiFunction;
  args: unknown[];
  callData: string;
}

/**
 * Run every call through Multicall3 in a single `eth_call`.
 *
 * `aggregate3` reports a success flag per call, so one reverting method never
 * hides the others. Failed calls are replayed individually to recover the
 * revert reason (and any custom error) that Multicall3 does not return.
 */
async function executeAggregate(
  provider: NonNullable<ReturnType<typeof useWalletClients>["publicClient"]>,
  chainId: number,
  abi: Abi,
  calls: AggregateCall[],
  account?: Address
): Promise<RunResult[]> {
  const multicallAddress = getMulticall3Address(chainId);
  if (!multicallAddress) throw new Error("当前网络未部署 Multicall3");

  const { result: responses } = await provider.simulateContract({
    address: multicallAddress as Address, abi: MULTICALL3_ABI, functionName: "aggregate3", account,
    args: [calls.map((call) => ({ target: call.target as Address, allowFailure: true, callData: call.callData as Hex }))],
  });

  const results: RunResult[] = [];

  for (let index = 0; index < calls.length; index += 1) {
    const call = calls[index];
    const response = responses[index];
    const base = { key: call.key, label: call.label, address: call.address };

    if (!response) {
      results.push({ ...base, success: false, error: "Multicall3 未返回该调用的结果" });
      continue;
    }

    if (!response.success) {
      let message = "调用回滚";
      try {
        await provider.readContract({ address: call.target as Address, abi: functionAbi(call.fragment, normalizeAbi(abi)), functionName: call.fragment.name, args: call.args, account });
      } catch (error) {
        message = getReadableContractError(error);
      }
      results.push({ ...base, success: false, error: message });
      continue;
    }

    try {
      const decoded = decodeFunctionResult({ abi: [call.fragment], functionName: call.fragment.name, data: response.returnData });
      const value = formatResult(decoded);
      results.push({ ...base, success: true, value });
    } catch (error) {
      results.push({
        ...base,
        success: false,
        error: `返回数据解码失败：${error instanceof Error ? error.message : "未知错误"}`,
      });
    }
  }

  return results;
}

function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Copy what is displayed: the converted amount when a precision is selected. */
function copyResultValue(value: string | undefined, decimals: number | null) {
  if (!value) {
    toast.error("没有可复制的内容");
    return;
  }
  const converted = formatValueForDecimals(value, decimals);
  navigator.clipboard.writeText(converted ?? value).then(
    () =>
      toast.success(
        converted !== null ? "[COPIED] 已复制转换值" : "[COPIED] 已复制原始值"
      ),
    () => toast.error("[COPY_FAILED] 复制失败")
  );
}

/**
 * Batch (multi-call) reads over the browser wallet provider.
 *
 * Two modes:
 * - MULTI_METHOD: one saved contract, several view/pure methods at once.
 * - MULTI_CONTRACT: one view method of a source ABI, called against several
 *   saved contract addresses on the current chain.
 */
export default function BatchReadTool() {
  const { chainId, address } = useAccount();
  const { publicClient: provider } = useWalletClients();
  const { data: contracts = [], isPending: contractsLoading } = useContracts(chainId);
  const decimals = useValueDecimals();

  const [mode, setMode] = useState<Mode>("multi_method");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedMethodSelectors, setSelectedMethodSelectors] = useState<string[]>([]);
  const [methodParams, setMethodParams] = useState<Record<string, string[]>>({});
  const [sourceMethodSelector, setSourceMethodSelector] = useState("");
  const [sharedParams, setSharedParams] = useState<string[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [results, setResults] = useState<RunResult[]>([]);
  const [running, setRunning] = useState(false);
  const [showParamErrors, setShowParamErrors] = useState(false);

  const selectedContract = useMemo(
    () => contracts.find((contract) => String(contract.id) === selectedContractId),
    [contracts, selectedContractId]
  );

  const ifaceState = useMemo(() => {
    if (!selectedContract) {
      return { iface: null as Abi | null, error: null as string | null };
    }
    try {
      return { iface: normalizeAbi(selectedContract.abi), error: null as string | null };
    } catch (error) {
      return {
        iface: null as Abi | null,
        error: error instanceof Error ? error.message : "ABI 无法解析",
      };
    }
  }, [selectedContract]);

  const iface = ifaceState.iface;

  const readMethods = useMemo(() => {
    if (!ifaceState.iface) return [] as AbiFunction[];
    return ifaceState.iface
      .filter((fragment): fragment is AbiFunction => fragment.type === "function")
      .filter(isReadMethod);
  }, [ifaceState]);

  const sourceMethod = useMemo(
    () => readMethods.find((method) => abiSelector(method) === sourceMethodSelector) ?? null,
    [readMethods, sourceMethodSelector]
  );

  const allTargetsSelected =
    contracts.length > 0 && contracts.every((contract) => selectedTargetIds.includes(contract.id));

  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setResults([]);
  };

  const handleContractChange = (value: string) => {
    setSelectedContractId(value);
    setSelectedMethodSelectors([]);
    setMethodParams({});
    setSourceMethodSelector("");
    setSharedParams([]);
    setResults([]);
  };

  const toggleMethod = (selector: string) => {
    setSelectedMethodSelectors((prev) =>
      prev.includes(selector) ? prev.filter((item) => item !== selector) : [...prev, selector]
    );
    setResults([]);
  };

  const setMethodParam = (method: AbiFunction, index: number, value: string) => {
    setMethodParams((prev) => {
      const current = prev[abiSelector(method)] ?? new Array(method.inputs.length).fill("");
      const next = [...current];
      next[index] = value;
      return { ...prev, [abiSelector(method)]: next };
    });
  };

  const handleSourceMethodChange = (value: string) => {
    setSourceMethodSelector(value);
    setSharedParams([]);
    setResults([]);
  };

  const setSharedParam = (index: number, value: string) => {
    setSharedParams((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const toggleTarget = (id: number) => {
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setResults([]);
  };

  const toggleAllTargets = () => {
    setSelectedTargetIds(allTargetsSelected ? [] : contracts.map((contract) => contract.id));
    setResults([]);
  };

  const runBatch = async () => {
    setShowParamErrors(true);
    if (!chainId) {
      toast.error("[WALLET_MISSING] 请先连接钱包");
      return;
    }
    if (!selectedContract) {
      toast.error("[INPUT_REQUIRED] 请选择一个已保存的合约");
      return;
    }
    if (!getMulticall3Address(chainId)) {
      toast.error("[UNSUPPORTED_CHAIN] 当前网络未部署 Multicall3，无法批量读取");
      return;
    }

    if (mode === "multi_method") {
      const methodsToRun = readMethods.filter((method) =>
        selectedMethodSelectors.includes(abiSelector(method))
      );
      if (methodsToRun.length === 0) {
        toast.error("[INPUT_REQUIRED] 请至少勾选一个读取方法");
        return;
      }

      setRunning(true);
      setResults([]);
      try {
        if (!iface) throw new Error("该合约的 ABI 无法解析");
        const calls: AggregateCall[] = methodsToRun.map((method) => {
          const args = parseMethodParams(method, methodParams[abiSelector(method)] ?? []);
          return {
            key: `method-${abiSelector(method)}`,
            label: method.name,
            target: selectedContract.address,
            fragment: method,
            args,
            callData: encodeFunctionData({ abi: [method], functionName: method.name, args }),
          };
        });

        if (!provider) {
          toast.error("[WALLET_MISSING] 请先连接钱包");
          return;
        }

        const nextResults = await executeAggregate(
          provider,
          chainId,
          selectedContract.abi,
          calls,
          address
        );

        setResults(nextResults);
        const failed = nextResults.filter((result) => !result.success).length;
        if (failed === 0) {
          toast.success(`[READ_OK] ${nextResults.length} 个方法读取成功`);
        } else {
          toast.error(`[READ_PARTIAL] ${failed} 个方法读取失败`);
        }
      } catch (error) {
        toast.error(
          `[READ_FAILED] 批量读取失败: ${error instanceof Error ? error.message : "未知错误"}`
        );
      } finally {
        setRunning(false);
      }
      return;
    }

    const method = sourceMethod;
    if (!method) {
      toast.error("[INPUT_REQUIRED] 请选择一个读取方法");
      return;
    }
    const targets = contracts.filter((contract) => selectedTargetIds.includes(contract.id));
    if (targets.length === 0) {
      toast.error("[INPUT_REQUIRED] 请至少勾选一个合约地址");
      return;
    }

    let sharedArgs: unknown[];
    try {
      sharedArgs = parseMethodParams(method, sharedParams);
    } catch (error) {
      toast.error(
        `[INVALID_PARAM] 参数解析失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
      return;
    }

    setRunning(true);
    setResults([]);
    try {
      if (!iface) throw new Error("该合约的 ABI 无法解析");
      const callData = encodeFunctionData({ abi: [method], functionName: method.name, args: sharedArgs });
      const calls: AggregateCall[] = targets.map((target) => ({
        key: `contract-${target.id}`,
        label: target.name,
        address: target.address,
        target: target.address,
        fragment: method,
        args: sharedArgs,
        callData,
      }));

      if (!provider) throw new Error("请先连接钱包");

      const nextResults = await executeAggregate(
        provider,
        chainId,
        selectedContract.abi,
        calls,
        address
      );

      setResults(nextResults);
      const failed = nextResults.filter((result) => !result.success).length;
      if (failed === 0) {
        toast.success(`[READ_OK] ${nextResults.length} 个合约读取成功`);
      } else {
        toast.error(`[READ_PARTIAL] ${failed} 个合约读取失败`);
      }
    } catch (error) {
      toast.error(
        `[READ_FAILED] 跨合约读取失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    } finally {
      setRunning(false);
    }
  };

  const runLabel = mode === "multi_method" ? "批量读取" : "跨合约读取";
  const multicallAddress = getMulticall3Address(chainId);

  // Chains without a Multicall3 deployment cannot batch at all, so the tool is
  // explicitly unavailable there instead of silently falling back.
  if (chainId && !multicallAddress) {
    return (
      <div className="terminal-card">
        <ToolHeader title="BATCH_READ" subtitle="批量读取只读方法" chip="UNSUPPORTED" />
        <div className="terminal-panel-body space-y-2">
          <p className="text-[12px] font-medium text-[var(--terminal-orange)]">
            当前网络没有 Multicall3 部署
          </p>
          <p className="text-[12px] leading-relaxed text-[var(--terminal-text-secondary)]">
            批量读取依赖 Multicall3 的 aggregate3。chainId {chainId} 不在部署列表中，
            因此该网络不提供批量读取，请切换到已部署 Multicall3 的网络。
          </p>
          <p className="text-[10px] text-[var(--terminal-text-secondary)]">
            部署列表见 multicall3.com/deployments
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-card">
      <ToolHeader
        title="BATCH_READ"
        subtitle="批量读取只读方法：同合约多方法 / 同方法多合约"
        chip="MULTICALL"
      />

      <div className="terminal-panel-body space-y-3">
        <div
          className="flex gap-1 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-1"
          role="tablist"
          aria-label="批量读取模式"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "multi_method"}
            onClick={() => switchMode("multi_method")}
            className={`flex-1 cursor-pointer border py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
              mode === "multi_method"
                ? "border-[var(--terminal-blue)] bg-[var(--terminal-card)] text-[var(--terminal-blue)]"
                : "border-transparent text-[var(--terminal-text-secondary)]"
            }`}
          >
            MULTI_METHOD
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "multi_contract"}
            onClick={() => switchMode("multi_contract")}
            className={`flex-1 cursor-pointer border py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
              mode === "multi_contract"
                ? "border-[var(--terminal-blue)] bg-[var(--terminal-card)] text-[var(--terminal-blue)]"
                : "border-transparent text-[var(--terminal-text-secondary)]"
            }`}
          >
            MULTI_CONTRACT
          </button>
        </div>

        <section className="space-y-1.5">
          <label
            htmlFor="batch-read-contract"
            className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]"
          >
            {mode === "multi_method" ? "[CONTRACT]" : "[SOURCE_CONTRACT]"}
          </label>
          <select
            id="batch-read-contract"
            name="batch-read-contract"
            value={selectedContractId}
            onChange={(event) => handleContractChange(event.target.value)}
            className="terminal-input cursor-pointer text-[13px]"
            disabled={contractsLoading || running}
          >
            <option value="">{contractsLoading ? "加载中…" : "选择已保存合约…"}</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={String(contract.id)}>
                {contract.name} ({shortAddress(contract.address)})
              </option>
            ))}
          </select>
          {!chainId && (
            <p className="text-[10px] text-[var(--terminal-text-secondary)]">
              请先连接钱包以加载当前链的已保存合约。
            </p>
          )}
          {chainId && !contractsLoading && contracts.length === 0 && (
            <p className="text-[10px] text-[var(--terminal-text-secondary)]">
              当前链还没有已保存的合约。
            </p>
          )}
          {ifaceState.error && (
            <p className="break-all text-[10px] text-[var(--terminal-red)]" role="alert">
              [ABI_ERROR] {ifaceState.error}
            </p>
          )}
        </section>

        {mode === "multi_method" ? (
          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                [READ_METHODS] ({readMethods.length})
              </p>
              {selectedMethodSelectors.length > 0 && (
                <span className="terminal-badge shrink-0">
                  已选 {selectedMethodSelectors.length}
                </span>
              )}
            </div>
            <div className="border border-[var(--terminal-separator)]">
              {!selectedContract ? (
                <p className="px-2.5 py-3 text-[12px] text-[var(--terminal-text-secondary)]">
                  先选择上方合约。
                </p>
              ) : readMethods.length === 0 ? (
                <p className="px-2.5 py-3 text-[12px] text-[var(--terminal-text-secondary)]">
                  该合约没有可读取的 view/pure 方法。
                </p>
              ) : (
                readMethods.map((method, index) => {
                  const checked = selectedMethodSelectors.includes(abiSelector(method));
                  return (
                    <div
                      key={abiSelector(method)}
                      className={index > 0 ? "border-t border-[var(--terminal-separator)]" : ""}
                    >
                      <label className="flex cursor-pointer items-start gap-2 px-2.5 py-2 hover:bg-[var(--terminal-fill)]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMethod(abiSelector(method))}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--terminal-blue)]"
                          aria-label={`选择方法 ${method.name}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-all font-mono text-[12px] text-[var(--terminal-text)]">
                            {method.name}
                            <span className="ml-1.5 font-sans text-[10px] text-[var(--terminal-text-secondary)]">
                              ({method.inputs.length} params)
                            </span>
                          </span>
                          <span className="mt-0.5 block break-all font-mono text-[10px] text-[var(--terminal-text-secondary)]">
                            {abiSelector(method)}
                          </span>
                        </span>
                      </label>

                      {checked && method.inputs.length > 0 && (
                        <div className="space-y-2 px-2.5 pb-2.5 pl-8">
                          {method.inputs.map((input, paramIndex) => (
                            <AbiParamInput key={paramIndex} index={paramIndex} input={input} id={`mm-${abiSelector(method)}-${paramIndex}`} value={methodParams[abiSelector(method)]?.[paramIndex] ?? ""} onChange={(value) => setMethodParam(method, paramIndex, value)} showError={showParamErrors} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                [SOURCE_METHOD]
              </p>
              <select
                id="batch-read-source-method"
                name="batch-read-source-method"
                value={sourceMethodSelector}
                onChange={(event) => handleSourceMethodChange(event.target.value)}
                className="terminal-input cursor-pointer text-[13px]"
                disabled={!selectedContract || readMethods.length === 0 || running}
                aria-label="选择要跨合约调用的读取方法"
              >
                <option value="">选择读取方法…</option>
                {readMethods.map((method) => (
                  <option key={abiSelector(method)} value={abiSelector(method)}>
                    {method.name} ({method.inputs.length} params)
                  </option>
                ))}
              </select>

              {sourceMethod && sourceMethod.inputs.length > 0 && (
                <div className="space-y-2 border border-[var(--terminal-separator)] p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                    [PARAMS]
                  </p>
                  {sourceMethod.inputs.map((input, index) => (
                    <AbiParamInput key={index} index={index} input={input} id={`mc-param-${index}`} value={sharedParams[index] ?? ""} onChange={(value) => setSharedParam(index, value)} showError={showParamErrors} />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                  [TARGET_CONTRACTS] ({selectedTargetIds.length}/{contracts.length})
                </p>
                <button
                  type="button"
                  onClick={toggleAllTargets}
                  disabled={contracts.length === 0 || running}
                  className="terminal-btn terminal-btn-secondary shrink-0 px-2 py-0.5 text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {allTargetsSelected ? "取消全选" : "全选"}
                </button>
              </div>
              <div className="max-h-[180px] overflow-y-auto border border-[var(--terminal-separator)]">
                {contracts.length === 0 ? (
                  <p className="px-2.5 py-3 text-[12px] text-[var(--terminal-text-secondary)]">
                    当前链没有已保存的合约。
                  </p>
                ) : (
                  contracts.map((contract, index) => (
                    <label
                      key={contract.id}
                      className={`flex cursor-pointer items-start gap-2 px-2.5 py-1.5 hover:bg-[var(--terminal-fill)] ${
                        index > 0 ? "border-t border-[var(--terminal-separator)]" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTargetIds.includes(contract.id)}
                        onChange={() => toggleTarget(contract.id)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--terminal-blue)]"
                        aria-label={`选择合约 ${contract.name}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-[var(--terminal-text)]">
                          {contract.name}
                        </span>
                        <span className="block break-all font-mono text-[10px] text-[var(--terminal-text-secondary)]">
                          {shortAddress(contract.address)}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void runBatch()}
            disabled={running}
            aria-busy={running}
            className="terminal-btn terminal-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? (
              <>
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
                <span>读取中…</span>
              </>
            ) : (
              <>
                <Play size={13} aria-hidden="true" />
                <span>{runLabel}</span>
              </>
            )}
          </button>
          {results.length > 0 && !running && (
            <button
              type="button"
              onClick={() => setResults([])}
              className="terminal-btn terminal-btn-secondary shrink-0 px-3"
            >
              清空
            </button>
          )}
        </div>

        {multicallAddress && (
          <p className="break-all text-[10px] leading-relaxed text-[var(--terminal-text-secondary)]">
            Multicall3 {shortAddress(multicallAddress)} · 所有读取合并为一次 aggregate3 调用
          </p>
        )}

        {results.length > 0 && (
          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                [RESULTS]
              </p>
              <span className="terminal-badge shrink-0">
                成功 {successCount} / 失败 {failureCount}
              </span>
            </div>
            <div className="border border-[var(--terminal-separator)]">
              {results.map((result, index) => (
                <div
                  key={result.key}
                  className={`space-y-1 px-2.5 py-2 ${
                    index > 0 ? "border-t border-[var(--terminal-separator)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span
                        className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-bold ${
                          result.success
                            ? "border-[var(--terminal-green)]/40 text-[var(--terminal-green)]"
                            : "border-[var(--terminal-red)]/40 text-[var(--terminal-red)]"
                        }`}
                      >
                        {result.success ? "成功" : "失败"}
                      </span>
                      <span className="min-w-0 break-all font-mono text-[12px] text-[var(--terminal-text)]">
                        {result.label}
                      </span>
                    </div>
                    {result.success && (
                      <button
                        type="button"
                        onClick={() => copyResultValue(result.value, decimals)}
                        className="shrink-0 border border-transparent p-0.5 text-[var(--terminal-text-secondary)] transition-colors hover:border-[var(--terminal-separator)] hover:bg-[var(--terminal-fill)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
                        aria-label={`复制 ${result.label} 的读取结果`}
                        title={
                          formatValueForDecimals(result.value ?? "", decimals) !== null
                            ? "复制转换值"
                            : "复制原始结果"
                        }
                      >
                        <Copy size={11} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {result.address && (
                    <p className="break-all font-mono text-[12px] text-[var(--terminal-text-secondary)]">
                      {result.address}
                    </p>
                  )}
                  <div className="break-all font-mono text-[12px]">
                    {result.success ? (
                      <ValueDisplay
                        value={result.value || "—"}
                        className="text-[var(--terminal-text)]"
                      />
                    ) : (
                      <span className="text-[var(--terminal-red)]">
                        {result.error || "未知错误"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
