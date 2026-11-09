"use client";

import { useMemo } from "react";
import { createPublicClient, custom } from "viem";
import { useWalletClient } from "wagmi";

/** Use the connected wallet transport for reads as well as writes. */
export function useWalletClients() {
  const { data: walletClient } = useWalletClient();
  const publicClient = useMemo(() => walletClient ? createPublicClient({
    chain: walletClient.chain,
    transport: custom(walletClient.transport),
  }) : null, [walletClient]);
  return { walletClient: walletClient ?? null, publicClient };
}
