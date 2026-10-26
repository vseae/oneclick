"use client";

import { useState } from "react";
import type { InterfaceAbi } from "ethers";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  contractAddressSchema,
  contractNameSchema,
  parseAbiText,
} from "@/lib/contract-validation";
import { updateContractById } from "@/lib/local-store";
import type { ContractRecord } from "@/lib/types";

interface EditContractDialogProps {
  contract: ContractRecord;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

type FieldErrors = Partial<Record<"name" | "address" | "abi", string>>;

export default function EditContractDialog({ contract, onClose, onSaved }: EditContractDialogProps) {
  const [name, setName] = useState(contract.name);
  const [address, setAddress] = useState(contract.address);
  const [abiText, setAbiText] = useState(() =>
    typeof contract.abi === "string" ? contract.abi : JSON.stringify(contract.abi ?? [], null, 2)
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const nameResult = contractNameSchema.safeParse(name);
    const addressResult = contractAddressSchema.safeParse(address);
    let abi: InterfaceAbi | null = null;
    let abiError = "";

    try {
      abi = parseAbiText(abiText);
    } catch (error) {
      abiError = error instanceof Error ? error.message : "ABI 无效";
    }

    const nextErrors: FieldErrors = {};
    if (!nameResult.success) nextErrors.name = nameResult.error.issues[0]?.message;
    if (!addressResult.success) nextErrors.address = addressResult.error.issues[0]?.message;
    if (!abi || abiError) nextErrors.abi = abiError || "ABI 无效";

    setErrors(nextErrors);
    if (!nameResult.success || !addressResult.success || !abi) return;

    setSaving(true);
    try {
      await updateContractById(contract.id, {
        name: nameResult.data,
        address: addressResult.data,
        abi,
      });
      await onSaved();
      toast.success("合约信息已更新");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[88vh] max-w-lg gap-0 overflow-y-auto bg-white p-0">
        <DialogHeader className="border-b border-[var(--terminal-separator)] p-4 pr-12">
          <DialogTitle className="text-[14px] font-medium">编辑合约</DialogTitle>
          <DialogDescription className="text-[11px]">
            修改名称、地址或 ABI，保存后立即生效。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-3 p-4">
          <div>
            <label htmlFor="edit-contract-name" className="mb-1 block text-[12px] font-medium text-[var(--terminal-text-secondary)]">
              合约名称
            </label>
            <input
              id="edit-contract-name"
              className="terminal-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：USDT"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p role="alert" className="mt-1 text-[11px] text-[var(--terminal-red)]">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="edit-contract-address" className="mb-1 block text-[12px] font-medium text-[var(--terminal-text-secondary)]">
              合约地址
            </label>
            <input
              id="edit-contract-address"
              className="terminal-input font-mono"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.address)}
            />
            {errors.address && <p role="alert" className="mt-1 text-[11px] text-[var(--terminal-red)]">{errors.address}</p>}
          </div>

          <div>
            <label htmlFor="edit-contract-abi" className="mb-1 block text-[12px] font-medium text-[var(--terminal-text-secondary)]">
              ABI (JSON)
            </label>
            <textarea
              id="edit-contract-abi"
              className="terminal-input min-h-48 resize-y font-mono text-[12px]"
              value={abiText}
              onChange={(event) => setAbiText(event.target.value)}
              placeholder='[{"type":"function","name":"totalSupply","inputs":[],"outputs":[]}]'
              spellCheck={false}
              autoComplete="off"
              aria-invalid={Boolean(errors.abi)}
            />
            {errors.abi && <p role="alert" className="mt-1 text-[11px] text-[var(--terminal-red)]">{errors.abi}</p>}
          </div>

          <DialogFooter className="!m-0 !border-0 !bg-transparent !p-0 pt-2">
            <button type="button" className="terminal-btn terminal-btn-secondary" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button type="submit" className="terminal-btn terminal-btn-primary" disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
