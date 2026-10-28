"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { useSpring, animated } from "react-spring";
import { FileSearch, Database, ClipboardPaste, ArrowRightLeft, ScrollText } from "lucide-react";
import ToolHeader from "@/components/tools/ToolHeader";
import { formatResult } from "@/lib/contract-utils";
import { listContractsByChainId } from "@/lib/local-store";

type Mode = "calldata" | "txhash";
type AbiSource = "saved" | "manual";

interface SavedContract {
  id: number;
  name: string;
  address: string;
  chainId: number;
  abi: ethers.InterfaceAbi;
}

interface DecodedParam {
  name: string;
  type: string;
  value: string;
}

interface DecodedFunction {
  functionName: string;
  selector: string;
  params: DecodedParam[];
}

interface TxInfo {
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  blockNumber: number;
}

interface DecodedEvent {
  name: string;
  params: DecodedParam[];
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("[COPIED] 已复制到剪贴板"),
    () => toast.error("[COPY_FAILED] 复制失败")
  );
}

function ClickToCopy({ value }: { value: string }) {
  return (
    <span
      onClick={() => copyToClipboard(value)}
      className="cursor-pointer hover:text-[var(--terminal-blue)] transition-colors"
      title="点击复制"
    >
      {value}
    </span>
  );
}

function ParamsTable({ params }: { params: DecodedParam[] }) {
  if (params.length === 0) {
    return <p className="text-[13px] text-[var(--terminal-text-secondary)]">无参数</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[var(--terminal-text-secondary)] text-[12px]">
            <th className="text-left pb-2 font-medium">参数名</th>
            <th className="text-left pb-2 font-medium">类型</th>
            <th className="text-left pb-2 font-medium">值</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="border-t border-[var(--terminal-separator)]">
              <td className="py-2 font-mono">{p.name || `arg${i}`}</td>
              <td className="py-2 text-[var(--terminal-text-secondary)]">{p.type}</td>
              <td className="py-2 font-mono break-all">
                <ClickToCopy value={p.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-t border-[var(--terminal-separator)] first:border-t-0">
      <span className="text-[13px] text-[var(--terminal-text-secondary)] shrink-0">{label}</span>
      <span className="text-[13px] font-mono text-[var(--terminal-text)] break-all text-right">
        <ClickToCopy value={value} />
      </span>
    </div>
  );
}

export default function TxDecoderTool() {
  const { chainId } = useAccount();
  const [mode, setMode] = useState<Mode>("calldata");
  const [abiSource, setAbiSource] = useState<AbiSource>("saved");
  const [calldata, setCalldata] = useState("");
  const [txHash, setTxHash] = useState("");
  const [manualAbi, setManualAbi] = useState("");
  const [savedContracts, setSavedContracts] = useState<SavedContract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  // 解码结果
  const [decodedFunction, setDecodedFunction] = useState<DecodedFunction | null>(null);
  const [txInfo, setTxInfo] = useState<TxInfo | null>(null);
  const [decodedEvents, setDecodedEvents] = useState<DecodedEvent[]>([]);

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const resultSpring = useSpring({
    opacity: decodedFunction || txInfo ? 1 : 0,
    transform: decodedFunction || txInfo ? "translateY(0px)" : "translateY(4px)",
    config: { tension: 300, friction: 26 },
  });

  // 获取已保存合约列表
  useEffect(() => {
    if (abiSource === "saved" && chainId) {
      listContractsByChainId(chainId)
        .then((data) => {
          if (Array.isArray(data)) setSavedContracts(data);
        })
        .catch(() => toast.error("[LOAD_FAILED] 获取合约列表失败"));
      return;
    }
    if (abiSource === "saved") {
      setSavedContracts([]);
      setSelectedContractId("");
    }
  }, [abiSource, chainId]);

  const getAbi = useCallback((): ethers.InterfaceAbi | null => {
    if (abiSource === "saved") {
      const contract = savedContracts.find((c) => c.id === selectedContractId);
      if (!contract) {
        toast.error("[INPUT_REQUIRED] 请选择一个已保存的合约");
        return null;
      }
      return contract.abi;
    } else {
      if (!manualAbi.trim()) {
        toast.error("[INPUT_REQUIRED] 请输入 ABI JSON");
        return null;
      }
      try {
        return JSON.parse(manualAbi);
      } catch {
        toast.error("[INVALID_INPUT] ABI JSON 格式无效");
        return null;
      }
    }
  }, [abiSource, savedContracts, selectedContractId, manualAbi]);

  const decodeParams = (
    fragment: ethers.FunctionFragment,
    decoded: ethers.Result
  ): DecodedParam[] => {
    return fragment.inputs.map((input, i) => ({
      name: input.name,
      type: input.type,
      value: formatResult(decoded[i]),
    }));
  };

  const handleDecodeCalldata = () => {
    const trimmed = calldata.trim();
    if (!trimmed || !trimmed.startsWith("0x")) {
      toast.error("[INVALID_INPUT] 请输入有效的 calldata（0x 开头的十六进制字符串）");
      return;
    }
    const abi = getAbi();
    if (!abi) return;

    try {
      const iface = new ethers.Interface(abi);
      const selector = trimmed.slice(0, 10);
      const fragment = iface.getFunction(selector);

      if (!fragment) {
        toast.error("[DECODE_MISS] ABI 中无匹配函数");
        return;
      }

      const decoded = iface.decodeFunctionData(fragment, trimmed);
      const params = decodeParams(fragment, decoded);
      setDecodedFunction({
        functionName: fragment.name,
        selector: fragment.selector,
        params,
      });
      setTxInfo(null);
      setDecodedEvents([]);
      toast.success("[DECODE_OK] 解码成功");
    } catch {
      toast.error("[DECODE_MISS] ABI 中无匹配函数");
    }
  };

  const handleDecodeTxHash = async () => {
    const trimmed = txHash.trim();
    if (!trimmed || !trimmed.startsWith("0x") || trimmed.length !== 66) {
      toast.error("[INVALID_INPUT] 请输入有效的交易哈希（66 位 0x 开头）");
      return;
    }
    const abi = getAbi();
    if (!abi) return;

    const ethereum = (window as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!ethereum) {
      toast.error("[WALLET_MISSING] 未检测到钱包，请安装 MetaMask 等浏览器钱包");
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(trimmed),
        provider.getTransactionReceipt(trimmed),
      ]);

      if (!tx) {
        toast.error("[NOT_FOUND] 交易未找到，请确认链和哈希");
        setLoading(false);
        return;
      }

      // 交易基本信息
      setTxInfo({
        from: tx.from,
        to: tx.to || "合约创建",
        value: ethers.formatEther(tx.value) + " ETH",
        gasUsed: receipt ? receipt.gasUsed.toString() : "N/A",
        blockNumber: tx.blockNumber || 0,
      });

      // 解码函数调用
      const iface = new ethers.Interface(abi);
      try {
        const selector = tx.data.slice(0, 10);
        const fragment = iface.getFunction(selector);

        if (fragment) {
          const decoded = iface.decodeFunctionData(fragment, tx.data);
          const params = decodeParams(fragment, decoded);
          setDecodedFunction({
            functionName: fragment.name,
            selector: fragment.selector,
            params,
          });
        } else {
          setDecodedFunction(null);
        }
      } catch {
        setDecodedFunction(null);
      }

      // 解码事件日志
      if (receipt) {
        const parsedLogs = receipt.logs
          .map((log) => {
            try {
              return iface.parseLog({ topics: [...log.topics], data: log.data });
            } catch {
              return null;
            }
          })
          .filter(Boolean) as ethers.LogDescription[];

        const events: DecodedEvent[] = parsedLogs.map((parsed) => ({
          name: parsed.name,
          params: parsed.fragment.inputs.map((input, i) => ({
            name: input.name,
            type: input.type,
            value: formatResult(parsed.args[i]),
          })),
        }));
        setDecodedEvents(events);
      }

      toast.success("[DECODE_OK] 交易解码成功");
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      toast.error("[DECODE_FAILED] 解码失败: " + message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecode = () => {
    if (mode === "calldata") {
      handleDecodeCalldata();
    } else {
      handleDecodeTxHash();
    }
  };

  const handleClear = () => {
    setCalldata("");
    setTxHash("");
    setManualAbi("");
    setSelectedContractId("");
    setDecodedFunction(null);
    setTxInfo(null);
    setDecodedEvents([]);
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <ToolHeader
        title="TX_DECODER_TOOL"
        subtitle="使用所选 ABI 解码 calldata 或交易哈希"
        chip="DECODE"
      />

      <div className="terminal-panel-body space-y-4">
        <div className="border border-[var(--terminal-separator)]">
          <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)]">
            <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
              [MODE]
            </p>
          </div>
          <div className="p-3 flex gap-1 bg-[var(--terminal-fill)]">
            <button
              className={`flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer ${
                mode === "calldata"
                  ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                  : "border-transparent text-[var(--terminal-text-secondary)]"
              }`}
              onClick={() => {
                setMode("calldata");
                setDecodedFunction(null);
                setTxInfo(null);
                setDecodedEvents([]);
              }}
            >
              <ClipboardPaste size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
              CALLDATA
            </button>
            <button
              className={`flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer ${
                mode === "txhash"
                  ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                  : "border-transparent text-[var(--terminal-text-secondary)]"
              }`}
              onClick={() => {
                setMode("txhash");
                setDecodedFunction(null);
                setTxInfo(null);
                setDecodedEvents([]);
              }}
            >
              <FileSearch size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
              TX_HASH
            </button>
          </div>
        </div>

        <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 space-y-3">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
            [PAYLOAD]
          </p>
          {mode === "calldata" ? (
            <div>
              <label className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                Calldata
              </label>
              <textarea
                value={calldata}
                onChange={(e) => setCalldata(e.target.value)}
                className="terminal-input font-mono text-[13px] resize-none"
                placeholder="0x..."
                rows={5}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : (
            <div>
              <label className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                Transaction Hash
              </label>
              <div className="terminal-prompt-wrap">
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="terminal-input font-mono text-[13px]"
                  placeholder="0x..."
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>

        <div className="border border-[var(--terminal-separator)]">
          <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)]">
            <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
              [ABI_SOURCE]
            </p>
          </div>
          <div className="p-3 space-y-3">
            <div className="flex gap-1 p-1 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]">
              <button
                className={`flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer ${
                  abiSource === "saved"
                    ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                    : "border-transparent text-[var(--terminal-text-secondary)]"
                }`}
                onClick={() => setAbiSource("saved")}
              >
                <Database size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
                SAVED
              </button>
              <button
                className={`flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer ${
                  abiSource === "manual"
                    ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                    : "border-transparent text-[var(--terminal-text-secondary)]"
                }`}
                onClick={() => setAbiSource("manual")}
              >
                <ClipboardPaste size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
                MANUAL
              </button>
            </div>

            {abiSource === "saved" ? (
              <select
                value={selectedContractId}
                onChange={(e) =>
                  setSelectedContractId(e.target.value ? Number(e.target.value) : "")
                }
                className="terminal-input cursor-pointer text-[13px]"
              >
                <option value="">Select contract...</option>
                {savedContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.address.slice(0, 6)}...{c.address.slice(-4)})
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={manualAbi}
                onChange={(e) => setManualAbi(e.target.value)}
                className="terminal-input font-mono text-[13px] resize-none"
                placeholder="Paste ABI JSON array..."
                rows={6}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="terminal-btn terminal-btn-primary flex-1"
            onClick={handleDecode}
            disabled={loading}
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ArrowRightLeft size={14} aria-hidden="true" />
            )}
            <span>{loading ? "DECODING..." : "DECODE"}</span>
          </button>
          <button className="terminal-btn terminal-btn-secondary" onClick={handleClear}>
            CLEAR
          </button>
        </div>

        {(decodedFunction || txInfo) && (
          <animated.div style={resultSpring} className="space-y-4">
            {txInfo && (
              <div className="border border-[var(--terminal-separator)]">
                <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center gap-2">
                  <ScrollText size={14} className="text-[var(--terminal-blue)]" aria-hidden="true" />
                  <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
                    [TRANSACTION_INFO]
                  </span>
                </div>
                <div className="p-3 space-y-0">
                  <InfoRow label="From" value={txInfo.from} />
                  <InfoRow label="To" value={txInfo.to} />
                  <InfoRow label="Value" value={txInfo.value} />
                  <InfoRow label="Gas Used" value={txInfo.gasUsed} />
                  <InfoRow label="Block" value={txInfo.blockNumber.toString()} />
                </div>
              </div>
            )}

            {decodedFunction && (
              <div className="border border-[var(--terminal-separator)]">
                <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center gap-2">
                  <FileSearch size={14} className="text-[var(--terminal-green)]" aria-hidden="true" />
                  <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
                    [FUNCTION_CALL]
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-[15px] font-mono font-semibold text-[var(--terminal-text)]">
                      {decodedFunction.functionName}
                    </span>
                    <code
                      className="text-[12px] font-mono text-[var(--terminal-text-secondary)] bg-[var(--terminal-card)] border border-[var(--terminal-separator)] px-2 py-1 cursor-pointer hover:text-[var(--terminal-blue)] transition-colors"
                      onClick={() => copyToClipboard(decodedFunction.selector)}
                      title="点击复制选择器"
                    >
                      {decodedFunction.selector}
                    </code>
                  </div>
                  <ParamsTable params={decodedFunction.params} />
                </div>
              </div>
            )}

            {txInfo && !decodedFunction && (
              <div className="p-4 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]">
                <p className="text-[13px] text-[var(--terminal-text-secondary)]">
                  未在当前 ABI 中匹配到函数选择器。
                </p>
              </div>
            )}

            {decodedEvents.length > 0 && (
              <div className="border border-[var(--terminal-separator)]">
                <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center gap-2">
                  <ScrollText size={14} className="text-[var(--terminal-purple)]" aria-hidden="true" />
                  <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
                    [DECODED_EVENTS] ({decodedEvents.length})
                  </span>
                </div>
                <div className="p-3 space-y-3">
                  {decodedEvents.map((event, i) => (
                    <div
                      key={i}
                      className="p-3 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 border uppercase"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--terminal-green) 15%, transparent)",
                            color: "var(--terminal-green)",
                          }}
                        >
                          EVENT
                        </span>
                        <span className="text-[14px] font-mono font-medium text-[var(--terminal-text)]">
                          {event.name}
                        </span>
                      </div>
                      <ParamsTable params={event.params} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {txInfo && decodedEvents.length === 0 && (
              <div className="p-4 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]">
                <p className="text-[13px] text-[var(--terminal-text-secondary)]">
                  未解析到可匹配的事件日志。
                </p>
              </div>
            )}
          </animated.div>
        )}
      </div>
    </animated.div>
  );
}
