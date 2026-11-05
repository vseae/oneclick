"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, FileCode2, FolderInput, MousePointer2, Pencil, Plug, Trash2, X } from "lucide-react";

export type SortBy = "newest" | "oldest" | "name-asc" | "name-desc";
export type ContractMenuAction = "open" | "edit" | "selector" | "move" | "delete" | "select" | "exitSelection";

interface MenuPosition {
  x: number;
  y: number;
}

interface ActionsMenuProps {
  position: MenuPosition;
  selectionMode: boolean;
  selectedCount: number;
  onAction: (action: ContractMenuAction) => void;
  onClose: (restoreFocus?: boolean) => void;
}

export function ActionsMenu({ position, selectionMode, selectedCount, onAction, onClose }: ActionsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    const index = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="合约操作"
      className="fixed z-[90] w-44 border border-[var(--terminal-separator)] bg-white p-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      <button type="button" role="menuitem" onClick={() => onAction(selectionMode ? "exitSelection" : "select")} className="menu-item">
        {selectionMode ? <X size={14} aria-hidden="true" /> : <MousePointer2 size={14} aria-hidden="true" />}
        {selectionMode ? "退出选择" : "选中"}
      </button>
      <div className="my-1 border-t border-[var(--terminal-separator)]" />
      <button type="button" role="menuitem" onClick={() => onAction("open")} className="menu-item">
        <Plug size={14} aria-hidden="true" />打开交互面板
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("edit")} className="menu-item">
        <Pencil size={14} aria-hidden="true" />编辑合约
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("selector")} className="menu-item">
        <FileCode2 size={14} aria-hidden="true" />查看 Selector
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("move")} className="menu-item">
        <FolderInput size={14} aria-hidden="true" />{selectedCount > 1 ? `批量移动 (${selectedCount})` : "移动到目录"}
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("delete")} className="menu-item text-[var(--terminal-red)]">
        <Trash2 size={14} aria-hidden="true" />{selectedCount > 1 ? `批量删除 (${selectedCount})` : "删除合约"}
      </button>
    </div>,
    document.body
  );
}

interface SortMenuProps {
  position: MenuPosition;
  sortBy: SortBy;
  onSelect: (value: SortBy) => void;
  onClose: (restoreFocus?: boolean) => void;
}

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "newest", label: "最新添加" },
  { value: "oldest", label: "最早添加" },
  { value: "name-asc", label: "名称 A-Z" },
  { value: "name-desc", label: "名称 Z-A" },
];

export function SortMenu({ position, sortBy, onSelect, onClose }: SortMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="合约排序"
      className="fixed z-[90] w-44 border border-[var(--terminal-separator)] bg-white p-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === "Escape") {
          event.preventDefault();
          onClose(true);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          items[(index + 1) % items.length]?.focus();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          items[(index - 1 + items.length) % items.length]?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      {SORT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={sortBy === option.value}
          onClick={() => onSelect(option.value)}
          className="menu-item"
        >
          {sortBy === option.value ? <Check size={13} className="text-[var(--terminal-blue)]" aria-hidden="true" /> : <span className="w-3" />}
          {option.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
