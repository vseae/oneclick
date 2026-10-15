"use client";

import { useEffect } from "react";

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
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "warning",
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onCancel();
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "unset";
        document.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return "[!]";
      case "warning":
        return "[?]";
      case "info":
        return "[i]";
      default:
        return "[*]";
    }
  };

  const getConfirmColor = () => {
    switch (type) {
      case "danger":
        return "border-[var(--terminal-red)] text-[var(--terminal-red)] hover:bg-[var(--terminal-red)]/10";
      case "warning":
        return "border-[var(--terminal-orange)] text-[var(--terminal-orange)] hover:bg-[var(--terminal-orange)]/10";
      case "info":
        return "border-[var(--terminal-blue)] text-[var(--terminal-blue)] hover:bg-[var(--terminal-blue)]/10";
      default:
        return "border-[var(--terminal-separator)] text-[var(--terminal-text)] hover:bg-[var(--terminal-hover)]";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      <div className="relative terminal-card p-5 max-w-md w-full">
        <div className="text-center mb-3 text-[12px] font-bold tracking-[0.1em] text-[var(--terminal-blue)]">
          {getIcon()}
        </div>

        <h2 className="text-[14px] font-bold tracking-[0.08em] uppercase text-center mb-3 text-[var(--terminal-text)]">
          {title}
        </h2>

        <p className="text-center text-[12px] text-[var(--terminal-text-secondary)] mb-5 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="terminal-btn terminal-btn-secondary flex-1"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`terminal-btn flex-1 ${getConfirmColor()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
