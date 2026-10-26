"use client";

import { useState, useCallback, useEffect, useMemo, memo } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dot, Plug, Radio } from "lucide-react";
import Header from "@/components/layout/Header";
import SideNav from "@/components/layout/SideNav";
import { contractKeys, historyKeys, useContracts } from "@/lib/queries";
import type { ContractRecord } from "@/lib/types";

const ContractInteractView = dynamic(() => import("@/components/interact/ContractInteractView"), { ssr: false });
const HistoryView = dynamic(() => import("@/components/history/HistoryView"), { ssr: false });

/** Keep a bounded number of panels mounted so switching contracts preserves in-session state. */
const MAX_OPEN_PANELS = 8;

const EmptyState = memo(function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="terminal-card bg-[var(--terminal-card)]">
      <div className="flex flex-col items-center justify-center py-14">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--terminal-separator)] bg-[var(--terminal-fill)]">
          {icon}
        </div>
        <h3 className="mb-1 text-[14px] font-medium tracking-[0.01em] text-[var(--terminal-text)]">{title}</h3>
        <p className="text-[12px] font-normal text-[var(--terminal-text-secondary)]">{subtitle}</p>
      </div>
    </div>
  );
});

export default function Home() {
  const { isConnected, chainId } = useAccount();
  const queryClient = useQueryClient();
  const { data: contracts = [], error: contractsError, isPending: contractsPending } = useContracts(chainId);

  const [currentContractId, setCurrentContractId] = useState<number | null>(null);
  const [openPanelIds, setOpenPanelIds] = useState<number[]>([]);

  useEffect(() => {
    if (contractsError) {
      toast.error("获取合约失败");
    }
  }, [contractsError]);

  const contractById = useMemo(
    () => new Map(contracts.map((contract) => [contract.id, contract])),
    [contracts]
  );

  // The panel always reads the latest catalog entry, so edits/imports are reflected
  // without duplicating contract snapshots in page state.
  const visibleCurrentContract = currentContractId === null
    ? null
    : contractById.get(currentContractId) ?? null;

  const visiblePanelIds = useMemo(
    () => openPanelIds.filter((id) => contractById.has(id)),
    [openPanelIds, contractById]
  );

  const handleSelectContract = useCallback((contract: ContractRecord) => {
    setOpenPanelIds((current) => {
      const next = current.filter((id) => id !== contract.id);
      next.push(contract.id);
      return next.slice(-MAX_OPEN_PANELS);
    });
    setCurrentContractId(contract.id);
  }, []);

  const handleClosePanel = useCallback(() => {
    setCurrentContractId(null);
  }, []);

  const handleDeleteContract = useCallback((id: number) => {
    queryClient.setQueryData<ContractRecord[]>(
      contractKeys.byChain(chainId),
      (current) => current?.filter((contract) => contract.id !== id)
    );
    setOpenPanelIds((current) => current.filter((panelId) => panelId !== id));
    setCurrentContractId((current) => (current === id ? null : current));
    void queryClient.invalidateQueries({ queryKey: historyKeys.byChain(chainId) });
  }, [queryClient, chainId]);

  const handleCatalogChanged = useCallback(async () => {
    // Editing/upserting a contract also syncs the denormalized name/address on
    // its System Log rows, so refresh both queries together.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: contractKeys.byChain(chainId) }),
      queryClient.invalidateQueries({ queryKey: historyKeys.byChain(chainId) }),
    ]);
  }, [queryClient, chainId]);

  const handleHistoryUpdate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: historyKeys.byChain(chainId) });
  }, [queryClient, chainId]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--terminal-bg)] text-[var(--terminal-text)]">
      <Header />
      <SideNav
        contracts={contracts}
        currentChainId={chainId}
        currentContractId={visibleCurrentContract?.id ?? null}
        isLoading={contractsPending && typeof chainId === "number"}
        hasError={Boolean(contractsError)}
        onSelectContract={handleSelectContract}
        onDeleteContract={handleDeleteContract}
        onCatalogChanged={handleCatalogChanged}
      />

      <main className="min-w-0 pt-14 md:pl-64">
        <div className="space-y-2 p-2 md:p-3">
          <section className="terminal-card bg-[var(--terminal-card)] px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="terminal-section-title">
                <Radio size={14} aria-hidden="true" />
                <span>Execution Environment</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[var(--terminal-text-secondary)]">
                <span className="inline-flex items-center gap-1 tracking-[0.01em]">
                  <Dot size={18} className="text-[var(--terminal-green)]" />
                  Live
                </span>
                <span className="terminal-chip">Target: Smart Contracts</span>
              </div>
            </div>
          </section>

          {!isConnected ? (
            <EmptyState
              icon={<Plug size={24} className="text-[var(--terminal-text-secondary)]" />}
              title="Connect Wallet"
              subtitle="请连接钱包后加载合约面板与历史记录"
            />
          ) : (
            <div className="terminal-main-grid">
              <div className="min-w-0">
                {visiblePanelIds.map((id) => {
                  const contract = contractById.get(id);
                  if (!contract) return null;
                  const isCurrent = visibleCurrentContract?.id === id;
                  return (
                    <div key={id} className={isCurrent ? "" : "hidden"} aria-hidden={!isCurrent}>
                      <ContractInteractView
                        contract={contract}
                        onClose={handleClosePanel}
                        onHistoryUpdate={handleHistoryUpdate}
                      />
                    </div>
                  );
                })}
                {!visibleCurrentContract && (
                  <EmptyState
                    icon={<Plug size={24} className="text-[var(--terminal-text-secondary)]" />}
                    title="Select Contract"
                    subtitle="请从左侧合约列表选择一个合约以打开交互面板"
                  />
                )}
              </div>
              <div className="min-w-0"><HistoryView /></div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
