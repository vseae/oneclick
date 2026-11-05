"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ContractDirectoryRecord, ContractRecord } from "@/lib/types";

const DRAG_TYPE = "application/x-oneclick-contract";

interface ContractDirectoryCatalogProps {
  contracts: ContractRecord[];
  directories: ContractDirectoryRecord[];
  chainId: number;
  searching: boolean;
  selectedContracts: ContractRecord[];
  disabled: boolean;
  onCollapseChange: () => void;
  renderContract: (contract: ContractRecord) => ReactNode;
  onRename: (directory: ContractDirectoryRecord) => void;
  onDelete: (directory: ContractDirectoryRecord) => void;
  onMove: (contracts: ContractRecord[], directoryId: number | null) => Promise<boolean>;
}

export default function ContractDirectoryCatalog({ contracts, directories, chainId, searching, selectedContracts, disabled, onCollapseChange, renderContract, onRename, onDelete, onMove }: ContractDirectoryCatalogProps) {
  const storageKey = `oneclick:collapsed-directories:v1:${chainId}`;
  const [collapsed, setCollapsed] = useState<number[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      return Array.isArray(stored) ? stored.filter((id) => Number.isInteger(id) && id > 0) : [];
    } catch {
      return [];
    }
  });
  const [dropTarget, setDropTarget] = useState<number | "ungrouped" | null>(null);
  const [moving, setMoving] = useState(false);
  const dragged = useRef<{ sourceId: number; contracts: ContractRecord[] } | null>(null);
  const groups = useMemo(() => {
    const knownIds = new Set(directories.map((directory) => directory.id));
    const grouped = new Map<number | null, ContractRecord[]>();
    for (const contract of contracts) {
      const id = contract.directoryId && knownIds.has(contract.directoryId) ? contract.directoryId : null;
      const group = grouped.get(id) ?? [];
      group.push(contract);
      grouped.set(id, group);
    }
    return grouped;
  }, [contracts, directories]);

  const changeOpen = (id: number, open: boolean) => {
    if (searching) return;
    const next = open ? collapsed.filter((value) => value !== id) : [...collapsed.filter((value) => value !== id), id];
    setCollapsed(next);
    onCollapseChange();
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Browsing still works without storage. */ }
  };

  const dropHandlers = (directoryId: number | null) => ({
    onDragOver: (event: React.DragEvent) => {
      if (moving || disabled || !dragged.current || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(directoryId ?? "ungrouped");
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
    },
    onDrop: async (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.stopPropagation();
      setDropTarget(null);
      const id = Number(event.dataTransfer.getData(DRAG_TYPE));
      const source = dragged.current;
      if (!source || moving || disabled || source.sourceId !== id || source.contracts.every((contract) => (contract.directoryId ?? null) === directoryId)) return;
      dragged.current = null;
      setMoving(true);
      try {
        const moved = await onMove(source.contracts, directoryId);
        if (moved && directoryId !== null) changeOpen(directoryId, true);
      } finally {
        setMoving(false);
      }
    },
  });

  const renderRows = (items: ContractRecord[], visible = true) => items.map((contract) => (
    <div
      key={contract.id}
      data-contract-id={contract.id}
      data-contract-visible={visible}
      draggable={!moving && !disabled}
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest('[aria-haspopup="menu"]')) {
          event.preventDefault();
          return;
        }
        dragged.current = {
          sourceId: contract.id,
          contracts: selectedContracts.some((item) => item.id === contract.id) ? selectedContracts : [contract],
        };
        event.dataTransfer.setData(DRAG_TYPE, String(contract.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => { dragged.current = null; setDropTarget(null); }}
    >
      {renderContract(contract)}
    </div>
  ));

  return (
    <div className="space-y-2" aria-busy={moving}>
      {directories.map((directory) => {
        const items = groups.get(directory.id) ?? [];
        if (searching && items.length === 0) return null;
        const open = searching || !collapsed.includes(directory.id);
        const highlighted = dropTarget === directory.id;
        return (
          <Collapsible key={directory.id} open={open} onOpenChange={(value) => changeOpen(directory.id, value)}>
            <div
              {...dropHandlers(directory.id)}
              className={`rounded-lg border transition-colors ${highlighted ? "border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/10" : "border-transparent"}`}
              aria-label={`目录 ${directory.name}`}
            >
              <div className="group flex items-center gap-0.5">
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-2 text-left text-[12px] hover:bg-[var(--terminal-hover)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]">
                  <ChevronRight size={12} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
                  {open ? <FolderOpen size={14} className="shrink-0 text-[var(--terminal-blue)]" aria-hidden="true" /> : <Folder size={14} className="shrink-0 text-[var(--terminal-blue)]" aria-hidden="true" />}
                  <span className="truncate font-medium">{directory.name}</span>
                  <span className="ml-auto text-[10px] text-[var(--terminal-text-secondary)]">{items.length}</span>
                </CollapsibleTrigger>
                <button type="button" className="side-icon shrink-0 opacity-60 hover:opacity-100" aria-label={`修改目录名称 ${directory.name}`} title="修改目录名称" onClick={() => onRename(directory)}>
                  <Pencil size={12} aria-hidden="true" />
                </button>
                <button type="button" className="side-icon shrink-0 opacity-60 hover:opacity-100" aria-label={`删除目录 ${directory.name}`} title="删除目录" onClick={() => onDelete(directory)}>
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
              <CollapsibleContent className="ml-3 space-y-1.5 border-l border-[var(--terminal-separator)] py-1 pl-2">
                {items.length ? renderRows(items, open) : <p className="px-1 py-2 text-[11px] text-[var(--terminal-text-secondary)]">拖动合约到此目录</p>}
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
      <section
        {...dropHandlers(null)}
        aria-label="未分组合约"
        className={`rounded-lg border p-1 transition-colors ${dropTarget === "ungrouped" ? "border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/10" : "border-transparent"}`}
      >
        <p className="mb-1.5 px-1 text-[11px] text-[var(--terminal-text-secondary)]">未分组 <span className="ml-1">{groups.get(null)?.length ?? 0}</span></p>
        <div className="space-y-1.5">
          {renderRows(groups.get(null) ?? [])}
        </div>
      </section>
    </div>
  );
}
