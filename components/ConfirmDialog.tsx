"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "danger" | "warning" | "info";
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
  type = "warning",
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const icon = type === "danger" ? "[!]" : type === "warning" ? "[?]" : "[i]";

  const confirmClass =
    type === "danger"
      ? "border-[var(--terminal-red)] text-[var(--terminal-red)] hover:bg-[var(--terminal-red)]/10"
      : type === "warning"
        ? "border-[var(--terminal-orange)] text-[var(--terminal-orange)] hover:bg-[var(--terminal-orange)]/10"
        : "border-[var(--terminal-blue)] text-[var(--terminal-blue)] hover:bg-[var(--terminal-blue)]/10";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="gap-0 bg-white p-5 sm:max-w-md" showCloseButton={false}>
        <div className="mb-3 text-center text-[12px] font-bold tracking-[0.1em] text-[var(--terminal-blue)]" aria-hidden="true">
          {icon}
        </div>

        <DialogTitle className="mb-3 text-center text-[14px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text)]">
          {title}
        </DialogTitle>

        <DialogDescription className="mb-5 text-center text-[12px] leading-relaxed text-[var(--terminal-text-secondary)]">
          {message}
        </DialogDescription>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="terminal-btn terminal-btn-secondary flex-1">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={`terminal-btn flex-1 ${confirmClass}`}>
            {confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
