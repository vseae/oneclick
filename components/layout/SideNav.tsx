"use client";

import { useMemo, useState } from "react";
import { BookOpenText, Plug, Search } from "lucide-react";
import type { InterfaceAbi } from "ethers";
import { useHydrated } from "@/lib/use-hydrated";

interface ContractRecord {
  id: number;
  name: string;
  address: string;
  chainId: number;
  abi: InterfaceAbi;
}

interface SideNavProps {
  contracts: ContractRecord[];
  currentChainId?: number;
  openContractIds: Set<number>;
  onToggleContract: (contract: ContractRecord) => void;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function SideNav({ contracts, currentChainId, openContractIds, onToggleContract }: SideNavProps) {
  const hydrated = useHydrated();
  const [search, setSearch] = useState("");
  const visibleChainId = hydrated ? currentChainId : undefined;
  const filteredContracts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contracts;
    return contracts.filter((contract) =>
      contract.name.toLowerCase().includes(query) ||
      contract.address.toLowerCase().includes(query)
    );
  }, [contracts, search]);

  return (
    <aside className="terminal-sidebar" aria-label="当前网络合约信息">
      <div className="border-b border-[var(--terminal-separator)] bg-white/90 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--terminal-blue)]/20 bg-[var(--terminal-blue)]/10 text-[var(--terminal-blue)]">
            <BookOpenText size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium tracking-[0.01em] text-[var(--terminal-blue)]">
              CONTRACTS
            </p>
            <p className="truncate text-[11px] text-[var(--terminal-text-secondary)]">
              {visibleChainId ? `Chain ${visibleChainId}` : "未连接钱包"}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--terminal-separator)] bg-white/70 p-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--terminal-text-secondary)]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="terminal-input h-10 pl-9 pr-3 text-[13px]"
            placeholder="搜索合约名称或地址..."
            aria-label="搜索左侧合约列表"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {contracts.length === 0 ? (
          <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-card)] px-3 py-4 text-[12px] leading-relaxed text-[var(--terminal-text-secondary)]">
            {visibleChainId ? "当前网络暂无已导入合约" : "连接钱包后显示对应网络合约"}
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-card)] px-3 py-4 text-[12px] leading-relaxed text-[var(--terminal-text-secondary)]">
            未找到匹配的合约
          </div>
        ) : (
          filteredContracts.map((contract) => {
            const isOpen = openContractIds.has(contract.id);
            return (
              <button
                key={contract.id}
                type="button"
                onClick={() => onToggleContract(contract)}
                className={`w-full border px-3 py-2.5 text-left transition-colors hover:bg-[var(--terminal-hover)] focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                  isOpen
                    ? "border-[var(--terminal-blue)] bg-[var(--terminal-blue)]/5"
                    : "border-[var(--terminal-separator)] bg-[var(--terminal-card)]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-medium tracking-[0.01em] text-[var(--terminal-text)]">
                    {contract.name}
                  </span>
                  <Plug size={13} className={isOpen ? "text-[var(--terminal-green)]" : "text-[var(--terminal-text-secondary)]"} aria-hidden="true" />
                </div>
                <p className="font-mono text-[11px] text-[var(--terminal-text-secondary)]">{shortAddress(contract.address)}</p>
                <p className="mt-1 text-[10px] tracking-[0.06em] text-[var(--terminal-text-secondary)]">
                  ABI: {Array.isArray(contract.abi) ? contract.abi.length : 0}
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
