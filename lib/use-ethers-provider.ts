"use client";

import { useMemo } from "react";
import { ethers } from "ethers";
import { useWalletClient } from "wagmi";

/**
 * The ethers.js view of the active wagmi wallet client.
 *
 * Contract calls in this app are written against ethers, but the wallet can now
 * come from any RainbowKit connector. `window.ethereum` only exists for injected
 * browser wallets, so the EIP-1193 provider is derived from the active wallet
 * client's transport instead — that works for WalletConnect, mobile and injected
 * wallets alike.
 *
 * Returns `null` while no wallet is connected; callers should surface their own
 * "请先连接钱包" message rather than assuming a provider exists.
 */
export function useEthersProvider(): ethers.BrowserProvider | null {
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!walletClient) return null;

    const eip1193 = {
      request: (payload: { method: string; params?: unknown[] }) =>
        walletClient.transport.request(payload as never),
      // ethers only requires `request`; these silence optional event wiring.
      on: () => undefined,
      removeListener: () => undefined,
    } as unknown as ethers.Eip1193Provider;

    return new ethers.BrowserProvider(eip1193, undefined, {
      staticNetwork: true,
    });
  }, [walletClient]);
}
