"use client";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getTransactionExplorers } from "@/lib/transaction-explorers";

export default function TransactionHash({ hash, chainId, abbreviated = false }: {
  hash: string;
  chainId: number;
  abbreviated?: boolean;
}) {
  const explorers = getTransactionExplorers(chainId, hash);

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      toast.success("交易哈希已复制");
    } catch {
      toast.error("复制失败，请手动选择哈希复制");
    }
  };

  return (
    <Dialog>
      <DialogTrigger className="max-w-full cursor-pointer break-all text-left font-mono text-[var(--terminal-blue)] underline decoration-[var(--terminal-blue)]/40 underline-offset-2 hover:decoration-[var(--terminal-blue)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]" title="选择区块浏览器查看交易">
        {abbreviated ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash}
      </DialogTrigger>
      <DialogContent className="bg-[var(--terminal-card)] sm:max-w-md">
        <DialogTitle className="pr-8 text-[14px]">查看交易</DialogTitle>
        <DialogDescription>选择区块浏览器，在新标签页查看 Chain {chainId} 上的交易。</DialogDescription>
        <div className="flex items-start gap-2 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3">
          <span className="min-w-0 flex-1 break-all font-mono text-[12px] text-[var(--terminal-text)]">{hash}</span>
          <button type="button" onClick={() => void copyHash()} className="cursor-pointer p-1 text-[var(--terminal-text-secondary)] hover:text-[var(--terminal-blue)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]" aria-label="复制交易哈希" title="复制交易哈希">
            <Copy size={14} aria-hidden="true" />
          </button>
        </div>
        {explorers.length > 0 ? (
          <div className="grid gap-2">
            {explorers.map((explorer) => (
              <a key={explorer.url} href={explorer.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 border border-[var(--terminal-separator)] px-3 py-2.5 text-[13px] text-[var(--terminal-text)] hover:bg-[var(--terminal-hover)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]">
                {explorer.name}
                <ExternalLink size={14} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--terminal-text-secondary)]">此网络暂无可用的区块浏览器，请复制交易哈希。</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
