"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listContractsByChainId,
  listDirectoriesByChainId,
  listHistory,
  type LocalHistoryRecord,
} from "@/lib/local-store";
import type { ContractDirectoryRecord, ContractRecord } from "@/lib/types";

export const contractKeys = {
  byChain: (chainId?: number) => ["contracts", chainId] as const,
};

export const historyKeys = {
  byChain: (chainId?: number) => ["history", chainId] as const,
};

export const directoryKeys = {
  byChain: (chainId?: number) => ["directories", chainId] as const,
};

export function useDirectories(chainId?: number) {
  return useQuery<ContractDirectoryRecord[]>({
    queryKey: directoryKeys.byChain(chainId),
    queryFn: () => listDirectoriesByChainId(chainId as number),
    enabled: typeof chainId === "number",
    staleTime: 30_000,
  });
}

export function useContracts(chainId?: number) {
  return useQuery<ContractRecord[]>({
    queryKey: contractKeys.byChain(chainId),
    queryFn: () => listContractsByChainId(chainId as number),
    enabled: typeof chainId === "number",
    staleTime: 30_000,
  });
}

export function useHistory(chainId?: number) {
  return useQuery<LocalHistoryRecord[]>({
    queryKey: historyKeys.byChain(chainId),
    queryFn: () => listHistory({ chainId: chainId as number }),
    enabled: typeof chainId === "number",
    staleTime: 10_000,
  });
}
