"use client";

import { useState, useCallback, memo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { Dot, Plug, Radio } from "lucide-react";
import Header from "@/components/layout/Header";
import SideNav from "@/components/layout/SideNav";
import type { ContractRecord } from "@/components/layout/SideNav";

const ContractInteractView = dynamic(() => import("@/components/interact/ContractInteractView"), { ssr: false });
const HistoryView = dynamic(() => import("@/components/history/HistoryView"), { ssr: false });

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
  const [currentContract, setCurrentContract] = useState<ContractRecord | null>(null);
  const [panelContracts, setPanelContracts] = useState<Record<number, ContractRecord>>({});
  const [historyVersion, setHistoryVersion] = useState(0);

  const handleHistoryUpdate = useCallback(() => {
    setHistoryVersion(v => v + 1);
  }, []);

  const handleSelectContract = useCallback((contract: ContractRecord) => {
    setPanelContracts((current) => ({ ...current, [contract.id]: contract }));
    setCurrentContract(contract);
  }, []);

  const handleDeleteContract = useCallback((id: number) => {
    setPanelContracts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setCurrentContract((current) => current?.id === id ? null : current);
  }, []);

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setCurrentContract(null);
      setPanelContracts({});
    }, 0);
    return () => window.clearTimeout(reset);
  }, [chainId]);

  const visibleCurrentContract = currentContract && currentContract.chainId === chainId ? currentContract : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--terminal-bg)] text-[var(--terminal-text)]">
      <Header />
      <SideNav
        currentChainId={chainId}
        currentContractId={visibleCurrentContract?.id ?? null}
        onSelectContract={handleSelectContract}
        onDeleteContract={handleDeleteContract}
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
                {visibleCurrentContract ? Object.values(panelContracts).map((contract) => (
                  <div key={contract.id} className={contract.id === visibleCurrentContract.id ? "" : "hidden"} aria-hidden={contract.id !== visibleCurrentContract.id}>
                    <ContractInteractView
                      contract={contract}
                      onClose={() => setCurrentContract(null)}
                      onHistoryUpdate={handleHistoryUpdate}
                    />
                  </div>
                )) : (
                  <EmptyState
                    icon={<Plug size={24} className="text-[var(--terminal-text-secondary)]" />}
                    title="Select Contract"
                    subtitle="请从左侧合约列表选择一个合约以打开交互面板"
                  />
                )}
              </div>
              <div className="min-w-0"><HistoryView refreshKey={historyVersion} /></div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
