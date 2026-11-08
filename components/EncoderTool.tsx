"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { Braces, ClipboardPaste, Code, Copy, Database } from "lucide-react";
import ToolHeader from "@/components/tools/ToolHeader";
import { useContracts } from "@/lib/queries";
import { parseMethodParam, parseMethodParams } from "@/lib/contract-utils";
import AbiParamInput from "@/components/AbiParamInput";

type Mode = "calldata" | "constructor";
type AbiSource = "saved" | "manual";

interface FunctionItem {
  signature: string;
  selector: string;
  fragment: ethers.FunctionFragment;
}

interface CallOutput {
  data: string;
  selector: string;
  signature: string;
}

interface ParsedAbi {
  iface: ethers.Interface | null;
  error: string | null;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("[COPIED] 已复制到剪贴板"),
    () => toast.error("[COPY_FAILED] 复制失败")
  );
}

/** Shared class builder so both segmented controls keep the exact same look. */
function segmentClass(active: boolean): string {
  return `flex-1 py-2 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer ${
    active
      ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
      : "border-transparent text-[var(--terminal-text-secondary)]"
  }`;
}

/** Split an ABI-encoded hex blob into 32-byte words for readability. */
function splitChunks(hex: string): string[] {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += 64) {
    chunks.push(body.slice(i, i + 64));
  }
  return chunks;
}

export default function EncoderTool() {
  const { chainId } = useAccount();
  const { data: contracts, error: contractsError } = useContracts(chainId);

  const [mode, setMode] = useState<Mode>("calldata");
  const [abiSource, setAbiSource] = useState<AbiSource>("saved");
  const [selectedContractId, setSelectedContractId] = useState<number | "">("");
  const [manualAbi, setManualAbi] = useState("");
  const [selectedFunction, setSelectedFunction] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [showParamErrors, setShowParamErrors] = useState(false);
  const [ctorParams, setCtorParams] = useState<string[]>([]);
  const [callOutput, setCallOutput] = useState<CallOutput | null>(null);
  const [ctorOutput, setCtorOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedContracts = useMemo(
    () => (Array.isArray(contracts) ? contracts : []),
    [contracts]
  );

  // Build the interface from whichever ABI source is active. Everything is
  // derived, so switching sources can never leave a stale Interface behind.
  const parsedAbi = useMemo<ParsedAbi>(() => {
    let abi: ethers.InterfaceAbi | null = null;

    if (abiSource === "saved") {
      const contract =
        selectedContractId === ""
          ? undefined
          : savedContracts.find((item) => item.id === selectedContractId);
      if (!contract) return { iface: null, error: null };
      abi = contract.abi;
    } else {
      const trimmed = manualAbi.trim();
      if (!trimmed) return { iface: null, error: null };
      try {
        abi = JSON.parse(trimmed) as ethers.InterfaceAbi;
      } catch {
        return { iface: null, error: "ABI JSON 格式无效，请检查是否为合法的 JSON 数组" };
      }
    }

    try {
      return { iface: new ethers.Interface(abi), error: null };
    } catch {
      return { iface: null, error: "ABI 解析失败，请确认内容是 ABI 数组" };
    }
  }, [abiSource, savedContracts, selectedContractId, manualAbi]);

  const iface = parsedAbi.iface;

  const functionItems = useMemo<FunctionItem[]>(() => {
    if (!iface) return [];
    const unique = new Map<string, FunctionItem>();
    iface.forEachFunction((fragment) => {
      const signature = fragment.format("sighash");
      if (!unique.has(signature)) {
        unique.set(signature, { signature, selector: fragment.selector, fragment });
      }
    });
    return Array.from(unique.values());
  }, [iface]);

  const selectedFn =
    functionItems.find((item) => item.signature === selectedFunction) ?? null;
  const method = selectedFn ? selectedFn.fragment : null;
  const methodInputs = method ? method.inputs : [];

  const ctorInputs = useMemo(() => iface?.deploy?.inputs ?? [], [iface]);
  const ctorChunks = useMemo(
    () => (ctorOutput ? splitChunks(ctorOutput) : []),
    [ctorOutput]
  );

  const resetOutputs = () => {
    setCallOutput(null);
    setCtorOutput(null);
    setError(null);
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    resetOutputs();
  };

  const changeAbiSource = (next: AbiSource) => {
    if (next === abiSource) return;
    setAbiSource(next);
    setSelectedFunction("");
    setParams([]);
    setCtorParams([]);
    resetOutputs();
  };

  const changeContract = (value: string) => {
    setSelectedContractId(value ? Number(value) : "");
    setSelectedFunction("");
    setParams([]);
    setCtorParams([]);
    resetOutputs();
  };

  const changeManualAbi = (value: string) => {
    setManualAbi(value);
    setSelectedFunction("");
    setParams([]);
    setCtorParams([]);
    resetOutputs();
  };

  const changeFunction = (signature: string) => {
    setSelectedFunction(signature);
    const next = functionItems.find((item) => item.signature === signature);
    setParams(next ? next.fragment.inputs.map(() => "") : []);
    setCallOutput(null);
    setError(null);
  };

  const changeParam = (index: number, value: string) => {
    setParams((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setCallOutput(null);
    setError(null);
  };

  const changeCtorParam = (index: number, value: string) => {
    setCtorParams((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setCtorOutput(null);
    setError(null);
  };

  const fail = (title: string, detail: string) => {
    setError(detail);
    setCallOutput(null);
    setCtorOutput(null);
    toast.error(`${title} ${detail}`);
  };

  const handleEncodeCall = () => {
    setShowParamErrors(true);
    setError(null);
    if (!iface) {
      fail("[INPUT_REQUIRED]", "请先选择已保存的合约或粘贴 ABI JSON");
      return;
    }
    if (!method || !selectedFn) {
      fail("[INPUT_REQUIRED]", "请选择一个函数");
      return;
    }

    try {
      const raw = methodInputs.map((_, index) => params[index] ?? "");
      const args = parseMethodParams(method, raw);
      const data = iface.encodeFunctionData(method, args);
      setCallOutput({ data, selector: selectedFn.selector, signature: selectedFn.signature });
      setCtorOutput(null);
      toast.success("[ENCODE_OK] Calldata 生成成功");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      fail("[ENCODE_FAILED]", `编码失败: ${message}`);
    }
  };

  const handleEncodeConstructor = () => {
    setShowParamErrors(true);
    setError(null);
    if (!iface) {
      fail("[INPUT_REQUIRED]", "请先选择已保存的合约或粘贴 ABI JSON");
      return;
    }

    try {
      const values = ctorInputs.map((input, index) =>
        parseMethodParam(input, ctorParams[index] ?? "")
      );
      const data = iface.encodeDeploy(values);
      setCtorOutput(data);
      setCallOutput(null);
      toast.success(
        ctorInputs.length === 0
          ? "[ENCODE_OK] 该构造函数没有参数，输出 0x"
          : "[ENCODE_OK] 构造参数编码完成"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      fail("[ENCODE_FAILED]", `编码失败: ${message}`);
    }
  };

  const savedHint =
    abiSource === "saved" && savedContracts.length > 0 && !iface
      ? "请选择一个已保存的合约以加载 ABI"
      : null;

  return (
    <div className="terminal-card">
      <ToolHeader
        title="ENCODER"
        subtitle="由 ABI 编码函数调用与构造参数"
        chip="ENCODE"
      />

      <div className="terminal-panel-body space-y-3">
        {/* MODE */}
        <div className="border border-[var(--terminal-separator)]">
          <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)]">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
              [MODE]
            </p>
          </div>
          <div className="p-3 flex gap-1 bg-[var(--terminal-fill)]">
            <button
              type="button"
              aria-pressed={mode === "calldata"}
              className={segmentClass(mode === "calldata")}
              onClick={() => changeMode("calldata")}
            >
              <Code size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
              CALLDATA
            </button>
            <button
              type="button"
              aria-pressed={mode === "constructor"}
              className={segmentClass(mode === "constructor")}
              onClick={() => changeMode("constructor")}
            >
              <Braces size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
              CONSTRUCTOR
            </button>
          </div>
        </div>

        {/* ABI_SOURCE — shared by both modes */}
        <div className="border border-[var(--terminal-separator)]">
          <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)]">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
              [ABI_SOURCE]
            </p>
          </div>
          <div className="p-3 space-y-3">
            <div className="flex gap-1 p-1 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]">
              <button
                type="button"
                aria-pressed={abiSource === "saved"}
                className={segmentClass(abiSource === "saved")}
                onClick={() => changeAbiSource("saved")}
              >
                <Database size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
                SAVED
              </button>
              <button
                type="button"
                aria-pressed={abiSource === "manual"}
                className={segmentClass(abiSource === "manual")}
                onClick={() => changeAbiSource("manual")}
              >
                <ClipboardPaste size={13} className="inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
                MANUAL
              </button>
            </div>

            {abiSource === "saved" ? (
              <div className="space-y-2">
                {!chainId ? (
                  <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                    请先连接钱包以加载当前链已保存的合约
                  </p>
                ) : null}
                {chainId && contractsError ? (
                  <p className="text-[12px] text-[var(--terminal-red)]">
                    获取合约列表失败，请稍后重试
                  </p>
                ) : null}
                <select
                  id="encoder-contract"
                  name="encoder-contract"
                  value={selectedContractId}
                  onChange={(e) => changeContract(e.target.value)}
                  className="terminal-input cursor-pointer text-[13px]"
                  disabled={!chainId || savedContracts.length === 0}
                >
                  <option value="">Select contract...</option>
                  {savedContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.name} ({contract.address.slice(0, 6)}...{contract.address.slice(-4)})
                    </option>
                  ))}
                </select>
                {chainId && savedContracts.length === 0 && !contractsError ? (
                  <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                    当前链暂无可用的已保存合约
                  </p>
                ) : null}
                {savedHint ? (
                  <p className="text-[12px] text-[var(--terminal-text-secondary)]">{savedHint}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <textarea
                  id="encoder-abi"
                  name="encoder-abi"
                  value={manualAbi}
                  onChange={(e) => changeManualAbi(e.target.value)}
                  className="terminal-input font-mono text-[12px] resize-none"
                  placeholder="Paste ABI JSON array..."
                  rows={6}
                  autoComplete="off"
                  spellCheck={false}
                />
                {parsedAbi.error ? (
                  <p className="text-[12px] text-[var(--terminal-red)] break-all">{parsedAbi.error}</p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Mode specific form */}
        {mode === "calldata" ? (
          <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 space-y-3">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
              [FUNCTION]
            </p>

            {!iface ? (
              <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                提供 ABI 后即可选择函数并填写参数
              </p>
            ) : functionItems.length === 0 ? (
              <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                该 ABI 中没有可编码的函数
              </p>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="encoder-function"
                    className="block text-[12px] font-medium text-[var(--terminal-text-secondary)] mb-1.5"
                  >
                    函数
                  </label>
                  <select
                    id="encoder-function"
                    name="encoder-function"
                    value={selectedFunction}
                    onChange={(e) => changeFunction(e.target.value)}
                    className="terminal-input cursor-pointer font-mono text-[12px]"
                  >
                    <option value="">Select function...</option>
                    {functionItems.map((item) => (
                      <option key={item.signature} value={item.signature}>
                        {item.signature}
                      </option>
                    ))}
                  </select>
                  {method ? (
                    <p className="mt-1.5 font-mono text-[11px] text-[var(--terminal-text-secondary)]">
                      selector {method.selector}
                    </p>
                  ) : null}
                </div>

                {method ? (
                  methodInputs.length === 0 ? (
                    <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                      该函数没有参数
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {methodInputs.map((input, index) => (
                        <AbiParamInput key={index} index={index} input={input} id={`encoder-param-${index}`} value={params[index] ?? ""} onChange={(value) => changeParam(index, value)} showError={showParamErrors} />
                      ))}
                    </div>
                  )
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 space-y-3">
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
              [CONSTRUCTOR_ARGS]
            </p>
            <p className="text-[11px] leading-relaxed text-[var(--terminal-text-secondary)]">
              本应用不保存部署字节码，输出为 ABI 编码后的构造参数，需自行拼接在 bytecode 之后。
            </p>

            {!iface ? (
              <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                提供 ABI 后即可填写构造参数
              </p>
            ) : ctorInputs.length === 0 ? (
              <p className="text-[12px] text-[var(--terminal-text-secondary)]">
                该 ABI 的构造函数没有参数
              </p>
            ) : (
              <div className="space-y-3">
                {ctorInputs.map((input, index) => (
                  <AbiParamInput key={index} index={index} input={input} id={`encoder-ctor-${index}`} value={ctorParams[index] ?? ""} onChange={(value) => changeCtorParam(index, value)} showError={showParamErrors} />
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="terminal-btn terminal-btn-primary w-full"
          onClick={mode === "calldata" ? handleEncodeCall : handleEncodeConstructor}
        >
          {mode === "calldata" ? (
            <>
              <Code size={14} aria-hidden="true" />
              <span>生成 Calldata</span>
            </>
          ) : (
            <>
              <Braces size={14} aria-hidden="true" />
              <span>生成构造参数</span>
            </>
          )}
        </button>

        {error ? (
          <p className="text-[12px] break-all text-[var(--terminal-red)]">{error}</p>
        ) : null}

        {/* CALLDATA output */}
        {mode === "calldata" && callOutput ? (
          <div className="border border-[var(--terminal-separator)]">
            <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
                [CALLDATA]
              </span>
              <button
                type="button"
                className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px]"
                onClick={() => copyToClipboard(callOutput.data)}
              >
                <Copy size={12} aria-hidden="true" />
                COPY
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[12px] font-mono text-[var(--terminal-text-secondary)] break-all">
                selector {callOutput.selector}
              </p>
              <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-2.5">
                <p className="break-all font-mono text-[12px] text-[var(--terminal-text)]">
                  {callOutput.data}
                </p>
              </div>
              <p className="text-[11px] text-[var(--terminal-text-secondary)] break-all">
                {callOutput.signature}
              </p>
            </div>
          </div>
        ) : null}

        {/* CONSTRUCTOR output */}
        {mode === "constructor" && ctorOutput !== null ? (
          <div className="border border-[var(--terminal-separator)]">
            <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
                [ENCODED_ARGS]
              </span>
              <button
                type="button"
                className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px]"
                onClick={() => copyToClipboard(ctorOutput)}
              >
                <Copy size={12} aria-hidden="true" />
                复制完整参数
              </button>
            </div>
            <div className="p-3">
              <div className="space-y-1 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-2.5">
                {ctorChunks.length === 0 ? (
                  <p className="break-all font-mono text-[12px] text-[var(--terminal-text)]">0x</p>
                ) : (
                  ctorChunks.map((chunk, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="shrink-0 font-mono text-[10px] leading-5 text-[var(--terminal-text-secondary)]">
                        [{index}]
                      </span>
                      <button
                        type="button"
                        title="点击复制该分块"
                        onClick={() => copyToClipboard(chunk)}
                        className="min-w-0 cursor-pointer break-all text-left font-mono text-[12px] text-[var(--terminal-text)] transition-colors hover:text-[var(--terminal-blue)]"
                      >
                        {chunk}
                      </button>
                    </div>
                  ))
                )}
              </div>
              {ctorChunks.length === 0 ? (
                <p className="mt-2 text-[11px] text-[var(--terminal-text-secondary)]">
                  构造函数无参数，编码结果为 0x
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
