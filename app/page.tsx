"use client";

import { useState, useCallback, memo, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { Dot, Plug, Radio } from "lucide-react";
import Header from "@/components/layout/Header";
import SideNav from "@/components/layout/SideNav";
import ContractTable from "@/components/contracts/ContractTable";

interface ContractRecord {
  id: number;
  name: string;
  address: string;
  chainId: number;
  abi: import("ethers").InterfaceAbi;
}

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
  const [openContracts, setOpenContracts] = useState<ContractRecord[]>([]);
  const [currentContracts, setCurrentContracts] = useState<ContractRecord[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const handleHistoryUpdate = useCallback(() => {
    setHistoryVersion(v => v + 1);
  }, []);

  const handleSelectContract = useCallback((c: ContractRecord) => {
    setOpenContracts(prev => {
      const exists = prev.some(item => item.id === c.id);
      if (exists) return prev;
      return [...prev, c];
    });
  }, []);

  const handleCloseContract = useCallback((id: number) => {
    setOpenContracts(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleToggleContract = useCallback((c: ContractRecord) => {
    setOpenContracts(prev => {
      const exists = prev.some(item => item.id === c.id);
      if (exists) return prev.filter(item => item.id !== c.id);
      return [...prev, c];
    });
  }, []);

  const visibleOpenContracts = useMemo(
    () => openContracts.filter(contract => chainId && contract.chainId === chainId),
    [openContracts, chainId]
  );
  const openContractIds = useMemo(() => new Set(visibleOpenContracts.map(c => c.id)), [visibleOpenContracts]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--terminal-bg)] text-[var(--terminal-text)]">
      <Header />
      <SideNav
        contracts={currentContracts}
        currentChainId={chainId}
        openContractIds={openContractIds}
        onToggleContract={handleToggleContract}
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
            <>
              <ContractTable
                onSelectContract={handleSelectContract}
                openContractIds={openContractIds}
                onToggleContract={handleToggleContract}
                onContractsChange={setCurrentContracts}
              />

              <div className="terminal-main-grid">
                <div className="min-w-0 space-y-2">
                  {visibleOpenContracts.length === 0 ? (
                    <EmptyState
                      icon={<Plug size={24} className="text-[var(--terminal-text-secondary)]" />}
                      title="Select Contract"
                      subtitle="请在上方列表中点击合约以打开执行面板"
                    />
                  ) : (
                    visibleOpenContracts.map(c => (
                      <ContractInteractView
                        key={c.id}
                        contract={c}
                        onClose={() => handleCloseContract(c.id)}
                        onHistoryUpdate={handleHistoryUpdate}
                      />
                    ))
                  )}
                </div>
                <div className="min-w-0">
                  <HistoryView refreshKey={historyVersion} />
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="border-t border-[var(--terminal-separator)] bg-[var(--terminal-card)] px-4 py-2 text-[11px] tracking-[0.01em] text-[var(--terminal-text-secondary)]">
          SYSTEM_HEALTH: <span className="text-[var(--terminal-green)]">100% // NO_ERRORS_DETECTED</span>
        </footer>
      </main>
    </div>
  );
}
