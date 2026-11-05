"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDirectory, moveContractToDirectory, moveContractsToDirectory, renameDirectory } from "@/lib/local-store";
import { directoryNameSchema } from "@/lib/directory-validation";
import type { ContractDirectoryRecord, ContractRecord } from "@/lib/types";

export type DirectoryDialogMode =
  | { kind: "create"; chainId: number }
  | { kind: "rename"; directory: ContractDirectoryRecord }
  | { kind: "move"; contracts: ContractRecord[] };

interface ContractDirectoryDialogProps {
  mode: DirectoryDialogMode;
  directories: ContractDirectoryRecord[];
  onClose: () => void;
  onSaved: (directoryId?: number | null) => void | Promise<void>;
}

export default function ContractDirectoryDialog({ mode, directories, onClose, onSaved }: ContractDirectoryDialogProps) {
  const [name, setName] = useState(mode.kind === "rename" ? mode.directory.name : "");
  const [destination, setDestination] = useState(mode.kind === "move"
    ? mode.contracts.length === 1 ? String(mode.contracts[0].directoryId ?? "ungrouped") : ""
    : "new");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const needsName = mode.kind !== "move" || destination === "new";
  const title = mode.kind === "move"
    ? mode.contracts.length > 1 ? `批量移动 ${mode.contracts.length} 个合约` : "移动到目录"
    : mode.kind === "rename" ? "修改目录名称" : "新建目录";

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || (mode.kind === "move" && !destination)) return;
    const parsedName = directoryNameSchema.safeParse(name);
    if (needsName && !parsedName.success) {
      setError(parsedName.error.issues[0]?.message ?? "请输入目录名称");
      return;
    }
    setError("");
    setSaving(true);
    try {
      let directoryId: number | null | undefined;
      if (mode.kind === "create") {
        directoryId = (await createDirectory({ name: parsedName.data!, chainId: mode.chainId })).id;
      } else if (mode.kind === "rename") {
        await renameDirectory(mode.directory.id, parsedName.data!);
      } else {
        const input = destination === "new"
          ? { newDirectoryName: parsedName.data! }
          : { directoryId: destination === "ungrouped" ? null : Number(destination) };
        if (mode.contracts.length === 1) {
          directoryId = (await moveContractToDirectory(mode.contracts[0].id, input)).directoryId;
        } else {
          const moved = await moveContractsToDirectory(mode.contracts.map((contract) => contract.id), mode.contracts[0].chainId, input);
          directoryId = moved[0].directoryId;
        }
      }
      await onSaved(directoryId);
      toast.success(mode.kind === "move" ? `已移动 ${mode.contracts.length} 个合约` : mode.kind === "rename" ? "目录名称已更新" : "目录已创建");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="gap-0 bg-white p-0" showCloseButton={!saving}>
        <DialogHeader className="border-b border-[var(--terminal-separator)] p-4 pr-12">
          <DialogTitle className="text-[14px] font-medium">{title}</DialogTitle>
          <DialogDescription className="text-[11px]">
            {mode.kind === "move" ? `为${mode.contracts.length > 1 ? `选中的 ${mode.contracts.length} 个合约` : mode.contracts[0].name}选择目标目录，也可以新建目录。` : "目录用于组织当前网络的合约。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3 p-4">
          {mode.kind === "move" && (
            <div>
              <label htmlFor="contract-directory-destination" className="mb-1 block text-[12px] font-medium text-[var(--terminal-text-secondary)]">目标目录</label>
              <select
                id="contract-directory-destination"
                className="terminal-input"
                value={destination}
                onChange={(event) => { setDestination(event.target.value); setError(""); }}
                disabled={saving}
              >
                <option value="" disabled>请选择目录</option>
                <option value="ungrouped">未分组</option>
                {directories.filter((directory) => directory.chainId === mode.contracts[0].chainId).map((directory) => (
                  <option key={directory.id} value={directory.id}>{directory.name}</option>
                ))}
                <option value="new">＋ 新建目录</option>
              </select>
            </div>
          )}
          {needsName && (
            <div>
              <label htmlFor="contract-directory-name" className="mb-1 block text-[12px] font-medium text-[var(--terminal-text-secondary)]">目录名称</label>
              <input
                id="contract-directory-name"
                className="terminal-input"
                value={name}
                onChange={(event) => { setName(event.target.value); setError(""); }}
                placeholder="例如：交易合约"
                autoComplete="off"
                disabled={saving}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "contract-directory-error" : undefined}
              />
            </div>
          )}
          {error && <p id="contract-directory-error" role="alert" className="text-[11px] text-[var(--terminal-red)]">{error}</p>}
          <DialogFooter className="!m-0 !border-0 !bg-transparent !p-0 pt-2">
            <button type="button" className="terminal-btn terminal-btn-secondary" onClick={onClose} disabled={saving}>取消</button>
            <button type="submit" className="terminal-btn terminal-btn-primary" disabled={saving || (mode.kind === "move" && !destination)}>
              {saving ? "保存中…" : mode.kind === "move" ? "移动" : "保存"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
