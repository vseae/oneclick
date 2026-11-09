"use client";

import { useMemo, useState } from "react";
import { abiSignature, normalizeAbi } from "@/lib/abi";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isReadMethod, parseAbiSelectors, type SelectorItem } from "@/lib/contract-utils";
import type { ContractRecord } from "@/lib/types";

interface SelectorDialogProps {
  contract: ContractRecord;
  onClose: () => void;
}

export default function SelectorDialog({ contract, onClose }: SelectorDialogProps) {
  const parsed = useMemo(() => {
    try {
      return { items: parseAbiSelectors(contract.abi), error: null as string | null };
    } catch (error) {
      return {
        items: [] as SelectorItem[],
        error: error instanceof Error ? error.message : "ABI 无法解析",
      };
    }
  }, [contract.abi]);

  const functions = useMemo(() => {
    try { return normalizeAbi(contract.abi).filter((item) => item.type === "function"); }
    catch { return []; }
  }, [contract.abi]);

  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (item: SelectorItem) => {
    try {
      await navigator.clipboard.writeText(item.selector);
      setCopied(item.selector);
      toast.success("Selector 已复制");
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  const typeLabel = (item: SelectorItem) => {
    if (item.type === "event") return "event";
    if (item.type === "error") return "error";
    const fn = functions.find((fn) => abiSignature(fn) === item.signature);
    return fn && isReadMethod(fn) ? "read" : "write";
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[82vh] gap-0 overflow-hidden bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[var(--terminal-separator)] p-4 pr-12">
          <DialogTitle className="text-[14px] font-medium">{contract.name} · Selector</DialogTitle>
          <DialogDescription className="break-all font-mono text-[11px]">
            {contract.address}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[62vh] overflow-y-auto p-3">
          {parsed.error ? (
            <p role="alert" className="px-2 py-8 text-center text-[12px] text-[var(--terminal-red)]">
              ABI 无法解析：{parsed.error}
            </p>
          ) : parsed.items.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[var(--terminal-text-secondary)]">
              没有可用的 Selector
            </p>
          ) : (
            parsed.items.map((item) => (
              <div
                key={`${item.type}-${item.selector}`}
                className="flex items-center gap-2 border-b border-[var(--terminal-separator)] py-2 text-[12px]"
              >
                <span className="w-14 shrink-0 text-[10px] uppercase text-[var(--terminal-text-secondary)]">
                  {typeLabel(item)}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">{item.signature}</span>
                <code className="shrink-0 text-[11px] text-[var(--terminal-blue)]">{item.selector}</code>
                <button
                  type="button"
                  onClick={() => void copy(item)}
                  className="side-icon"
                  aria-label={`复制 ${item.signature} 的 selector`}
                  title="复制 selector"
                >
                  {copied === item.selector ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
