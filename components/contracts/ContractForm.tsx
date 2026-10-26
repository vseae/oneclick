"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { parseContractImportPayload } from "@/lib/contract-import";
import { upsertContract, upsertContractsBatch } from "@/lib/local-store";
import { contractAddressSchema, contractNameSchema, parseAbiText } from "@/lib/contract-validation";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const formSchema = z.object({
  name: contractNameSchema,
  address: contractAddressSchema,
  abi: z
    .string()
    .min(1, "请输入 ABI")
    .refine((value) => {
      try {
        parseAbiText(value);
        return true;
      } catch {
        return false;
      }
    }, "ABI 必须是合法的 JSON ABI 数组"),
  chainId: z.string().optional(),
});

interface ContractFormProps {
  onSuccess: () => void | Promise<void>;
  defaultChainId?: number;
  /** Render an icon-only trigger for the compact sidebar header. */
  compact?: boolean;
}

function parseStrictChainId(input: unknown): number {
  const value = typeof input === "string" ? input.trim() : String(input ?? "");
  if (!/^\d+$/.test(value)) {
    throw new Error("链 ID 必须是正整数");
  }
  const chainId = Number(value);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("链 ID 必须是正整数");
  }
  return chainId;
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON 格式错误，请检查输入");
  }
}

export default function ContractForm({ onSuccess, defaultChainId, compact = false }: ContractFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useCustomChain, setUseCustomChain] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchJson, setBatchJson] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", address: "", abi: "", chainId: defaultChainId ? String(defaultChainId) : "" },
  });

  useEffect(() => {
    if (defaultChainId) {
      form.setValue("chainId", String(defaultChainId));
    }
  }, [defaultChainId, form]);

  const resolveChainId = (value?: string) => parseStrictChainId(value || defaultChainId);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const { updated } = await upsertContract({
        name: values.name,
        address: values.address,
        chainId: resolveChainId(values.chainId),
        abi: parseAbiText(values.abi),
      });
      await onSuccess();
      toast.success(updated ? "合约已更新" : "合约添加成功");
      setOpen(false);
      form.reset({ name: "", address: "", abi: "", chainId: defaultChainId ? String(defaultChainId) : "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败");
    } finally {
      setLoading(false);
    }
  };

  const onBatchSubmit = async () => {
    setLoading(true);
    try {
      const contracts = parseContractImportPayload(parseJsonText(batchJson), {
        defaultChainId: resolveChainId(),
        sourceName: "batch-json",
      });

      const results = await upsertContractsBatch(contracts);
      const success = results.filter((result) => result.success).length;
      const failures = results.filter((result) => !result.success);

      await onSuccess();

      if (!success) {
        toast.error(`添加失败（0/${contracts.length}）`, {
          description: failures[0]?.error ?? "没有合约被导入",
        });
        return;
      }

      toast.success(`成功添加 ${success}/${contracts.length} 个合约`, failures.length
        ? { description: `${failures.length} 个失败，请检查地址、ABI 和网络` }
        : undefined);
      setOpen(false);
      setBatchJson("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量添加失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className={`terminal-btn terminal-btn-primary ${compact ? "terminal-btn-compact" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={compact ? "添加合约" : undefined}
        title={compact ? "添加合约" : undefined}
      >
        <Plus size={16} aria-hidden="true" />
        {!compact && <span>ADD_CONTRACT</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[88vh] w-full gap-0 overflow-y-auto bg-[var(--terminal-card)] p-0 sm:max-w-[560px]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">添加合约</DialogTitle>
          <DialogDescription className="sr-only">添加单个合约或批量导入合约。</DialogDescription>

          <div className="flex items-center justify-between border-b border-[var(--terminal-separator)] p-5">
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-medium tracking-[0.01em]">[ADD_CONTRACT]</span>
              <button
                type="button"
                onClick={() => setBatchMode(!batchMode)}
                className="cursor-pointer text-[12px] text-[var(--terminal-blue)] hover:underline"
              >
                {batchMode ? "SINGLE_MODE" : "BATCH_MODE"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] transition-colors hover:bg-[var(--terminal-separator)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
              aria-label="关闭"
            >
              <X size={14} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
            </button>
          </div>

          {batchMode ? (
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="batch-json" className="mb-1.5 block text-[13px] font-medium text-[var(--terminal-text-secondary)]">
                  批量合约 JSON
                </label>
                <textarea
                  id="batch-json"
                  value={batchJson}
                  onChange={(event) => setBatchJson(event.target.value)}
                  className="terminal-input resize-none font-mono text-[13px]"
                  rows={12}
                  placeholder='[{"name":"USDT","address":"0x...","abi":[...]},{"contractName":"Vault","address":"0x...","abi":[...]}]'
                  spellCheck={false}
                  autoComplete="off"
                />
                <p className="mt-1 text-[11px] text-[var(--terminal-text-secondary)]">
                  支持数组或单个对象；chainId 缺省时使用当前钱包网络。
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="terminal-btn terminal-btn-secondary" onClick={() => setOpen(false)}>
                  取消
                </button>
                <button type="button" className="terminal-btn terminal-btn-primary" onClick={() => void onBatchSubmit()} disabled={loading}>
                  {loading ? "Importing..." : "IMPORT_BATCH"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-5">
              <div>
                <label htmlFor="contract-name" className="mb-1.5 block text-[13px] font-medium text-[var(--terminal-text-secondary)]">
                  合约名称
                </label>
                <input {...form.register("name")} id="contract-name" className="terminal-input" placeholder="例如: USDT…" autoComplete="off" />
                {form.formState.errors.name && (
                  <p className="mt-1 text-[12px] text-[var(--terminal-red)]" role="alert">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="contract-address" className="mb-1.5 block text-[13px] font-medium text-[var(--terminal-text-secondary)]">
                  合约地址
                </label>
                <input {...form.register("address")} id="contract-address" className="terminal-input font-mono" placeholder="0x…" autoComplete="off" spellCheck={false} />
                {form.formState.errors.address && (
                  <p className="mt-1 text-[12px] text-[var(--terminal-red)]" role="alert">{form.formState.errors.address.message}</p>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="contract-chainId" className="text-[13px] font-medium text-[var(--terminal-text-secondary)]">
                    链 ID
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomChain(!useCustomChain)}
                    className="cursor-pointer text-[12px] text-[var(--terminal-blue)] hover:underline"
                  >
                    {useCustomChain ? "选择预设" : "自定义"}
                  </button>
                </div>
                {useCustomChain ? (
                  <input {...form.register("chainId")} id="contract-chainId" className="terminal-input" placeholder={defaultChainId ? String(defaultChainId) : "1…"} type="number" inputMode="numeric" autoComplete="off" />
                ) : (
                  <select {...form.register("chainId")} id="contract-chainId" className="terminal-input">
                    <option value="">选择网络</option>
                    {SUPPORTED_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                )}
                {form.formState.errors.chainId && (
                  <p className="mt-1 text-[12px] text-[var(--terminal-red)]" role="alert">{form.formState.errors.chainId.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="contract-abi" className="mb-1.5 block text-[13px] font-medium text-[var(--terminal-text-secondary)]">
                  ABI (JSON)
                </label>
                <textarea
                  {...form.register("abi")}
                  id="contract-abi"
                  className="terminal-input resize-none font-mono text-[13px]"
                  rows={6}
                  placeholder='[{"inputs":[],"name":"totalSupply","type":"function"}]'
                  spellCheck={false}
                  autoComplete="off"
                />
                {form.formState.errors.abi && (
                  <p className="mt-1 text-[12px] text-[var(--terminal-red)]" role="alert">{form.formState.errors.abi.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="terminal-btn terminal-btn-secondary" onClick={() => setOpen(false)}>
                  取消
                </button>
                <button type="submit" className="terminal-btn terminal-btn-primary" disabled={loading}>
                  {loading ? "Saving..." : "SAVE"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
