"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseContractImportSources } from "@/lib/contract-import";
import { upsertContractsBatch } from "@/lib/local-store";

interface ImportContractsDialogProps {
  chainId: number;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}

function summarizeErrors(messages: string[]): string | undefined {
  if (!messages.length) return undefined;
  const shown = messages.slice(0, 3).join("；");
  return messages.length > 3 ? `${shown}；另有 ${messages.length - 3} 个错误` : shown;
}

export default function ImportContractsDialog({ chainId, onClose, onImported }: ImportContractsDialogProps) {
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const importFiles = async (files: File[]) => {
    if (!files.length || importing) return;

    setImporting(true);
    try {
      const parsed = await parseContractImportSources(files, { defaultChainId: chainId });
      if (!parsed.contracts.length) {
        throw new Error(parsed.errors[0] ?? "未找到可导入的合约");
      }

      const results = await upsertContractsBatch(parsed.contracts);
      const successes = results.filter((result) => result.success);
      const failures = results.filter((result) => !result.success);
      const crossChainCount = parsed.contracts.filter(
        (contract, index) => contract.chainId !== chainId && results[index]?.success
      ).length;

      await onImported();

      const failureMessages = [
        ...parsed.errors,
        ...failures.map((failure) => `${failure.name}: ${failure.error ?? "导入失败"}`),
      ];

      if (!successes.length) {
        toast.error(`导入失败（0/${parsed.contracts.length}）`, {
          description: summarizeErrors(failureMessages),
        });
        return;
      }

      const notes = [
        failures.length ? `${failures.length} 个失败：${summarizeErrors(failureMessages)}` : "",
        parsed.errors.length ? `${parsed.errors.length} 个文件解析失败` : "",
        crossChainCount ? `${crossChainCount} 个合约属于其他网络，已保存但当前网络列表不可见` : "",
      ].filter(Boolean);

      toast.success(`导入完成：成功 ${successes.length}/${parsed.contracts.length}`, notes.length
        ? { description: notes.join("；") }
        : undefined);

      if (failureMessages.length) {
        console.warn("合约文件导入失败项:", failureMessages);
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
      setIsDragging(false);
    }
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await importFiles(files);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (importing) return;
    const files = Array.from(event.dataTransfer.files).filter(
      (file) => file.type === "application/json" || file.name.toLowerCase().endsWith(".json")
    );
    if (!files.length) {
      toast.error("请拖入 .json 文件");
      return;
    }
    await importFiles(files);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !importing) onClose(); }}>
      <DialogContent className="gap-0 bg-white p-0 sm:max-w-md">
        <DialogHeader className="border-b border-[var(--terminal-separator)] p-4 pr-12">
          <DialogTitle className="text-[14px] font-medium">导入 JSON</DialogTitle>
          <DialogDescription className="text-[11px]">
            选择文件或拖入单个/多个 JSON 文件，支持单个合约对象或合约数组。
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={(event) => void handleFileInput(event)}
          />
          <button
            type="button"
            className="terminal-btn terminal-btn-primary mb-3 w-full"
            disabled={importing}
            onClick={() => inputRef.current?.click()}
          >
            <FileUp size={15} aria-hidden="true" />
            {importing ? "导入中…" : "选择 JSON 文件"}
          </button>

          <div
            className={`border border-dashed px-4 py-8 text-center transition-colors ${
              isDragging
                ? "border-[var(--terminal-green)] bg-[var(--terminal-green)]/10"
                : "border-[var(--terminal-separator)] bg-[var(--terminal-fill)]"
            }`}
            onDragEnter={(event) => { event.preventDefault(); if (!importing) setIsDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); if (!importing) setIsDragging(true); }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDrop={(event) => void handleDrop(event)}
          >
            <FileUp size={22} className="mx-auto mb-2 text-[var(--terminal-green)]" aria-hidden="true" />
            <p className="text-[12px] font-medium">{importing ? "正在导入 JSON…" : "拖入单个或多个 JSON 文件"}</p>
            <p className="mt-1 text-[11px] text-[var(--terminal-text-secondary)]">
              地址需为 0x + 40 位十六进制，ABI 必须是合法数组
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
