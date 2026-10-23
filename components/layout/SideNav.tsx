"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { ethers, type InterfaceAbi } from "ethers";
import { ArrowDownAZ, BookOpenText, Check, Copy, Download, FileCode2, FileUp, Pencil, Plug, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useHydrated } from "@/lib/use-hydrated";
import { isReadMethod, parseAbiSelectors, type SelectorItem } from "@/lib/contract-utils";
import { parseContractImportSources } from "@/lib/contract-import";
import { deleteContract, exportLocalData, listContractsByChainId, updateContractById, upsertContractsBatch } from "@/lib/local-store";
import ContractForm from "@/components/contracts/ContractForm";

export interface ContractRecord { id: number; name: string; address: string; chainId: number; abi: InterfaceAbi; }
interface SideNavProps { currentChainId?: number; currentContractId: number | null; onSelectContract: (contract: ContractRecord) => void; onDeleteContract: (id: number) => void; }
type SortBy = "newest" | "oldest" | "name-asc" | "name-desc";

function shortAddress(address: string) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }

export default function SideNav({ currentChainId, currentContractId, onSelectContract, onDeleteContract }: SideNavProps) {
  const { chainId } = useAccount();
  const hydrated = useHydrated();
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [menu, setMenu] = useState<{ x: number; y: number; contract?: ContractRecord } | null>(null);
  const [selectorContract, setSelectorContract] = useState<ContractRecord | null>(null);
  const [editing, setEditing] = useState<ContractRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAbi, setEditAbi] = useState("");
  const [saving, setSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleChainId = hydrated ? (chainId ?? currentChainId) : undefined;

  const fetchContracts = useCallback(async () => {
    if (!chainId) { setContracts([]); return; }
    try { setContracts(await listContractsByChainId(chainId) as ContractRecord[]); }
    catch { toast.error("获取合约失败"); }
  }, [chainId]);
  useEffect(() => { void fetchContracts(); }, [fetchContracts]);
  useEffect(() => { const update = () => { void fetchContracts(); }; window.addEventListener("contractsUpdated", update); return () => window.removeEventListener("contractsUpdated", update); }, [fetchContracts]);
  useEffect(() => { const close = () => setMenu(null); window.addEventListener("click", close); window.addEventListener("scroll", close, true); return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); }; }, []);

  const filteredContracts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = contracts.filter((c) => !query || c.name.toLowerCase().includes(query) || c.address.toLowerCase().includes(query));
    return result.sort((a, b) => sortBy === "newest" ? b.id - a.id : sortBy === "oldest" ? a.id - b.id : sortBy === "name-asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  }, [contracts, search, sortBy]);

  const openMenu = (event: React.MouseEvent, contract: ContractRecord) => { event.preventDefault(); event.stopPropagation(); setMenu({ x: Math.min(event.clientX, window.innerWidth - 210), y: Math.min(event.clientY, window.innerHeight - 180), contract }); };
  const startLongPress = (contract: ContractRecord, event: React.TouchEvent) => { pressTimer.current = setTimeout(() => setMenu({ x: event.touches[0]?.clientX ?? 20, y: event.touches[0]?.clientY ?? 80, contract }), 550); };
  const cancelLongPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };
  const openEdit = (contract: ContractRecord) => { setEditing(contract); setEditName(contract.name); setEditAddress(contract.address); setEditAbi(JSON.stringify(contract.abi, null, 2)); setMenu(null); };
  const saveEdit = async () => { if (!editing) return; setSaving(true); try { await updateContractById(editing.id, { name: editName.trim(), address: editAddress.trim(), abi: JSON.parse(editAbi) }); toast.success("合约信息已更新"); setEditing(null); await fetchContracts(); } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); } finally { setSaving(false); } };
  const removeContract = async (contract: ContractRecord) => { setMenu(null); if (!window.confirm(`确定删除 ${contract.name}？该合约的历史日志也会删除。`)) return; try { await deleteContract(contract.id); setContracts((items) => items.filter((item) => item.id !== contract.id)); onDeleteContract(contract.id); toast.success("合约已删除"); } catch { toast.error("删除失败"); } };
  const exportData = async () => { try { const snapshot = await exportLocalData(); const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `contracts-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; anchor.click(); URL.revokeObjectURL(url); toast.success("本地数据导出成功"); } catch { toast.error("导出失败"); } };
  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    if (!chainId) { toast.error("请先连接钱包并选择网络"); return; }
    try {
      setImporting(true);
      const parsed = await parseContractImportSources(files, { defaultChainId: chainId });
      if (!parsed.contracts.length) throw new Error(parsed.errors[0] ?? "未找到可导入合约");
      const results = await upsertContractsBatch(parsed.contracts);
      const successCount = results.filter((item) => item.success).length;
      await fetchContracts();
      toast.success(`导入完成：成功 ${successCount}/${parsed.contracts.length}`);
      if (parsed.errors.length) toast.warning(`部分文件跳过：${parsed.errors.length} 个`);
      if (parsed.errors.length) console.warn("合约文件导入失败项:", parsed.errors);
      setImportDialogOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "导入失败"); }
    finally { setImporting(false); setIsDraggingImport(false); }
  };
  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; await importFiles(files); };
  const handleImportDrop = async (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDraggingImport(false); if (importing) return; const files = Array.from(event.dataTransfer.files).filter((file) => file.type === "application/json" || file.name.toLowerCase().endsWith(".json")); if (!files.length) { toast.error("请拖入 .json 文件"); return; } await importFiles(files); };
  const menuAction = (action: "open" | "edit" | "selector" | "delete") => { const contract = menu?.contract; setMenu(null); if (!contract) return; if (action === "open") onSelectContract(contract); else if (action === "edit") openEdit(contract); else if (action === "selector") setSelectorContract(contract); else void removeContract(contract); };

  return <aside className="terminal-sidebar" aria-label="当前网络合约信息">
    <div className="border-b border-[var(--terminal-separator)] bg-white/90 px-3 py-3">
      <div className="mb-3 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--terminal-blue)]/20 bg-[var(--terminal-blue)]/10 text-[var(--terminal-blue)]"><BookOpenText size={17} /></div><div><p className="text-[12px] font-semibold text-[var(--terminal-blue)]">CONTRACTS</p><p className="text-[10px] text-[var(--terminal-text-secondary)]">{visibleChainId ? `Chain ${visibleChainId}` : "未连接钱包"}</p></div></div>
      <div className="mb-2 flex items-center justify-between gap-1"><span className="whitespace-nowrap text-[12px] font-medium">合约管理</span><div className="flex items-center gap-0.5"><button type="button" title="导出" onClick={() => void exportData()} className="side-icon"><Download size={14} /></button><button type="button" title="导入 JSON" onClick={() => setImportDialogOpen(true)} className="side-icon"><FileUp size={14} /></button><div className="side-contract-form"><ContractForm onSuccess={fetchContracts} defaultChainId={chainId} /></div><button type="button" title="排序" onClick={(event) => { event.stopPropagation(); setMenu(menu ? null : { x: 40, y: 118 }); }} className="side-icon"><ArrowDownAZ size={14} /></button></div></div>
      <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--terminal-text-secondary)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="terminal-input h-8 pl-8 pr-2 text-[12px]" placeholder="搜索名称或地址..." /></div>
    </div>
    <div className="flex-1 space-y-1.5 overflow-y-auto p-2">{!contracts.length ? <div className="px-2 py-4 text-[11px] leading-relaxed text-[var(--terminal-text-secondary)]">{visibleChainId ? "当前网络暂无已导入合约" : "连接钱包后显示对应网络合约"}</div> : !filteredContracts.length ? <div className="px-2 py-4 text-[11px] text-[var(--terminal-text-secondary)]">未找到匹配的合约</div> : filteredContracts.map((contract) => <button key={contract.id} type="button" onClick={() => onSelectContract(contract)} onContextMenu={(e) => openMenu(e, contract)} onTouchStart={(e) => startLongPress(contract, e)} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress} className={`w-full border px-2.5 py-2 text-left transition-colors ${currentContractId === contract.id ? "border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/8" : "border-[var(--terminal-separator)] bg-[var(--terminal-card)] hover:bg-[var(--terminal-hover)]"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-medium">{contract.name}</span><Plug size={12} className={currentContractId === contract.id ? "text-[var(--terminal-green)]" : "text-[var(--terminal-text-secondary)]"} /></div><p className="font-mono text-[10px] text-[var(--terminal-text-secondary)]">{shortAddress(contract.address)}</p><p className="mt-0.5 text-[9px] text-[var(--terminal-text-secondary)]">ABI: {Array.isArray(contract.abi) ? contract.abi.length : 0}</p></button>)}</div>
    {menu && !menu.contract && <SortMenu sortBy={sortBy} onSelect={(value) => { setSortBy(value); setMenu(null); }} position={menu} />}
    {menu?.contract && <div className="fixed z-[70] w-48 border border-[var(--terminal-separator)] bg-white p-1 shadow-lg" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}><button onClick={() => menuAction("open")} className="menu-item"><Plug size={14} />打开交互面板</button><button onClick={() => menuAction("edit")} className="menu-item"><Pencil size={14} />编辑合约</button><button onClick={() => menuAction("selector")} className="menu-item"><FileCode2 size={14} />查看 Selector</button><button onClick={() => menuAction("delete")} className="menu-item text-[var(--terminal-red)]"><Trash2 size={14} />删除合约</button></div>}
    {selectorContract && <SelectorDialog contract={selectorContract} onClose={() => setSelectorContract(null)} />}
    {importDialogOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"><button type="button" aria-label="关闭导入弹窗" className="absolute inset-0" onClick={() => !importing && setImportDialogOpen(false)} /><div className="terminal-card relative z-10 w-full max-w-md bg-white p-4" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div><h3 className="text-[14px] font-medium">导入 JSON</h3><p className="mt-1 text-[11px] text-[var(--terminal-text-secondary)]">选择文件或拖入单个/多个 JSON 文件。</p></div><button type="button" className="side-icon" aria-label="关闭导入弹窗" disabled={importing} onClick={() => setImportDialogOpen(false)}><X size={14} /></button></div><input ref={importInputRef} type="file" accept=".json,application/json" multiple className="hidden" onChange={handleImportChange} /><button type="button" className="terminal-btn terminal-btn-primary mb-3 w-full" disabled={importing} onClick={() => importInputRef.current?.click()}><FileUp size={15} />{importing ? "导入中…" : "选择 JSON 文件"}</button><div className={`border border-dashed px-4 py-8 text-center transition-colors ${isDraggingImport ? "border-[var(--terminal-green)] bg-[var(--terminal-green)]/10" : "border-[var(--terminal-separator)] bg-[var(--terminal-fill)]"}`} onDragEnter={(event) => { event.preventDefault(); if (!importing) setIsDraggingImport(true); }} onDragOver={(event) => { event.preventDefault(); if (!importing) setIsDraggingImport(true); }} onDragLeave={() => setIsDraggingImport(false)} onDrop={(event) => void handleImportDrop(event)}><FileUp size={22} className="mx-auto mb-2 text-[var(--terminal-green)]" /><p className="text-[12px] font-medium">{importing ? "正在导入 JSON…" : "拖入单个或多个 JSON 文件"}</p><p className="mt-1 text-[11px] text-[var(--terminal-text-secondary)]">支持单个合约对象或合约数组。</p></div></div></div>}
    {editing && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4"><div className="terminal-card w-full max-w-lg bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-medium">编辑合约</h3><button onClick={() => setEditing(null)} className="side-icon"><X size={14} /></button></div><div className="space-y-2"><input className="terminal-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="合约名称" /><input className="terminal-input font-mono" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="合约地址" /><textarea className="terminal-input min-h-48 resize-y font-mono text-[12px]" value={editAbi} onChange={(e) => setEditAbi(e.target.value)} /></div><div className="mt-3 flex justify-end gap-2"><button className="terminal-btn terminal-btn-secondary" onClick={() => setEditing(null)}>取消</button><button className="terminal-btn terminal-btn-primary" disabled={saving} onClick={() => void saveEdit()}>{saving ? "保存中…" : "保存"}</button></div></div></div>}
  </aside>;
}

function SortMenu({ sortBy, onSelect, position }: { sortBy: SortBy; onSelect: (value: SortBy) => void; position: { x: number; y: number } }) { return <div className="fixed z-[70] w-44 border border-[var(--terminal-separator)] bg-white p-1 shadow-lg" style={{ left: position.x, top: position.y }} onClick={(e) => e.stopPropagation()}>{(["newest", "oldest", "name-asc", "name-desc"] as SortBy[]).map((value) => <button key={value} type="button" onClick={() => onSelect(value)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-[var(--terminal-hover)]">{sortBy === value ? <Check size={13} className="text-[var(--terminal-blue)]" /> : <span className="w-3" />}{value === "newest" ? "最新添加" : value === "oldest" ? "最早添加" : value === "name-asc" ? "名称 A-Z" : "名称 Z-A"}</button>)}</div>; }

function SelectorDialog({ contract, onClose }: { contract: ContractRecord; onClose: () => void }) { const selectors = useMemo(() => parseAbiSelectors(contract.abi), [contract.abi]); const iface = useMemo(() => new ethers.Interface(contract.abi), [contract.abi]); const [copied, setCopied] = useState<string | null>(null); const copy = async (item: SelectorItem) => { try { await navigator.clipboard.writeText(item.selector); setCopied(item.selector); toast.success("Selector 已复制"); setTimeout(() => setCopied(null), 1200); } catch { toast.error("复制失败"); } }; const typeLabel = (item: SelectorItem) => { if (item.type === "event") return "event"; if (item.type === "error") return "error"; const fn = iface.getFunction(item.signature); return fn && isReadMethod(fn) ? "read" : "write"; }; return <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/30 p-4" onClick={onClose}><div className="terminal-card max-h-[82vh] w-full max-w-2xl overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between border-b border-[var(--terminal-separator)] p-4"><div><h3 className="text-[14px] font-medium">{contract.name} · Selector</h3><p className="font-mono text-[11px] text-[var(--terminal-text-secondary)]">{contract.address}</p></div><button onClick={onClose} className="side-icon"><X size={14} /></button></div><div className="max-h-[62vh] overflow-y-auto p-3">{selectors.length ? selectors.map((item) => <div key={`${item.type}-${item.selector}`} className="flex items-center gap-2 border-b border-[var(--terminal-separator)] py-2 text-[12px]"><span className="w-14 shrink-0 text-[10px] uppercase text-[var(--terminal-text-secondary)]">{typeLabel(item)}</span><span className="min-w-0 flex-1 truncate font-mono">{item.signature}</span><code className="shrink-0 text-[11px] text-[var(--terminal-blue)]">{item.selector}</code><button onClick={() => void copy(item)} className="side-icon" title="复制 selector">{copied === item.selector ? <Check size={13} /> : <Copy size={13} />}</button></div>) : <p className="py-8 text-center text-[12px] text-[var(--terminal-text-secondary)]">没有可用的 Selector</p>}</div></div></div>; }
