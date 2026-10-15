"use client";

import { useMemo } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { AlertTriangle, ChevronDown, LogOut, Wallet, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseSwitchError(error: Error): string {
  const msg = error.message ?? "";
  if (msg.includes("rejected") || msg.includes("denied")) {
    return "用户拒绝了切换网络请求";
  }
  if (msg.includes("4902")) {
    return "钱包中未添加该网络，请先在钱包中添加后重试";
  }
  return `切换网络失败: ${error.message}`;
}

export default function CustomConnectButton() {
  const { address, chain, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect({
    mutation: {
      onError(error) {
        const msg = error.message ?? "";
        if (msg.includes("rejected") || msg.includes("denied")) {
          toast.error("用户拒绝了连接请求");
        } else if (msg.includes("already pending")) {
          toast.error("MetaMask 中已有待处理的请求，请检查钱包弹窗");
        } else {
          toast.error(`钱包连接失败: ${error.message}`);
        }
      },
    },
  });
  const { disconnect } = useDisconnect();
  const { chains, switchChain, isPending: isSwitching } = useSwitchChain({
    mutation: {
      onError(error) {
        toast.error(parseSwitchError(error));
      },
    },
  });

  const primaryConnector = useMemo(
    () => connectors.find((connector) => connector.type === "injected") ?? connectors[0],
    [connectors]
  );
  const isSupportedChain = useMemo(
    () => (chain ? chains.some((supportedChain) => supportedChain.id === chain.id) : false),
    [chain, chains]
  );

  if (!isConnected || !address || !chain) {
    return (
      <button
        type="button"
        onClick={() => primaryConnector && connect({ connector: primaryConnector })}
        className="terminal-btn terminal-btn-primary"
        disabled={!primaryConnector || isPending}
      >
        <Wallet size={16} aria-hidden="true" />
        <span>{isPending ? "Connecting..." : "Connect Wallet"}</span>
      </button>
    );
  }

  if (!isSupportedChain) {
    const fallbackChain = chains[0];
    return (
      <button
        type="button"
        onClick={() => fallbackChain && switchChain({ chainId: fallbackChain.id })}
        className="terminal-btn border-[var(--terminal-red)] text-[var(--terminal-red)] bg-white/95"
        disabled={!fallbackChain || isSwitching}
      >
        <AlertTriangle size={15} aria-hidden="true" />
        <span>{isSwitching ? "Switching..." : "Wrong Network"}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
              className="terminal-btn terminal-btn-secondary px-3 py-2"
                aria-label="切换网络"
                disabled={isSwitching}
              />
            }
          >
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--terminal-green)]" aria-hidden="true" />
          <span className="text-[12px] font-medium tracking-[0.01em] text-[var(--terminal-text)]">
            {chain.name}
          </span>
          <ChevronDown size={14} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-[220px] border border-[var(--terminal-separator)] bg-white/98 p-1"
        >
          {chains.map((item) => {
            const active = item.id === chain.id;
            return (
              <DropdownMenuItem
                key={item.id}
                onClick={() => {
                if (active || isSwitching) {
                    return;
                  }
                  switchChain({ chainId: item.id });
                }}
                className="flex items-center justify-between rounded-xl px-2.5 py-2 text-[12px] font-normal text-[var(--terminal-text)] data-disabled:opacity-40"
                disabled={isSwitching}
              >
                <span className="truncate">{item.name}</span>
                {active ? (
                  <Check size={13} className="text-[var(--terminal-green)]" aria-hidden="true" />
                ) : (
                  <span className="text-[11px] text-[var(--terminal-text-secondary)]">#{item.id}</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--terminal-separator)] bg-white/96 px-3 py-2">
        <span className="text-[12px] font-mono font-normal tracking-[0.01em] text-[var(--terminal-text)]">
          {shortenAddress(address)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => disconnect()}
        className="w-9 h-9 border border-[var(--terminal-separator)] flex items-center justify-center rounded-xl bg-white/96 hover:bg-[var(--terminal-fill)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] focus-visible:outline-offset-2"
        aria-label="Disconnect wallet"
      >
        <LogOut size={15} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
      </button>
    </div>
  );
}
