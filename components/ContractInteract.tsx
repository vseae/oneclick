"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";
import {
  isReadMethod,
  isWriteMethod,
  formatResult,
  parseCustomError,
} from "@/lib/contract-utils";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";
import {
  addHistory,
  clearHistory as clearLocalHistory,
  listHistory,
  updateHistory as updateLocalHistory,
} from "@/lib/local-store";

interface ContractInteractProps {
  contract: any;
}

interface HistoryItem {
  id: number;
  contractId: number;
  contractName: string;
  contractAddress: string;
  methodName: string;
  methodType: "read" | "write";
  params: any[];
  result?: string;
  error?: string;
  txHash?: string;
  timestamp: string;
  chainId: number;
}

export default function ContractInteract({ contract }: ContractInteractProps) {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [selectedMethod, setSelectedMethod] =
    useState<ethers.FunctionFragment | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [ethValue, setEthValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [readSearchQuery, setReadSearchQuery] = useState("");
  const [writeSearchQuery, setWriteSearchQuery] = useState("");
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const [showCalldataDialog, setShowCalldataDialog] = useState(false);
  const [calldataValue, setCalldataValue] = useState("");
  const [calldataEthValue, setCalldataEthValue] = useState("0");

  const fetchHistory = useCallback(async () => {
    try {
      const data = await listHistory({ contractId: contract.id, chainId });
      setHistory(data as HistoryItem[]);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  }, [contract.id, chainId]);

  // Reset state and fetch history when contract changes
  useEffect(() => {
    setSelectedMethod(null);
    setParams([]);
    setEthValue("");
    setReadSearchQuery("");
    setWriteSearchQuery("");
    fetchHistory();
  }, [fetchHistory]);

  const iface = useMemo(() => {
    return new ethers.Interface(contract.abi);
  }, [contract.abi]);

  const methods = useMemo(() => {
    return iface.fragments.filter(
      (f) => f.type === "function"
    ) as ethers.FunctionFragment[];
  }, [iface]);

  const readMethods = useMemo(() => methods.filter(isReadMethod), [methods]);
  const writeMethods = useMemo(() => methods.filter(isWriteMethod), [methods]);

  // Filter read methods by search query
  const filteredReadMethods = useMemo(() => {
    if (!readSearchQuery) return readMethods;
    const query = readSearchQuery.toLowerCase();
    return readMethods.filter((method) =>
      method.name.toLowerCase().includes(query)
    );
  }, [readMethods, readSearchQuery]);

  // Filter write methods by search query
  const filteredWriteMethods = useMemo(() => {
    if (!writeSearchQuery) return writeMethods;
    const query = writeSearchQuery.toLowerCase();
    return writeMethods.filter((method) =>
      method.name.toLowerCase().includes(query)
    );
  }, [writeMethods, writeSearchQuery]);

  const handleMethodSelect = (method: ethers.FunctionFragment) => {
    setSelectedMethod(method);
    setParams(new Array(method.inputs.length).fill(""));
    setEthValue("");
  };

  const handleParamChange = (index: number, value: string) => {
    const newParams = [...params];
    newParams[index] = value;
    setParams(newParams);
  };

  const parseParam = (param: ethers.ParamType, value: string): any => {
    try {
      if (param.type.includes("[]")) {
        return JSON.parse(value);
      }
      if (param.type.startsWith("uint") || param.type.startsWith("int")) {
        return BigInt(value);
      }
      if (param.type === "bool") {
        return value.toLowerCase() === "true";
      }
      return value;
    } catch {
      return value;
    }
  };

  const getProvider = (): ethers.BrowserProvider => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error("No wallet detected. Please install MetaMask or another Web3 wallet.");
    }
    return new ethers.BrowserProvider(ethereum);
  };

  // Helper function to convert BigInt to string for JSON serialization
  const serializeBigInt = (data: any): any => {
    if (typeof data === "bigint") {
      return data.toString();
    }
    if (Array.isArray(data)) {
      return data.map(serializeBigInt);
    }
    if (data && typeof data === "object") {
      const serialized: any = {};
      for (const key in data) {
        serialized[key] = serializeBigInt(data[key]);
      }
      return serialized;
    }
    return data;
  };

  const saveHistory = async (historyData: any) => {
    try {
      // Serialize BigInt values in params and result before sending
      const serializedData = {
        ...historyData,
        params: serializeBigInt(historyData.params),
        result: historyData.result
          ? serializeBigInt(historyData.result)
          : historyData.result,
      };

      const id = await addHistory(serializedData);
      fetchHistory();
      return id;
    } catch (error) {
      console.error("Failed to save history:", error);
      return null;
    }
  };

  const updateHistory = async (historyId: number, updates: any) => {
    try {
      await updateLocalHistory(historyId, updates);
      fetchHistory();
    } catch (error) {
      console.error("Failed to update history:", error);
    }
  };

  const handleReadMethod = async () => {
    if (!selectedMethod) return;

    setLoading(true);
    try {
      const provider = getProvider();
      const contractInstance = new ethers.Contract(
        contract.address,
        contract.abi,
        provider
      );

      const parsedParams = selectedMethod.inputs.map((input, i) =>
        parseParam(input, params[i])
      );

      const result = await contractInstance[selectedMethod.name](
        ...parsedParams
      );
      const formattedResult = formatResult(result);

      await saveHistory({
        contractId: contract.id,
        contractName: contract.name,
        contractAddress: contract.address,
        methodName: selectedMethod.name,
        methodType: "read",
        params: parsedParams,
        result: formattedResult,
        chainId: chainId || 1,
      });

      toast.success("Read successful!");
    } catch (error: any) {
      const errorMsg = parseCustomError(error, contract.abi);

      await saveHistory({
        contractId: contract.id,
        contractName: contract.name,
        contractAddress: contract.address,
        methodName: selectedMethod.name,
        methodType: "read",
        params: params,
        error: errorMsg,
        chainId: chainId || 1,
      });

      toast.error(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWriteMethod = async () => {
    if (!selectedMethod || !walletClient) return;

    setLoading(true);
    let txHash: string | undefined;
    let historyId: number | null = null;

    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(
        contract.address,
        contract.abi,
        signer
      );

      const parsedParams = selectedMethod.inputs.map((input, i) =>
        parseParam(input, params[i])
      );

      const options: any = {};
      if (ethValue && selectedMethod.stateMutability === "payable") {
        options.value = ethers.parseEther(ethValue);
      }

      const tx = await contractInstance[selectedMethod.name](
        ...parsedParams,
        options
      );

      txHash = tx.hash;

      // Save transaction sent to history
      historyId = await saveHistory({
        contractId: contract.id,
        contractName: contract.name,
        contractAddress: contract.address,
        methodName: selectedMethod.name,
        methodType: "write",
        params: parsedParams,
        txHash: tx.hash,
        result: `⏳ Transaction sent, waiting for confirmation...`,
        chainId: chainId || 1,
      });

      const receipt = await tx.wait();

      // Update history with confirmation
      if (historyId) {
        await updateHistory(historyId, {
          result: `✅ Transaction confirmed! Gas used: ${
            receipt?.gasUsed?.toString() || "N/A"
          }`,
        });
      }

      toast.success("Transaction confirmed!");
    } catch (error: any) {
      const errorMsg = parseCustomError(error, contract.abi);

      // If we already created a history record, update it with the error
      if (historyId) {
        await updateHistory(historyId, {
          error: errorMsg,
        });
      } else {
        // Otherwise create a new error record
        await saveHistory({
          contractId: contract.id,
          contractName: contract.name,
          contractAddress: contract.address,
          methodName: selectedMethod.name,
          methodType: "write",
          params: params,
          txHash: txHash,
          error: errorMsg,
          chainId: chainId || 1,
        });
      }

      toast.error(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearLocalHistory(contract.id, chainId);
      setHistory([]);
      setShowClearHistoryDialog(false);
      toast.success("History cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const handleSendCalldata = async () => {
    if (!walletClient || !calldataValue) return;

    setLoading(true);
    let txHash: string | undefined;
    let historyId: number | null = null;

    try {
      const provider = getProvider();
      const signer = await provider.getSigner();

      const txRequest: any = {
        to: contract.address,
        data: calldataValue,
      };

      if (calldataEthValue && calldataEthValue !== "0") {
        txRequest.value = ethers.parseEther(calldataEthValue);
      }

      const tx = await signer.sendTransaction(txRequest);

      txHash = tx.hash;

      // Save transaction sent to history
      historyId = await saveHistory({
        contractId: contract.id,
        contractName: contract.name,
        contractAddress: contract.address,
        methodName: "[Raw Calldata]",
        methodType: "write",
        params: [`Calldata: ${calldataValue}`],
        txHash: tx.hash,
        result: `⏳ Transaction sent, waiting for confirmation...`,
        chainId: chainId || 1,
      });

      const receipt = await tx.wait();

      // Update history with confirmation
      if (historyId) {
        await updateHistory(historyId, {
          result: `✅ Transaction confirmed! Gas used: ${
            receipt?.gasUsed?.toString() || "N/A"
          }`,
        });
      }

      toast.success("Transaction confirmed!");
      setShowCalldataDialog(false);
    } catch (error: any) {
      const errorMsg = parseCustomError(error, contract.abi);

      // If we already created a history record, update it with the error
      if (historyId) {
        await updateHistory(historyId, {
          error: errorMsg,
        });
      } else {
        // Otherwise create a new error record
        await saveHistory({
          contractId: contract.id,
          contractName: contract.name,
          contractAddress: contract.address,
          methodName: "[Raw Calldata]",
          methodType: "write",
          params: [`Calldata: ${calldataValue}`],
          txHash: txHash,
          error: errorMsg,
          chainId: chainId || 1,
        });
      }

      toast.error(`Error: ${errorMsg}`);
      setShowCalldataDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const copyInputData = async () => {
    if (!selectedMethod) return;

    try {
      const contractInstance = new ethers.Contract(
        contract.address,
        contract.abi
      );

      const parsedParams = selectedMethod.inputs.map((input, i) =>
        parseParam(input, params[i])
      );

      const inputData = contractInstance.interface.encodeFunctionData(
        selectedMethod.name,
        parsedParams
      );

      await navigator.clipboard.writeText(inputData);
      toast.success("📋 Input data copied!");
    } catch {
      toast.error("Failed to copy input data");
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`📋 ${label} copied!`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="space-y-6">
      <div className="terminal-card p-6 terminal-scanline">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="flex-1 min-w-[260px]">
            <h2 className="text-[18px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-red)] mb-2">
              🔧 {contract.name}
            </h2>
            <div className="flex items-start gap-2">
              <p className="text-[12px] text-[var(--terminal-text-secondary)] font-mono break-all flex-1">
                {contract.address}
              </p>
              <button
                onClick={() => copyToClipboard(contract.address, "Address")}
                className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px] shrink-0"
                title="Copy address"
              >
                📋
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowCalldataDialog(true)}
            className="terminal-btn border-[var(--terminal-orange)] text-[var(--terminal-orange)] hover:bg-[var(--terminal-orange)] hover:text-[#2d1700] whitespace-nowrap"
          >
            🔧 Send Raw Calldata
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="terminal-card p-6 terminal-scanline">
          <h3 className="text-[16px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-green)] mb-4">
            👁️ Read Methods
          </h3>
          <input
            type="text"
            value={readSearchQuery}
            onChange={(e) => setReadSearchQuery(e.target.value)}
            className="terminal-input w-full mb-3 text-sm"
            placeholder="🔍 Search read methods..."
          />
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {filteredReadMethods.map((method) => {
              const methodKey = method.format();
              return (
                <button
                  key={methodKey}
                  onClick={() => handleMethodSelect(method)}
                  className={`terminal-btn w-full text-left justify-start normal-case tracking-normal text-[12px] ${
                    selectedMethod?.format() === methodKey
                      ? "bg-[var(--terminal-green)] text-[#041d06] border-[var(--terminal-green)]"
                      : "terminal-btn-secondary"
                  }`}
                >
                  {method.name}({method.inputs.map((i) => i.type).join(", ")})
                  {method.outputs.length > 0 && (
                    <span className="opacity-70"> → {method.outputs.map((o) => o.type).join(", ")}</span>
                  )}
                </button>
              );
            })}
            {filteredReadMethods.length === 0 && (
              <p className="text-[12px] text-[var(--terminal-text-secondary)] text-center py-4">
                No matching methods found
              </p>
            )}
          </div>
        </div>

        <div className="terminal-card p-6 terminal-scanline">
          <h3 className="text-[16px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-red)] mb-4">
            ✍️ Write Methods
          </h3>
          <input
            type="text"
            value={writeSearchQuery}
            onChange={(e) => setWriteSearchQuery(e.target.value)}
            className="terminal-input w-full mb-3 text-sm"
            placeholder="🔍 Search write methods..."
          />
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {filteredWriteMethods.map((method) => {
              const methodKey = method.format();
              return (
                <button
                  key={methodKey}
                  onClick={() => handleMethodSelect(method)}
                  className={`terminal-btn w-full text-left justify-start normal-case tracking-normal text-[12px] ${
                    selectedMethod?.format() === methodKey
                      ? "bg-[var(--terminal-red)] text-[#290d0d] border-[var(--terminal-red)]"
                      : "terminal-btn-secondary"
                  }`}
                >
                  {method.name}({method.inputs.map((i) => i.type).join(", ")})
                </button>
              );
            })}
            {filteredWriteMethods.length === 0 && (
              <p className="text-[12px] text-[var(--terminal-text-secondary)] text-center py-4">
                No matching methods found
              </p>
            )}
          </div>
        </div>
      </div>

      {selectedMethod && (
        <div className="terminal-card p-6 terminal-scanline">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h3 className="text-[16px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-blue)]">
              🎯 Execute: {selectedMethod.name}
            </h3>
            <button
              onClick={copyInputData}
              className="terminal-btn terminal-btn-primary"
              disabled={!selectedMethod.inputs.every((_, i) => params[i])}
            >
              📋 Copy Input Data
            </button>
          </div>

          <div className="space-y-4">
            {selectedMethod.inputs.map((input, i) => (
              <div key={i}>
                <label className="block text-[12px] font-semibold tracking-[0.06em] uppercase mb-2 text-[var(--terminal-text-secondary)]">
                  {input.name || `param${i}`} ({input.type})
                </label>
                <input
                  type="text"
                  value={params[i] || ""}
                  onChange={(e) => handleParamChange(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading && address) {
                      if (isReadMethod(selectedMethod)) {
                        handleReadMethod();
                      } else {
                        handleWriteMethod();
                      }
                    }
                  }}
                  className="terminal-input w-full"
                  placeholder={`Enter ${input.type}`}
                />
              </div>
            ))}

            {selectedMethod.stateMutability === "payable" && (
              <div>
                <label className="block text-[12px] font-semibold tracking-[0.06em] uppercase mb-2 text-[var(--terminal-text-secondary)]">
                  ETH Value (in ETH)
                </label>
                <input
                  type="text"
                  value={ethValue}
                  onChange={(e) => setEthValue(e.target.value)}
                  className="terminal-input w-full"
                  placeholder="0.0"
                />
              </div>
            )}

            <button
              onClick={
                isReadMethod(selectedMethod)
                  ? handleReadMethod
                  : handleWriteMethod
              }
              disabled={loading || !address}
              className={`terminal-btn w-full ${
                isReadMethod(selectedMethod)
                  ? "border-[var(--terminal-green)] text-[var(--terminal-green)] hover:bg-[var(--terminal-green)] hover:text-[#051a06]"
                  : "border-[var(--terminal-red)] text-[var(--terminal-red)] hover:bg-[var(--terminal-red)] hover:text-[#290d0d]"
              }`}
            >
              {loading
                ? "⏳ Processing..."
                : isReadMethod(selectedMethod)
                ? "🔍 Read"
                : "📝 Write"}
            </button>
          </div>
        </div>
      )}

      <div className="terminal-card p-6 terminal-scanline">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[16px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-blue)]">📜 History</h3>
          <button
            onClick={() => setShowClearHistoryDialog(true)}
            className="terminal-btn border-[var(--terminal-red)] text-[var(--terminal-red)] hover:bg-[var(--terminal-red)] hover:text-[#290d0d]"
          >
            🗑️ Clear
          </button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {history && history.length > 0 ? (
            history.map((item) => (
              <div
                key={item.id}
                className={`copy-parent border p-4 relative transition-colors ${
                  item.error
                    ? "border-[var(--terminal-red)]/70 bg-[var(--terminal-red)]/10"
                    : item.methodType === "read"
                    ? "border-[var(--terminal-green)]/65 bg-[var(--terminal-green)]/10"
                    : "border-[var(--terminal-blue)]/65 bg-[var(--terminal-blue)]/10"
                }`}
              >
                <div className="flex justify-between items-start mb-3 gap-3">
                  <span className="font-bold text-[14px] tracking-[0.04em] text-[var(--terminal-text)]">
                    {item.methodType === "read" ? "👁️" : "✍️"} {item.methodName}
                  </span>
                  <span className="text-[10px] font-semibold bg-[var(--terminal-card)] px-2 py-1 border border-[var(--terminal-separator)] text-[var(--terminal-text-secondary)]">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>

                {item.params && item.params.length > 0 && (
                  <div className="text-sm mb-3 flex items-center gap-2 bg-[var(--terminal-card)] p-2 border border-[var(--terminal-separator)]">
                    <span className="font-bold text-[12px] text-[var(--terminal-text)]">Params:</span>
                    <span className="flex-1 font-mono text-[11px] text-[var(--terminal-text-secondary)] break-all">
                      {JSON.stringify(item.params)}
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(item.params),
                          "Parameters"
                        )
                      }
                      className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px]"
                      title="Copy params"
                    >
                      📋
                    </button>
                  </div>
                )}

                {item.txHash && (
                  <div className="text-sm mb-3 font-mono break-all flex items-center gap-2 bg-[var(--terminal-card)] p-2 border border-[var(--terminal-separator)]">
                    <span className="font-bold text-[12px] text-[var(--terminal-text)]">TX:</span>
                    <span className="flex-1 text-[11px] text-[var(--terminal-text-secondary)]">{item.txHash}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(item.txHash!, "Transaction hash")
                      }
                      className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px]"
                      title="Copy tx hash"
                    >
                      📋
                    </button>
                  </div>
                )}

                {item.result && (
                  <div className="text-sm bg-[var(--terminal-card)] p-3 border border-[var(--terminal-separator)]">
                    <div className="flex justify-between items-center mb-2 gap-2">
                      <span className="font-bold text-[12px] uppercase tracking-[0.05em] text-[var(--terminal-green)]">
                        ✅ Result:
                      </span>
                      <button
                        onClick={() => copyToClipboard(item.result!, "Result")}
                        className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px]"
                        title="Copy result"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <pre className="mt-1 text-[11px] overflow-x-auto bg-[var(--terminal-fill)] p-2 border border-[var(--terminal-separator)] text-[var(--terminal-text-secondary)]">
                      {item.result}
                    </pre>
                  </div>
                )}

                {item.error && (
                  <div className="text-sm text-[var(--terminal-red)] bg-[var(--terminal-card)] p-3 border border-[var(--terminal-red)]/55">
                    <div className="flex justify-between items-center mb-2 gap-2">
                      <span className="font-bold text-[12px] uppercase tracking-[0.05em]">❌ Error:</span>
                      <button
                        onClick={() => copyToClipboard(item.error!, "Error")}
                        className="terminal-btn terminal-btn-secondary px-2 py-1 text-[10px]"
                        title="Copy error"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div className="bg-[var(--terminal-fill)] p-2 border border-[var(--terminal-red)]/45 text-[11px] break-words">
                      {item.error}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                No history yet. Start interacting with the contract!
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showClearHistoryDialog}
        title="Clear History?"
        message={`Are you sure you want to clear all history for ${contract.name}? This action cannot be undone.`}
        type="warning"
        onConfirm={handleClearHistory}
        onCancel={() => setShowClearHistoryDialog(false)}
      />

      {showCalldataDialog && (
        <div
          className="fixed inset-0 bg-black/72 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => { if (e.key === "Escape" && !loading) setShowCalldataDialog(false); }}
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setShowCalldataDialog(false); }}
        >
          <div className="terminal-card max-w-2xl w-full max-h-[90vh] overflow-y-auto terminal-scanline">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[16px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-orange)]">
                  🔧 Send Raw Calldata
                </h3>
                <button
                  onClick={() => !loading && setShowCalldataDialog(false)}
                  className="terminal-btn terminal-btn-secondary"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold tracking-[0.06em] uppercase mb-2 text-[var(--terminal-text-secondary)]">
                    📝 Transaction Calldata (hex)
                  </label>
                  <textarea
                    value={calldataValue}
                    onChange={(e) => setCalldataValue(e.target.value)}
                    className="terminal-input w-full font-mono text-sm"
                    placeholder="0x..."
                    rows={6}
                  />
                  <p className="text-[11px] text-[var(--terminal-text-secondary)] mt-1">
                    Enter the complete transaction calldata in hexadecimal
                    format
                  </p>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold tracking-[0.06em] uppercase mb-2 text-[var(--terminal-text-secondary)]">
                    💰 ETH Value (in ETH)
                  </label>
                  <input
                    type="text"
                    value={calldataEthValue}
                    onChange={(e) => setCalldataEthValue(e.target.value)}
                    className="terminal-input w-full"
                    placeholder="0"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSendCalldata}
                    disabled={loading || !address || !calldataValue}
                    className="terminal-btn flex-1 border-[var(--terminal-orange)] text-[var(--terminal-orange)] hover:bg-[var(--terminal-orange)] hover:text-[#2d1700] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "⏳ Sending..." : "🚀 Send Transaction"}
                  </button>
                  <button
                    onClick={() => setShowCalldataDialog(false)}
                    disabled={loading}
                    className="terminal-btn terminal-btn-secondary px-6"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
