"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertTriangle, ChevronDown, LogOut, Wallet } from "lucide-react";

/**
 * RainbowKit's wallet modal behind the app's own terminal-styled controls.
 *
 * Using `ConnectButton.Custom` keeps the visual language unchanged while the
 * modal, wallet list and account view all come from RainbowKit.
 */

export default function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <div
              {...(!ready && {
                "aria-hidden": true,
                style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
              })}
            >
              <button
                type="button"
                onClick={openConnectModal}
                className="terminal-btn terminal-btn-primary"
              >
                <Wallet size={16} aria-hidden="true" />
                <span>Connect Wallet</span>
              </button>
            </div>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="terminal-btn border-[var(--terminal-red)] text-[var(--terminal-red)] bg-white/95"
            >
              <AlertTriangle size={15} aria-hidden="true" />
              <span>Wrong Network</span>
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChainModal}
              className="terminal-btn terminal-btn-secondary px-3 py-2"
              aria-label="切换网络"
            >
              <span
                className="w-2.5 h-2.5 rounded-full bg-[var(--terminal-green)]"
                aria-hidden="true"
              />
              <span className="text-[12px] font-medium tracking-[0.01em] text-[var(--terminal-text)]">
                {chain.name ?? "未知网络"}
              </span>
              <ChevronDown
                size={14}
                className="text-[var(--terminal-text-secondary)]"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={openAccountModal}
              className="flex items-center gap-2 rounded-xl border border-[var(--terminal-separator)] bg-white/96 px-3 py-2 hover:bg-[var(--terminal-fill)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
              aria-label="钱包账户"
            >
              <span className="text-[12px] font-mono font-normal tracking-[0.01em] text-[var(--terminal-text)]">
                {account.displayName}
              </span>
              {account.displayBalance && (
                <span className="text-[11px] text-[var(--terminal-text-secondary)]">
                  {account.displayBalance}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={openAccountModal}
              className="w-9 h-9 border border-[var(--terminal-separator)] flex items-center justify-center rounded-xl bg-white/96 hover:bg-[var(--terminal-fill)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] focus-visible:outline-offset-2"
              aria-label="钱包详情或断开连接"
            >
              <LogOut size={15} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
