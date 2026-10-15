"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { InterfaceAbi } from "ethers";
import { ChevronLeft, ChevronRight, FileCode, FileDown, FileUp, Pencil, Plug, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import ContractForm from "./ContractForm";
import { parseContractImportSources } from "@/lib/contract-import";
import { parseAbiSelectors } from "@/lib/contract-utils";
import { useHydrated } from "@/lib/use-hydrated";
import {
  deleteContract as deleteLocalContract,
  exportLocalData,
  listContractsByChainId,
  updateContractById,
  upsertContractsBatch,
} from "@/lib/local-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export interface Contract {
  id: number;
  name: string;
  address: string;
  chainId: number;
  abi: InterfaceAbi;
}

interface ContractTableProps {
  onSelectContract: (contract: Contract) => void;
  openContractIds: Set<number>;
  onToggleContract: (contract: Contract) => void;
  onContractsChange?: (contracts: Contract[]) => void;
}

const sortLabels = {
  newest: "最新添加",
  oldest: "最早添加",
  "name-asc": "名称 A-Z",
  "name-desc": "名称 Z-A",
} as const;

type SortBy = keyof typeof sortLabels;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ContractRow({
  contract,
  isOpen,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
}: {
  contract: Contract;
  isOpen: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showSelectors, setShowSelectors] = useState(false);
  const selectors = useMemo(() => {
    if (!showSelectors) return [];
    return parseAbiSelectors(contract.abi).slice(0, 16);
  }, [contract.abi, showSelectors]);

  return (
    <div>
      <button
        onClick={onSelect}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--apple-hover)] cursor-pointer transition-colors group text-left focus-visible:outline-2 focus-visible:outline-[var(--apple-blue)] focus-visible:outline-offset-2"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="w-10 h-10 border border-[var(--apple-separator)] bg-[var(--apple-fill)] flex items-center justify-center shrink-0" aria-hidden="true">
            <span className="text-sm font-semibold text-[var(--apple-blue)]">
              {contract.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-[var(--apple-text)]">{contract.name}</p>
            <p className="truncate text-[13px] font-mono text-[var(--apple-text-secondary)]">{shortAddress(contract.address)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-[0.06em] px-2.5 py-1 border border-[var(--apple-separator)] bg-[var(--apple-fill)] text-[var(--apple-text-secondary)] tabular-nums">
            Chain {contract.chainId}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); onToggle(); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onToggle();
              }
            }}
            className={`w-8 h-8 border flex items-center justify-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--apple-blue)] ${
              isOpen
                ? "bg-[var(--apple-green)]/10 border-[var(--apple-green)]/40"
                : "border-transparent opacity-0 group-hover:opacity-100 hover:bg-[var(--apple-fill)] hover:border-[var(--apple-separator)]"
            }`}
            aria-label={isOpen ? `从交互面板移除 ${contract.name}` : `添加 ${contract.name} 到交互面板`}
          >
            <Plug size={15} className={isOpen ? "text-[var(--apple-green)]" : "text-[var(--apple-text-secondary)]"} aria-hidden="true" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); setShowSelectors((value) => !value); }}
            className="opacity-0 group-hover:opacity-100 w-8 h-8 border border-transparent hover:bg-[var(--apple-blue)]/10 hover:border-[var(--apple-separator)] flex items-center justify-center transition-opacity cursor-pointer focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--apple-blue)]"
            aria-label={`查看 ${contract.name} 选择器`}
          >
            <FileCode size={15} className="text-[var(--apple-blue)]" aria-hidden="true" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); onEdit(); }}
            className="opacity-0 group-hover:opacity-100 w-8 h-8 border border-transparent hover:bg-[var(--apple-blue)]/10 hover:border-[var(--apple-separator)] flex items-center justify-center transition-opacity cursor-pointer focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--apple-blue)]"
            aria-label={`编辑 ${contract.name}`}
          >
            <Pencil size={15} className="text-[var(--apple-blue)]" aria-hidden="true" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 w-8 h-8 border border-transparent hover:bg-[var(--apple-red)]/10 hover:border-[var(--apple-separator)] flex items-center justify-center transition-opacity cursor-pointer focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--apple-blue)]"
            aria-label={`删除 ${contract.name}`}
          >
            <Trash2 size={15} className="text-[var(--apple-red)]" aria-hidden="true" />
          </span>
          <ChevronRight size={16} className="text-[var(--apple-text-secondary)] opacity-40" aria-hidden="true" />
        </div>
      </button>
      {showSelectors && (
        <div className="px-4 pb-3">
          <div className="bg-[var(--apple-fill)] border border-[var(--apple-separator)] p-3 space-y-1.5">
            {selectors.map((item) => (
              <div key={`${item.type}-${item.selector}-${item.signature}`} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="truncate text-[var(--apple-text)] font-medium">{item.signature}</span>
                <code className="text-[11px] font-mono bg-[var(--apple-card)] px-1.5 py-0.5 border border-[var(--apple-separator)] text-[var(--apple-text-secondary)] shrink-0">
                  {item.selector.slice(0, 10)}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContractTable({ onSelectContract, openContractIds, onToggleContract, onContractsChange }: ContractTableProps) {
  const { chainId } = useAccount();
  const hydrated = useHydrated();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editChainId, setEditChainId] = useState("");
  const [editAbi, setEditAbi] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const pageSize = 10;

  const fetchContracts = useCallback(async () => {
    if (!chainId) {
      setContracts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await listContractsByChainId(chainId);
      setContracts(data);
    } catch (error) {
      console.error("获取合约失败:", error);
      toast.error("获取合约失败");
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    void fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    onContractsChange?.(contracts);
  }, [contracts, onContractsChange]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const snapshot = await exportLocalData();
      const filename = `contracts-local-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("本地数据导出成功");
    } catch (error) {
      console.error("导出失败:", error);
      toast.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const importContractFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (!chainId) {
      toast.error("请先连接钱包并选择网络");
      return;
    }

    try {
      setImporting(true);
      const { contracts: parsedContracts, errors } = await parseContractImportSources(files, {
        defaultChainId: chainId,
      });

      if (parsedContracts.length === 0) {
        throw new Error(errors[0] ?? "未找到可导入合约");
      }

      const result = await upsertContractsBatch(parsedContracts);
      const successCount = result.filter((item) => item.success).length;
      await fetchContracts();
      toast.success(`导入完成：成功 ${successCount}/${parsedContracts.length}`);
      if (errors.length > 0) {
        toast.warning(`部分文件跳过：${errors.length} 个`);
        console.warn("合约文件导入失败项:", errors);
      }
      setImportDialogOpen(false);
    } catch (error) {
      console.error("导入失败:", error);
      toast.error(error instanceof Error ? error.message : "导入失败，请检查 JSON 格式");
    } finally {
      setImporting(false);
    }
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await importContractFiles(files);
  };

  const handleImportDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!importing && !exporting) {
      setIsDraggingImport(true);
    }
  };

  const handleImportDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingImport(false);
    }
  };

  const handleImportDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingImport(false);
    if (importing || exporting) return;
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type === "application/json" || file.name.toLowerCase().endsWith(".json")
    );
    if (files.length === 0) {
      toast.error("请拖入 .json 文件");
      return;
    }
    await importContractFiles(files);
  };

  const filteredContracts = useMemo(() => {
    const result = [...contracts];

    if (sortBy === "newest") result.sort((a, b) => b.id - a.id);
    else if (sortBy === "oldest") result.sort((a, b) => a.id - b.id);
    else if (sortBy === "name-asc") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "name-desc") result.sort((a, b) => b.name.localeCompare(a.name));

    return result;
  }, [contracts, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedContracts = filteredContracts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const startEdit = (contract: Contract) => {
    setEditingContract(contract);
    setEditName(contract.name);
    setEditAddress(contract.address);
    setEditChainId(String(contract.chainId));
    setEditAbi(JSON.stringify(contract.abi, null, 2));
  };

  const saveEdit = async () => {
    if (!editingContract) return;
    setSavingEdit(true);
    try {
      const parsedAbi = JSON.parse(editAbi);
      const nextChainId = Number(editChainId);
      if (!Number.isSafeInteger(nextChainId) || nextChainId <= 0) {
        throw new Error("链 ID 必须是正整数");
      }
      await updateContractById(editingContract.id, {
        name: editName.trim(),
        address: editAddress.trim(),
        chainId: nextChainId,
        abi: parsedAbi,
      });
      toast.success("合约信息已更新");
      setEditingContract(null);
      await fetchContracts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteContract = async (id: number) => {
    if (!confirm("确定删除此合约？")) return;
    try {
      await deleteLocalContract(id);
      await fetchContracts();
    } catch (error) {
      console.error("删除失败:", error);
      toast.error("删除失败");
    }
  };

  return (
    <div className="apple-card min-w-0">
      <div className="p-5 border-b border-[var(--apple-separator)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-[20px] font-semibold tracking-tight">合约列表</h2>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              onChange={handleImportChange}
            />
            <button
              type="button"
              className="group inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--apple-separator)] bg-white/95 px-3 text-[13px] font-medium text-[var(--apple-text)] shadow-[0_8px_18px_rgba(21,45,86,0.05)] transition-colors hover:border-[var(--apple-blue)]/30 hover:bg-[var(--apple-blue)]/5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleExport}
              disabled={exporting || importing}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--apple-blue)]/15 bg-[var(--apple-blue)]/8 text-[var(--apple-blue)] transition-colors group-hover:bg-[var(--apple-blue)]/12">
                <FileDown size={14} aria-hidden="true" />
              </span>
              <span>{exporting ? "导出中…" : "导出"}</span>
            </button>
            <button
              type="button"
              className="group inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--apple-separator)] bg-white/95 px-3 text-[13px] font-medium text-[var(--apple-text)] shadow-[0_8px_18px_rgba(21,45,86,0.05)] transition-colors hover:border-[var(--apple-green)]/35 hover:bg-[var(--apple-green)]/6 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setImportDialogOpen(true)}
              disabled={importing || exporting}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--apple-green)]/20 bg-[var(--apple-green)]/10 text-[var(--apple-green)] transition-colors group-hover:bg-[var(--apple-green)]/15">
                <FileUp size={14} aria-hidden="true" />
              </span>
              <span>{importing ? "导入中…" : "导入 JSON"}</span>
            </button>
            <ContractForm onSuccess={fetchContracts} defaultChainId={chainId} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <div className="apple-select-trigger flex items-center px-3 text-[13px] text-[var(--apple-text-secondary)]">
            当前网络：{hydrated && chainId ? `Chain ${chainId}` : "未连接"}
          </div>
          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value as SortBy);
              setPage(1);
            }}
          >
            <SelectTrigger className="apple-select-trigger w-full text-[13px]">
              <span className="flex flex-1 text-left">{sortLabels[sortBy]}</span>
            </SelectTrigger>
            <SelectContent className="apple-select-content">
              <SelectItem value="newest" className="apple-select-item">最新添加</SelectItem>
              <SelectItem value="oldest" className="apple-select-item">最早添加</SelectItem>
              <SelectItem value="name-asc" className="apple-select-item">名称 A-Z</SelectItem>
              <SelectItem value="name-desc" className="apple-select-item">名称 Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      <div className="p-2">
        {loading ? (
          <div className="flex items-center justify-center py-16" aria-live="polite">
            <div className="w-6 h-6 border-2 border-[var(--apple-blue)] border-t-transparent rounded-full animate-spin" role="status">
              <span className="sr-only">加载中…</span>
            </div>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border border-[var(--apple-separator)] bg-[var(--apple-fill)] flex items-center justify-center mx-auto mb-3" aria-hidden="true">
              <Search size={20} className="text-[var(--apple-text-secondary)]" />
            </div>
            <p className="text-[15px] font-medium text-[var(--apple-text)]">
              暂无合约
            </p>
            <p className="text-[13px] text-[var(--apple-text-secondary)] mt-1">
              {hydrated && chainId ? "点击上方按钮添加合约" : "连接钱包后显示当前网络合约"}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--apple-separator)]">
              {pagedContracts.map((contract) => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  onSelect={() => onSelectContract(contract)}
                  onDelete={() => void deleteContract(contract.id)}
                  onEdit={() => startEdit(contract)}
                  isOpen={openContractIds.has(contract.id)}
                  onToggle={() => onToggleContract(contract)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--apple-separator)]">
                <span className="text-[12px] text-[var(--apple-text-secondary)]">共 {filteredContracts.length} 个合约</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="w-8 h-8 border border-[var(--apple-separator)] flex items-center justify-center hover:bg-[var(--apple-hover)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" aria-label="上一页">
                    <ChevronLeft size={16} className="text-[var(--apple-text-secondary)]" />
                  </button>
                  <span className="text-[12px] font-medium text-[var(--apple-text-secondary)] px-2 tabular-nums">{safePage} / {totalPages}</span>
                  <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="w-8 h-8 border border-[var(--apple-separator)] flex items-center justify-center hover:bg-[var(--apple-hover)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default" aria-label="下一页">
                    <ChevronRight size={16} className="text-[var(--apple-text-secondary)]" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {importDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="关闭导入弹窗"
            onClick={() => {
              if (!importing) {
                setImportDialogOpen(false);
                setIsDraggingImport(false);
              }
            }}
          />
          <div className="terminal-card relative z-10 w-full max-w-xl bg-[var(--terminal-card)] shadow-[0_24px_80px_rgba(21,45,86,0.22)]">
            <div className="flex items-center justify-between border-b border-[var(--terminal-separator)] p-4">
              <div>
                <h3 className="text-[14px] font-medium tracking-[0.01em]">导入 JSON</h3>
                <p className="mt-1 text-[12px] text-[var(--terminal-text-secondary)]">
                  选择文件或拖入单个/多个 JSON 文件批量导入合约。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!importing) {
                    setImportDialogOpen(false);
                    setIsDraggingImport(false);
                  }
                }}
                disabled={importing}
                className="w-8 h-8 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="关闭导入弹窗"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <button
                type="button"
                className="terminal-btn terminal-btn-primary w-full justify-center"
                onClick={() => importInputRef.current?.click()}
                disabled={importing || exporting}
              >
                <FileUp size={16} aria-hidden="true" />
                <span>{importing ? "导入中…" : "选择 JSON 文件"}</span>
              </button>
              <div
                className={`border border-dashed px-4 py-8 text-center transition-colors ${
                  isDraggingImport
                    ? "border-[var(--terminal-green)] bg-[var(--terminal-green)]/10"
                    : "border-[var(--terminal-separator)] bg-[var(--terminal-fill)]"
                } ${importing || exporting ? "opacity-60" : ""}`}
                onDragEnter={handleImportDragOver}
                onDragOver={handleImportDragOver}
                onDragLeave={handleImportDragLeave}
                onDrop={(event) => void handleImportDrop(event)}
                aria-label="拖拽 JSON 文件批量导入合约"
              >
                <FileUp size={22} className="mx-auto mb-3 text-[var(--terminal-green)]" aria-hidden="true" />
                <p className="text-[13px] font-medium text-[var(--terminal-text)]">
                  {importing ? "正在导入 JSON…" : "拖入单个或多个 JSON 文件"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--terminal-text-secondary)]">
                  支持单个合约对象或合约数组；chainId 缺省时使用当前钱包网络。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="terminal-card bg-[var(--terminal-card)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--terminal-separator)] p-4">
              <h3 className="text-[14px] font-medium tracking-[0.01em]">编辑合约信息</h3>
              <button type="button" onClick={() => setEditingContract(null)} className="w-8 h-8 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-center" aria-label="关闭编辑">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input className="terminal-input" value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="合约名称" />
              <input className="terminal-input font-mono" value={editAddress} onChange={(event) => setEditAddress(event.target.value)} placeholder="0x..." spellCheck={false} />
              <input className="terminal-input" value={editChainId} onChange={(event) => setEditChainId(event.target.value)} placeholder="链 ID" inputMode="numeric" />
              <textarea className="terminal-input font-mono text-[12px]" rows={10} value={editAbi} onChange={(event) => setEditAbi(event.target.value)} placeholder="ABI JSON" spellCheck={false} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="terminal-btn terminal-btn-secondary" onClick={() => setEditingContract(null)}>取消</button>
                <button type="button" className="terminal-btn terminal-btn-primary" onClick={() => void saveEdit()} disabled={savingEdit}>
                  {savingEdit ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
