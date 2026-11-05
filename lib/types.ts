import type { InterfaceAbi } from "ethers";

/** The minimal contract shape used by the catalog, interaction panel and history views. */
export interface ContractRecord {
  id: number;
  name: string;
  address: string;
  chainId: number;
  abi: InterfaceAbi;
  createdAt?: string;
  directoryId?: number | null;
}

export interface ContractDirectoryRecord {
  id: number;
  name: string;
  chainId: number;
}

export type MoveContractInput =
  | { directoryId: number | null }
  | { newDirectoryName: string };
