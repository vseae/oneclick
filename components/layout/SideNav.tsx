"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownAZ,
  BookOpenText,
  Download,
  FileUp,
  FolderPlus,
  FolderInput,
  MoreVertical,
  Plug,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useHydrated } from "@/lib/use-hydrated";
import { deleteContract, deleteContracts, deleteDirectory, exportLocalData, moveContractToDirectory, moveContractsToDirectory } from "@/lib/local-store";
import { directoryKeys, useDirectories } from "@/lib/queries";
import type { ContractDirectoryRecord, ContractRecord } from "@/lib/types";
import type { DirectoryDialogMode } from "@/components/contracts/ContractDirectoryDialog";
import ContractDirectoryCatalog from "@/components/layout/ContractDirectoryCatalog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ActionsMenu, SortMenu, type ContractMenuAction, type SortBy } from "@/components/layout/ContractMenus";

const ContractForm = dynamic(() => import("@/components/contracts/ContractForm"), {
  ssr: false,
  loading: () => (
    <span className="terminal-btn terminal-btn-primary terminal-btn-compact opacity-50" aria-hidden="true" />
  ),
});
const ImportContractsDialog = dynamic(() => import("@/components/contracts/ImportContractsDialog"), { ssr: false });
const EditContractDialog = dynamic(() => import("@/components/contracts/EditContractDialog"), { ssr: false });
const SelectorDialog = dynamic(() => import("@/components/contracts/SelectorDialog"), { ssr: false });
const ContractDirectoryDialog = dynamic(() => import("@/components/contracts/ContractDirectoryDialog"), { ssr: false });

type ActiveMenu =
  | { kind: "actions"; contract: ContractRecord; x: number; y: number }
  | { kind: "sort"; x: number; y: number }
  | null;

interface SideNavProps {
  contracts: ContractRecord[];
  currentChainId?: number;
  currentContractId: number | null;
  isLoading?: boolean;
  hasError?: boolean;
  onSelectContract: (contract: ContractRecord) => void;
  onDeleteContracts: (ids: number[]) => void;
  onCatalogChanged: () => void | Promise<void>;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const padding = 8;
  return {
    x: Math.max(padding, Math.min(x, window.innerWidth - width - padding)),
    y: Math.max(padding, Math.min(y, window.innerHeight - height - padding)),
  };
}

export default function SideNav({
  contracts,
  currentChainId,
  currentContractId,
  isLoading = false,
  hasError = false,
  onSelectContract,
  onDeleteContracts,
  onCatalogChanged,
}: SideNavProps) {
  const hydrated = useHydrated();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [menu, setMenu] = useState<ActiveMenu>(null);
  const [selectorContract, setSelectorContract] = useState<ContractRecord | null>(null);
  const [editingContract, setEditingContract] = useState<ContractRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<ContractRecord[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [movingContracts, setMovingContracts] = useState(false);
  const [directoryDialog, setDirectoryDialog] = useState<DirectoryDialogMode | null>(null);
  const [deleteDirectoryTarget, setDeleteDirectoryTarget] = useState<ContractDirectoryRecord | null>(null);
  const [deletingDirectory, setDeletingDirectory] = useState(false);
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{ chainId?: number; active: boolean; ids: number[] }>({ chainId: currentChainId, active: false, ids: [] });
  if (selection.chainId !== currentChainId) {
    setSelection({ chainId: currentChainId, active: false, ids: [] });
  }

  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressOpened = useRef(false);
  const suppressNextClick = useRef(false);
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const selectionAnchor = useRef<number | null>(null);
  const marquee = useRef<{
    pointerId: number; startX: number; startY: number; clientX: number; clientY: number;
    initialIds: number[]; additive: boolean; started: boolean;
  } | null>(null);
  const marqueeFrame = useRef<number | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const visibleChainId = hydrated ? currentChainId : undefined;
  const { data: directories = [], isPending: directoriesPending, error: directoriesError } = useDirectories(visibleChainId);
  const sortedDirectories = useMemo(() => [...directories].sort((a, b) => a.name.localeCompare(b.name)), [directories]);
  const selectionMode = selection.chainId === currentChainId && selection.active;
  const selectionBusy = deleting || movingContracts;

  useEffect(() => { selectionAnchor.current = null; }, [search, sortBy, currentChainId]);

  useEffect(() => () => {
    if (marqueeFrame.current !== null) cancelAnimationFrame(marqueeFrame.current);
    marqueeFrame.current = null;
    marquee.current = null;
  }, [selectionMode, currentChainId]);

  /** Close any open menu when clicking elsewhere or scrolling. */
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  /** Cmd/Ctrl+K focuses the contract search. */
  useEffect(() => {
    const focusSearch = () => {
      const input = searchInputRef.current;
      if (!input) return;
      if (window.matchMedia("(max-width: 767px)").matches) {
        input.scrollIntoView({ block: "center" });
      }
      input.focus({ preventScroll: true });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  /**
   * A long press ends with a synthetic click. Swallow that click in the capture
   * phase so it neither selects the contract nor activates the menu item that
   * is now under the finger.
   */
  useEffect(() => {
    const blockMouseDown = (event: MouseEvent) => {
      if (!suppressNextClick.current) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const blockClick = (event: MouseEvent) => {
      if (!suppressNextClick.current) return;
      suppressNextClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("mousedown", blockMouseDown, true);
    window.addEventListener("click", blockClick, true);
    return () => {
      window.removeEventListener("mousedown", blockMouseDown, true);
      window.removeEventListener("click", blockClick, true);
    };
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const filteredContracts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = contracts.filter(
      (contract) =>
        !query ||
        contract.name.toLowerCase().includes(query) ||
        contract.address.toLowerCase().includes(query)
    );

    return [...matching].sort((a, b) => {
      if (sortBy === "newest") return b.id - a.id;
      if (sortBy === "oldest") return a.id - b.id;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });
  }, [contracts, search, sortBy]);

  const selectedIds = useMemo(() => new Set(selection.chainId === currentChainId ? selection.ids : []), [selection, currentChainId]);
  const selectedContracts = contracts.filter((contract) => selectedIds.has(contract.id));
  const allResultsSelected = filteredContracts.length > 0 && filteredContracts.every((contract) => selectedIds.has(contract.id));
  const hiddenSelectedCount = selectedContracts.length - filteredContracts.filter((contract) => selectedIds.has(contract.id)).length;

  const visibleRows = () => Array.from(catalogRef.current?.querySelectorAll<HTMLElement>('[data-contract-id][data-contract-visible="true"]') ?? []);

  const finishMarquee = useCallback(() => {
    if (marqueeFrame.current !== null) cancelAnimationFrame(marqueeFrame.current);
    marqueeFrame.current = null;
    const pointerId = marquee.current?.pointerId;
    marquee.current = null;
    if (pointerId !== undefined && catalogRef.current?.hasPointerCapture(pointerId)) catalogRef.current.releasePointerCapture(pointerId);
    setSelectionBox(null);
  }, []);

  const clearSelection = useCallback((exit = false) => {
    finishMarquee();
    selectionAnchor.current = null;
    setSelection({ chainId: currentChainId, active: !exit, ids: [] });
  }, [currentChainId, finishMarquee]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !selectionMode || selectionBusy || menu || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      clearSelection(true);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [selectionMode, selectionBusy, menu, clearSelection]);

  const selectAllResults = () => {
    selectionAnchor.current = null;
    setSelection((current) => ({ chainId: currentChainId, active: true, ids: [...new Set([...current.ids, ...filteredContracts.map((contract) => contract.id)])] }));
  };

  const clickContract = (contract: ContractRecord, event: React.MouseEvent) => {
    if (selectionBusy) return;
    const additive = event.ctrlKey || event.metaKey;
    if (!selectionMode && !additive && !event.shiftKey) {
      selectionAnchor.current = contract.id;
      onSelectContract(contract);
      return;
    }
    const orderedIds = visibleRows().map((row) => Number(row.dataset.contractId));
    const anchorIndex = orderedIds.indexOf(selectionAnchor.current ?? contract.id);
    const targetIndex = orderedIds.indexOf(contract.id);
    const range = event.shiftKey && anchorIndex >= 0 && targetIndex >= 0
      ? orderedIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
      : [contract.id];
    setSelection((current) => ({
      chainId: currentChainId,
      active: true,
      ids: event.shiftKey ? additive ? [...new Set([...current.ids, ...range])] : range
        : additive ? current.ids.includes(contract.id) ? current.ids.filter((id) => id !== contract.id) : [...current.ids, contract.id]
        : [contract.id],
    }));
    if (!event.shiftKey || selectionAnchor.current === null) selectionAnchor.current = contract.id;
  };

  const updateMarquee = () => {
    const drag = marquee.current;
    const viewport = catalogRef.current;
    if (!drag || !viewport) return;
    const bounds = viewport.getBoundingClientRect();
    if (!drag.started && Math.hypot(drag.clientX - (bounds.left + drag.startX), drag.clientY - (bounds.top + drag.startY - viewport.scrollTop)) < 4) {
      marqueeFrame.current = requestAnimationFrame(updateMarquee);
      return;
    }
    drag.started = true;
    const edge = 28;
    const scrollSpeed = drag.clientY < bounds.top + edge ? -Math.min(12, (bounds.top + edge - drag.clientY) / 2)
      : drag.clientY > bounds.bottom - edge ? Math.min(12, (drag.clientY - bounds.bottom + edge) / 2) : 0;
    viewport.scrollTop += scrollSpeed;
    const endX = Math.max(0, Math.min(bounds.width, drag.clientX - bounds.left));
    const endY = Math.max(0, Math.min(bounds.height, drag.clientY - bounds.top)) + viewport.scrollTop;
    const left = Math.min(drag.startX, endX);
    const right = Math.max(drag.startX, endX);
    const top = Math.min(drag.startY, endY);
    const bottom = Math.max(drag.startY, endY);
    const hits = visibleRows().filter((row) => {
      const rect = row.getBoundingClientRect();
      const rowTop = rect.top - bounds.top + viewport.scrollTop;
      return rect.right - bounds.left >= left && rect.left - bounds.left <= right && rowTop + rect.height >= top && rowTop <= bottom;
    }).map((row) => Number(row.dataset.contractId));
    const ids = drag.additive ? [...new Set([...drag.initialIds, ...hits])] : hits;
    setSelection((current) => current.ids.length === ids.length && current.ids.every((id, index) => id === ids[index]) ? current : { ...current, ids });
    const boxTop = Math.max(bounds.top, bounds.top + top - viewport.scrollTop);
    const boxBottom = Math.min(bounds.bottom, bounds.top + bottom - viewport.scrollTop);
    const box = { left: bounds.left + left, top: boxTop, width: right - left, height: Math.max(0, boxBottom - boxTop) };
    setSelectionBox((current) => current && current.left === box.left && current.top === box.top && current.width === box.width && current.height === box.height ? current : box);
    marqueeFrame.current = requestAnimationFrame(updateMarquee);
  };

  const startMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!selectionMode || selectionBusy || event.button !== 0 || event.pointerType !== "mouse" || (event.target as HTMLElement).closest("[data-contract-id], button, input, select, a")) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const bounds = event.currentTarget.getBoundingClientRect();
    selectionAnchor.current = null;
    marquee.current = {
      pointerId: event.pointerId, startX: event.clientX - bounds.left, startY: event.clientY - bounds.top + event.currentTarget.scrollTop,
      clientX: event.clientX, clientY: event.clientY, initialIds: selection.ids,
      additive: event.ctrlKey || event.metaKey, started: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    marqueeFrame.current = requestAnimationFrame(updateMarquee);
  };

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenu(null);
    if (restoreFocus) {
      menuTriggerRef.current?.focus();
    }
  }, []);

  const openActionsMenu = (contract: ContractRecord, x: number, y: number) => {
    if (selectionBusy) return;
    if (selectionMode && !selectedIds.has(contract.id)) {
      selectionAnchor.current = contract.id;
      setSelection({ chainId: currentChainId, active: true, ids: [contract.id] });
    }
    const position = clampMenuPosition(x, y, 184, 252);
    setMenu({ kind: "actions", contract, ...position });
  };

  const openActionsFromButton = (contract: ContractRecord, anchor: HTMLElement) => {
    menuTriggerRef.current = anchor;
    const rect = anchor.getBoundingClientRect();
    openActionsMenu(contract, rect.right - 184, rect.bottom + 4);
  };

  const openSortMenu = (anchor: HTMLElement) => {
    menuTriggerRef.current = anchor;
    const rect = anchor.getBoundingClientRect();
    const position = clampMenuPosition(rect.right - 176, rect.bottom + 4, 176, 148);
    setMenu({ kind: "sort", ...position });
  };

  const startLongPress = (contract: ContractRecord, event: React.TouchEvent) => {
    clearLongPress();
    longPressOpened.current = false;
    suppressNextClick.current = false;
    const touch = event.touches[0];
    if (!touch) return;
    const { clientX, clientY } = touch;

    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      longPressOpened.current = true;
      suppressNextClick.current = true;
      menuTriggerRef.current = null;
      openActionsMenu(contract, clientX, clientY);
    }, 550);
  };

  const endLongPress = (event: React.TouchEvent) => {
    clearLongPress();
    if (!longPressOpened.current) return;
    event.preventDefault();
    longPressOpened.current = false;
    window.setTimeout(() => { suppressNextClick.current = false; }, 0);
  };

  const runMenuAction = (action: ContractMenuAction) => {
    if (menu?.kind !== "actions") return;
    const contract = menu.contract;
    const targets = selectionMode && selectedIds.has(contract.id) ? selectedContracts : [contract];
    closeMenu();
    if (action === "select") {
      selectionAnchor.current = contract.id;
      setSelection((current) => ({ chainId: currentChainId, active: true, ids: [...new Set([...current.ids, contract.id])] }));
      catalogRef.current?.focus({ preventScroll: true });
    } else if (action === "exitSelection") clearSelection(true);
    else if (action === "open") onSelectContract(contract);
    else if (action === "edit") setEditingContract(contract);
    else if (action === "selector") setSelectorContract(contract);
    else if (action === "move") setDirectoryDialog({ kind: "move", contracts: targets });
    else setDeleteTargets(targets);
  };

  const refreshDirectories = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: directoryKeys.byChain(currentChainId) }),
      onCatalogChanged(),
    ]);
  };

  const moveToDirectory = async (targets: ContractRecord[], directoryId: number | null) => {
    setMovingContracts(true);
    try {
      if (targets.length === 1) await moveContractToDirectory(targets[0].id, { directoryId });
      else await moveContractsToDirectory(targets.map((contract) => contract.id), targets[0].chainId, { directoryId });
      await refreshDirectories();
      clearSelection(true);
      toast.success(`已移动 ${targets.length} 个合约${directoryId === null ? "到未分组" : "到目录"}`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移动失败");
      return false;
    } finally {
      setMovingContracts(false);
    }
  };

  const confirmDeleteDirectory = async () => {
    if (!deleteDirectoryTarget || deletingDirectory) return;
    setDeletingDirectory(true);
    try {
      await deleteDirectory(deleteDirectoryTarget.id);
      await refreshDirectories();
      setDeleteDirectoryTarget(null);
      toast.success("目录已删除，合约已保留");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingDirectory(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargets.length || deleting) return;
    setDeleting(true);
    try {
      const ids = deleteTargets.map((contract) => contract.id);
      if (ids.length === 1) await deleteContract(ids[0]);
      else await deleteContracts(ids, deleteTargets[0].chainId);
      onDeleteContracts(ids);
      await onCatalogChanged();
      clearSelection(true);
      setDeleteTargets([]);
      toast.success(`已删除 ${ids.length} 个合约`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const exportData = async () => {
    try {
      const snapshot = await exportLocalData();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `contracts-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("本地数据已导出", { description: "备份包含所有网络的目录、合约与历史记录" });
    } catch {
      toast.error("导出失败");
    }
  };

  return (
    <aside className="terminal-sidebar" aria-label="当前网络合约信息">
      <div className="border-b border-[var(--terminal-separator)] bg-white/90 px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--terminal-blue)]/20 bg-[var(--terminal-blue)]/10 text-[var(--terminal-blue)]">
            <BookOpenText size={17} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[var(--terminal-blue)]">CONTRACTS</p>
            <p className="text-[10px] text-[var(--terminal-text-secondary)]">
              {visibleChainId ? `Chain ${visibleChainId}` : "未连接钱包"}
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-end gap-1">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="新建目录"
              aria-label="新建目录"
              onClick={() => { if (currentChainId) setDirectoryDialog({ kind: "create", chainId: currentChainId }); }}
              disabled={!currentChainId}
              className="side-icon disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FolderPlus size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              title="导出全部本地数据"
              aria-label="导出全部本地数据"
              onClick={() => void exportData()}
              className="side-icon"
            >
              <Download size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              title="导入 JSON"
              aria-label="导入 JSON"
              onClick={() => setImportOpen(true)}
              disabled={!currentChainId}
              className="side-icon disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileUp size={14} aria-hidden="true" />
            </button>
            <ContractForm compact defaultChainId={currentChainId} onSuccess={onCatalogChanged} />
            <button
              type="button"
              title="排序"
              aria-label="合约排序"
              aria-haspopup="menu"
              aria-expanded={menu?.kind === "sort"}
              onClick={(event) => {
                event.stopPropagation();
                if (menu?.kind === "sort") closeMenu(true);
                else openSortMenu(event.currentTarget);
              }}
              className="side-icon"
            >
              <ArrowDownAZ size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--terminal-text-secondary)]"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="terminal-input terminal-input-search h-8 pr-2 text-[12px]"
            placeholder="搜索名称或地址..."
            aria-label="搜索合约名称或地址"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {selectionMode && (
          <div className="mt-2 space-y-2 border-t border-[var(--terminal-separator)] pt-2" role="region" aria-label="合约批量操作">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] text-[var(--terminal-blue)]" aria-live="polite">
                已选 {selectedContracts.length} 个合约{hiddenSelectedCount > 0 ? `（搜索结果外 ${hiddenSelectedCount} 个）` : ""}
              </p>
              <button type="button" className="side-icon shrink-0" aria-label="退出选择" title="退出选择 (Esc)" onClick={() => clearSelection(true)} disabled={selectionBusy}>
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" className="py-1 text-[11px] text-[var(--terminal-text-secondary)] hover:text-[var(--terminal-blue)] disabled:opacity-40" aria-label={search.trim() ? "全选搜索结果" : "全选当前网络"} onClick={selectAllResults} disabled={!filteredContracts.length || allResultsSelected || selectionBusy}>全选</button>
              <button type="button" className="py-1 text-[11px] text-[var(--terminal-text-secondary)] hover:text-[var(--terminal-blue)] disabled:opacity-40" aria-label="清空选择" onClick={() => clearSelection()} disabled={!selectedContracts.length || selectionBusy}>清空</button>
              <button type="button" className="terminal-btn terminal-btn-secondary ml-auto flex-1 !px-2 !py-1.5 !text-[11px]" aria-label="批量移动合约" onClick={() => setDirectoryDialog({ kind: "move", contracts: selectedContracts })} disabled={!selectedContracts.length || selectionBusy}>
                <FolderInput size={13} aria-hidden="true" />移动
              </button>
              <button type="button" className="terminal-btn flex-1 !border-[var(--terminal-red)] !px-2 !py-1.5 !text-[11px] text-[var(--terminal-red)] hover:bg-[var(--terminal-red)]/10" aria-label="批量删除合约" onClick={() => setDeleteTargets(selectedContracts)} disabled={!selectedContracts.length || selectionBusy}>
                <Trash2 size={13} aria-hidden="true" />删除
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        ref={catalogRef}
        role="region"
        aria-label="合约列表"
        tabIndex={0}
        className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 outline-none ${selectionMode ? "select-none cursor-crosshair" : ""}`}
        onDragStart={() => { clearLongPress(); closeMenu(); }}
        onKeyDown={(event) => {
          if (selectionMode && !selectionBusy && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && !(event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) {
            event.preventDefault();
            selectAllResults();
          }
        }}
        onPointerDown={startMarquee}
        onContextMenu={(event) => { if (marquee.current && event.ctrlKey) event.preventDefault(); }}
        onPointerMove={(event) => {
          if (marquee.current?.pointerId === event.pointerId) {
            marquee.current.clientX = event.clientX;
            marquee.current.clientY = event.clientY;
          }
        }}
        onPointerUp={(event) => {
          if (marquee.current?.pointerId !== event.pointerId) return;
          const drawn = marquee.current.started;
          if (drawn) {
            if (marqueeFrame.current !== null) cancelAnimationFrame(marqueeFrame.current);
            marquee.current.clientX = event.clientX;
            marquee.current.clientY = event.clientY;
            updateMarquee();
            suppressNextClick.current = true;
            window.setTimeout(() => { suppressNextClick.current = false; }, 0);
          }
          finishMarquee();
          if (!drawn && !event.ctrlKey && !event.metaKey) clearSelection();
        }}
        onPointerCancel={() => {
          const initialIds = marquee.current?.initialIds;
          if (initialIds) setSelection((current) => ({ ...current, ids: initialIds }));
          finishMarquee();
        }}
        onLostPointerCapture={() => { if (marquee.current) finishMarquee(); }}
        onClick={(event) => {
          if (selectionMode && !selectionBusy && !(event.target as HTMLElement).closest("[data-contract-id], button, input, select, a") && !event.ctrlKey && !event.metaKey) clearSelection();
        }}
      >
        {(isLoading && !contracts.length) || (directoriesPending && visibleChainId) ? (
          <div className="flex items-center gap-2 px-2 py-4 text-[11px] text-[var(--terminal-text-secondary)]" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--terminal-text-secondary)] border-t-transparent" aria-hidden="true" />
            正在加载合约与目录…
          </div>
        ) : (hasError && !contracts.length) || directoriesError ? (
          <div className="px-2 py-4 text-[11px] text-[var(--terminal-red)]">获取合约或目录失败，请检查网络后重试</div>
        ) : !contracts.length && !directories.length ? (
          <div className="px-2 py-4 text-[11px] leading-relaxed text-[var(--terminal-text-secondary)]">
            {visibleChainId ? "当前网络暂无已导入合约" : "连接钱包后显示对应网络合约"}
          </div>
        ) : search.trim() && !filteredContracts.length ? (
          <div className="px-2 py-4 text-[11px] text-[var(--terminal-text-secondary)]">未找到匹配的合约</div>
        ) : visibleChainId ? (
          <ContractDirectoryCatalog
            key={visibleChainId}
            contracts={filteredContracts}
            directories={sortedDirectories}
            chainId={visibleChainId}
            searching={Boolean(search.trim())}
            selectedContracts={selectedContracts}
            disabled={selectionBusy}
            onCollapseChange={() => { selectionAnchor.current = null; }}
            onRename={(directory) => setDirectoryDialog({ kind: "rename", directory })}
            onDelete={setDeleteDirectoryTarget}
            onMove={moveToDirectory}
            renderContract={(contract) => {
            const isCurrent = currentContractId === contract.id;
            const isSelected = selectionMode && selectedIds.has(contract.id);
            const isMenuOpen = menu?.kind === "actions" && menu.contract.id === contract.id;
            return (
              <div
                key={contract.id}
                className={`group flex items-stretch border transition-colors ${
                  isSelected
                    ? "border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/15 ring-1 ring-inset ring-[var(--terminal-blue)]/30"
                    : isCurrent && !selectionMode
                    ? "border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/10"
                    : "border-[var(--terminal-separator)] bg-[var(--terminal-card)] hover:bg-[var(--terminal-hover)]"
                }`}
              >
                <button
                  type="button"
                  onClick={(event) => clickContract(contract, event)}
                  aria-pressed={selectionMode ? isSelected : undefined}
                  disabled={selectionBusy}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.ctrlKey && event.button === 0) {
                      clickContract(contract, event);
                      return;
                    }
                    menuTriggerRef.current = event.currentTarget;
                    openActionsMenu(contract, event.clientX, event.clientY);
                  }}
                  onTouchStart={(event) => startLongPress(contract, event)}
                  onTouchEnd={endLongPress}
                  onTouchMove={clearLongPress}
                  onTouchCancel={() => { clearLongPress(); longPressOpened.current = false; suppressNextClick.current = false; }}
                  className="min-w-0 flex-1 cursor-default px-2.5 py-2 text-left focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium">{contract.name}</span>
                    <Plug
                      size={12}
                      className={isCurrent ? "text-[var(--terminal-green)]" : "text-[var(--terminal-text-secondary)]"}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="font-mono text-[11px] text-[var(--terminal-text-secondary)]">
                    {shortAddress(contract.address)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--terminal-text-secondary)]">
                    ABI: {Array.isArray(contract.abi) ? contract.abi.length : 0}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isMenuOpen) closeMenu(true);
                    else openActionsFromButton(contract, event.currentTarget);
                  }}
                  className="side-icon my-1 mr-1 shrink-0 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`管理合约 ${contract.name}`}
                  aria-haspopup="menu"
                  aria-expanded={isMenuOpen}
                  title="合约操作"
                >
                  <MoreVertical size={14} aria-hidden="true" />
                </button>
              </div>
            );
            }}
          />
        ) : null}
      </div>

      {selectionMode && selectionBox && (
        <div aria-hidden="true" className="pointer-events-none fixed z-[80] border border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/15" style={selectionBox} />
      )}

      {menu?.kind === "actions" && (
        <ActionsMenu
          position={{ x: menu.x, y: menu.y }}
          selectionMode={selectionMode}
          selectedCount={selectionMode && selectedIds.has(menu.contract.id) ? selectedContracts.length : 1}
          onAction={runMenuAction}
          onClose={closeMenu}
        />
      )}

      {menu?.kind === "sort" && (
        <SortMenu
          position={{ x: menu.x, y: menu.y }}
          sortBy={sortBy}
          onSelect={(value) => {
            setSortBy(value);
            closeMenu(true);
          }}
          onClose={closeMenu}
        />
      )}

      {selectorContract && (
        <SelectorDialog contract={selectorContract} onClose={() => setSelectorContract(null)} />
      )}

      {editingContract && (
        <EditContractDialog
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onSaved={onCatalogChanged}
        />
      )}

      {importOpen && currentChainId && (
        <ImportContractsDialog
          chainId={currentChainId}
          onClose={() => setImportOpen(false)}
          onImported={onCatalogChanged}
        />
      )}

      {directoryDialog && (
        <ContractDirectoryDialog
          mode={directoryDialog}
          directories={sortedDirectories}
          onClose={() => setDirectoryDialog(null)}
          onSaved={async () => {
            await refreshDirectories();
            if (directoryDialog.kind === "move") clearSelection(true);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteDirectoryTarget)}
        title="删除目录"
        message={deleteDirectoryTarget ? `确定删除目录 ${deleteDirectoryTarget.name}？其中的合约会回到未分组，合约及历史日志都会保留。` : ""}
        confirmText={deletingDirectory ? "删除中…" : "删除目录"}
        cancelText="取消"
        type="warning"
        onConfirm={() => void confirmDeleteDirectory()}
        onCancel={() => { if (!deletingDirectory) setDeleteDirectoryTarget(null); }}
      />

      <ConfirmDialog
        isOpen={deleteTargets.length > 0}
        title={deleteTargets.length > 1 ? "批量删除合约" : "DELETE_CONTRACT"}
        message={deleteTargets.length ? `确定删除${deleteTargets.length > 1 ? `选中的 ${deleteTargets.length} 个合约（${deleteTargets.slice(0, 3).map((contract) => contract.name).join("、")}${deleteTargets.length > 3 ? "等" : ""}）` : ` ${deleteTargets[0].name}`}？这些合约的历史日志也会一并删除。` : ""}
        confirmText={deleting ? "删除中…" : "删除"}
        cancelText="取消"
        type="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!deleting) setDeleteTargets([]); }}
      />
    </aside>
  );
}
