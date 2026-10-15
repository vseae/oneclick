"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useSpring, animated } from "react-spring";
import { Plus, X } from "lucide-react";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { parseContractImportPayload } from "@/lib/contract-import";
import { upsertContract } from "@/lib/local-store";

const formSchema = z.object({
  name: z.string().min(1, "请输入合约名称"),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "无效的地址格式"),
  abi: z.string().min(1, "请输入 ABI"),
  chainId: z.string().optional(),
});

interface ContractFormProps {
  onSuccess: () => void;
  defaultChainId?: number;
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

export default function ContractForm({ onSuccess, defaultChainId }: ContractFormProps) {
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

  const modalSpring = useSpring({
    opacity: open ? 1 : 0,
    transform: open ? "translateY(0px) scale(1)" : "translateY(8px) scale(0.98)",
    config: { tension: 300, friction: 26 },
  });

  const resolveChainId = (value?: string) => parseStrictChainId(value || defaultChainId);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const parsedAbi = JSON.parse(values.abi);
      const { updated } = await upsertContract({
        name: values.name.trim(),
        address: values.address.trim(),
        chainId: resolveChainId(values.chainId),
        abi: parsedAbi,
      });
      toast.success(updated ? "合约已更新" : "合约添加成功");
      setOpen(false);
      form.reset({ name: "", address: "", abi: "", chainId: defaultChainId ? String(defaultChainId) : "" });
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败");
    } finally {
      setLoading(false);
    }
  };

  const onBatchSubmit = async () => {
    setLoading(true);
    try {
      const contracts = parseContractImportPayload(JSON.parse(batchJson), {
        defaultChainId: resolveChainId(),
        sourceName: "batch-json",
      });

      let success = 0;
      for (const contract of contracts) {
        try {
          await upsertContract(contract);
          success += 1;
        } catch (error) {
          console.error("添加失败:", contract.name, error);
        }
      }

      toast.success(`成功添加 ${success}/${contracts.length} 个合约`);
      setOpen(false);
      setBatchJson("");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量添加失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button className="terminal-btn terminal-btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        <span>ADD_CONTRACT</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-contract-title"
          >
          <animated.div
            style={{ ...modalSpring, overscrollBehavior: "contain" }}
            className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto terminal-card bg-[var(--terminal-card)] shadow-[0_24px_80px_rgba(21,45,86,0.22)]"
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--terminal-separator)]">
              <div className="flex items-center gap-3">
                <h3 id="add-contract-title" className="text-[14px] font-medium tracking-[0.01em]">[ADD_CONTRACT]</h3>
                <button
                  type="button"
                  onClick={() => setBatchMode(!batchMode)}
                  className="text-[12px] text-[var(--terminal-blue)] hover:underline cursor-pointer"
                >
                  {batchMode ? "SINGLE_MODE" : "BATCH_MODE"}
                </button>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] hover:bg-[var(--terminal-separator)] flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
                aria-label="关闭"
              >
                <X size={14} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
              </button>
            </div>

            {batchMode ? (
              <div className="p-5 space-y-4">
                <div>
                  <label htmlFor="batch-json" className="block text-[13px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                    批量合约 JSON
                  </label>
                  <textarea
                    id="batch-json"
                    value={batchJson}
                    onChange={(event) => setBatchJson(event.target.value)}
                    className="terminal-input font-mono text-[13px] resize-none"
                    rows={12}
                    placeholder='[{"name":"USDT","address":"0x...","abi":[...]},{"contractName":"Vault","address":"0x...","abi":[...]}]'
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-[var(--terminal-text-secondary)] mt-1">
                    支持数组或单个对象；chainId 缺省时使用当前钱包网络。
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="terminal-btn terminal-btn-secondary" onClick={() => setOpen(false)}>
                    取消
                  </button>
                  <button type="button" className="terminal-btn terminal-btn-primary" onClick={onBatchSubmit} disabled={loading}>
                    {loading ? "Importing..." : "IMPORT_BATCH"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
                <div>
                  <label htmlFor="contract-name" className="block text-[13px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                    合约名称
                  </label>
                  <input {...form.register("name")} id="contract-name" className="terminal-input" placeholder="例如: USDT…" autoComplete="off" />
                  {form.formState.errors.name && (
                    <p className="text-[12px] text-[var(--terminal-red)] mt-1" role="alert">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contract-address" className="block text-[13px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                    合约地址
                  </label>
                  <input {...form.register("address")} id="contract-address" className="terminal-input font-mono" placeholder="0x…" autoComplete="off" spellCheck={false} />
                  {form.formState.errors.address && (
                    <p className="text-[12px] text-[var(--terminal-red)] mt-1" role="alert">{form.formState.errors.address.message}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="contract-chainId" className="text-[13px] font-medium text-[var(--terminal-text-secondary)]">
                      链 ID
                    </label>
                    <button
                      type="button"
                      onClick={() => setUseCustomChain(!useCustomChain)}
                      className="text-[12px] text-[var(--terminal-blue)] hover:underline cursor-pointer"
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
                    <p className="text-[12px] text-[var(--terminal-red)] mt-1" role="alert">{form.formState.errors.chainId.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contract-abi" className="block text-[13px] font-medium text-[var(--terminal-text-secondary)] mb-1.5">
                    ABI (JSON)
                  </label>
                  <textarea
                    {...form.register("abi")}
                    id="contract-abi"
                    className="terminal-input font-mono text-[13px] resize-none"
                    rows={6}
                    placeholder='[{"inputs":[],"name":"totalSupply","type":"function"}]'
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {form.formState.errors.abi && (
                    <p className="text-[12px] text-[var(--terminal-red)] mt-1" role="alert">{form.formState.errors.abi.message}</p>
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
          </animated.div>
          </div>
        </>
      )}
    </div>
  );
}
