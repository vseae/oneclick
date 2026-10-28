"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownAZ,
  BookOpenText,
  Download,
  FileUp,
  MoreVertical,
  Plug,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useHydrated } from "@/lib/use-hydrated";
import { deleteContract, exportLocalData } from "@/lib/local-store";
import type { ContractRecord } from "@/lib/types";
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
  onDeleteContract: (id: number) => void;
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
  onDeleteContract,
  onCatalogChanged,
}: SideNavProps) {
  const hydrated = useHydrated();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [menu, setMenu] = useState<ActiveMenu>(null);
  const [selectorContract, setSelectorContract] = useState<ContractRecord | null>(null);
  const [editingContract, setEditingContract] = useState<ContractRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressNextClick = useRef(false);

  const visibleChainId = hydrated ? currentChainId : undefined;

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
    const blockClick = (event: MouseEvent) => {
      if (!suppressNextClick.current) return;
      suppressNextClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("click", blockClick, true);
    return () => window.removeEventListener("click", blockClick, true);
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

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenu(null);
    if (restoreFocus) {
      menuTriggerRef.current?.focus();
    }
  }, []);

  const openActionsMenu = (contract: ContractRecord, x: number, y: number) => {
    const position = clampMenuPosition(x, y, 184, 196);
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
    suppressNextClick.current = false;
    const touch = event.touches[0];
    if (!touch) return;
    const { clientX, clientY } = touch;

    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      suppressNextClick.current = true;
      window.setTimeout(() => {
        suppressNextClick.current = false;
      }, 2000);
      menuTriggerRef.current = null;
      openActionsMenu(contract, clientX, clientY);
    }, 550);
  };

  const runMenuAction = (action: ContractMenuAction) => {
    if (menu?.kind !== "actions") return;
    const contract = menu.contract;
    closeMenu();
    if (action === "open") onSelectContract(contract);
    else if (action === "edit") setEditingContract(contract);
    else if (action === "selector") setSelectorContract(contract);
    else setDeleteTarget(contract);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteContract(deleteTarget.id);
      onDeleteContract(deleteTarget.id);
      await onCatalogChanged();
      setDeleteTarget(null);
      toast.success("合约已删除");
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
      toast.success("本地数据已导出", { description: "备份包含所有网络的合约与历史记录" });
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
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {isLoading && !contracts.length ? (
          <div className="flex items-center gap-2 px-2 py-4 text-[11px] text-[var(--terminal-text-secondary)]" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--terminal-text-secondary)] border-t-transparent" aria-hidden="true" />
            正在加载合约…
          </div>
        ) : hasError && !contracts.length ? (
          <div className="px-2 py-4 text-[11px] text-[var(--terminal-red)]">获取合约失败，请检查网络后重试</div>
        ) : !contracts.length ? (
          <div className="px-2 py-4 text-[11px] leading-relaxed text-[var(--terminal-text-secondary)]">
            {visibleChainId ? "当前网络暂无已导入合约" : "连接钱包后显示对应网络合约"}
          </div>
        ) : !filteredContracts.length ? (
          <div className="px-2 py-4 text-[11px] text-[var(--terminal-text-secondary)]">未找到匹配的合约</div>
        ) : (
          filteredContracts.map((contract) => {
            const isCurrent = currentContractId === contract.id;
            const isMenuOpen = menu?.kind === "actions" && menu.contract.id === contract.id;
            return (
              <div
                key={contract.id}
                className={`group flex items-stretch border transition-colors ${
                  isCurrent
                    ? "border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/10"
                    : "border-[var(--terminal-separator)] bg-[var(--terminal-card)] hover:bg-[var(--terminal-hover)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectContract(contract)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    menuTriggerRef.current = event.currentTarget;
                    openActionsMenu(contract, event.clientX, event.clientY);
                  }}
                  onTouchStart={(event) => startLongPress(contract, event)}
                  onTouchEnd={clearLongPress}
                  onTouchMove={clearLongPress}
                  onTouchCancel={clearLongPress}
                  className="min-w-0 flex-1 px-2.5 py-2 text-left focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
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
          })
        )}
      </div>

      {menu?.kind === "actions" && (
        <ActionsMenu
          position={{ x: menu.x, y: menu.y }}
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

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="DELETE_CONTRACT"
        message={deleteTarget ? `确定删除 ${deleteTarget.name}？该合约的历史日志也会一并删除。` : ""}
        confirmText={deleting ? "删除中…" : "删除"}
        cancelText="取消"
        type="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </aside>
  );
}
