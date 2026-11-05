"use client";

import type { InterfaceAbi } from "ethers";
import type { ContractDirectoryRecord, MoveContractInput } from "@/lib/types";

export interface LocalContractRecord {
  id: number;
  name: string;
  address: string;
  chainId: number;
  abi: InterfaceAbi;
  createdAt: string;
  addressChainKey: string;
  directoryId: number | null;
}

export interface LocalHistoryRecord {
  id: number;
  contractId: number;
  contractName: string;
  contractAddress: string;
  methodName: string;
  methodType: "read" | "write";
  params: unknown[];
  result?: string;
  error?: string;
  txHash?: string;
  /** Decimal wei string attached to a payable write. */
  value?: string;
  timestamp: string;
  chainId: number;
}

export interface UpsertContractInput {
  name: string;
  address: string;
  chainId: number;
  abi: InterfaceAbi;
}

export interface UpdateContractInput {
  name?: string;
  address?: string;
  chainId?: number;
  abi?: InterfaceAbi;
}

export interface AddHistoryInput {
  contractId: number;
  contractName: string;
  contractAddress: string;
  methodName: string;
  methodType: "read" | "write";
  params: unknown[];
  result?: string;
  error?: string;
  txHash?: string;
  /** Decimal wei string attached to a payable write. */
  value?: string;
  chainId: number;
  timestamp?: string;
}

export interface LocalDataSnapshot {
  schemaVersion: number;
  exportedAt: string;
  directories?: ContractDirectoryRecord[];
  contracts: Array<{
    id?: number;
    name: string;
    address: string;
    chainId: number;
    abi: InterfaceAbi;
    createdAt?: string;
    directoryId?: number | null;
  }>;
  history: Array<{
    id?: number;
    contractId: number;
    contractName: string;
    contractAddress: string;
    methodName: string;
    methodType: "read" | "write";
    params: unknown[];
    result?: string;
    error?: string;
    txHash?: string;
    /** Decimal wei string attached to a payable write. */
    value?: string;
    timestamp?: string;
    chainId: number;
  }>;
}

export interface ImportLocalDataResult {
  contractsImported: number;
  historyImported: number;
  historySkipped: number;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== "undefined") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }
  return payload.data as T;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return readResponse<T>(response);
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  return typeof body === "undefined"
    ? { method }
    : {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
}

export async function listContracts(): Promise<LocalContractRecord[]> {
  return fetchJson("/api/contracts", jsonRequest("GET"));
}

export async function listContractsByChainId(chainId: number): Promise<LocalContractRecord[]> {
  return fetchJson(`/api/contracts${buildQuery({ chainId })}`, jsonRequest("GET"));
}

export async function getContractById(id: number): Promise<LocalContractRecord | null> {
  return fetchJson(`/api/contracts/${id}`, jsonRequest("GET"));
}

export async function upsertContract(input: UpsertContractInput): Promise<{ id: number; updated: boolean }> {
  return fetchJson("/api/contracts", jsonRequest("POST", input));
}

export async function upsertContractsBatch(
  contracts: UpsertContractInput[]
): Promise<Array<{ id?: number; name: string; success: boolean; updated?: boolean; error?: string }>> {
  return fetchJson("/api/contracts/batch", jsonRequest("POST", { contracts }));
}

export async function deleteContract(id: number): Promise<void> {
  await fetchJson<null>(`/api/contracts/${id}`, jsonRequest("DELETE"));
}

export async function deleteContracts(ids: number[], chainId: number): Promise<void> {
  await fetchJson<null>("/api/contracts/batch", jsonRequest("DELETE", { ids, chainId }));
}

export async function updateContractById(id: number, updates: UpdateContractInput): Promise<void> {
  await fetchJson<null>(`/api/contracts/${id}`, jsonRequest("PATCH", updates));
}

export async function listDirectoriesByChainId(chainId: number): Promise<ContractDirectoryRecord[]> {
  return fetchJson(`/api/directories${buildQuery({ chainId })}`, jsonRequest("GET"));
}

export async function createDirectory(input: { name: string; chainId: number }): Promise<ContractDirectoryRecord> {
  return fetchJson("/api/directories", jsonRequest("POST", input));
}

export async function renameDirectory(id: number, name: string): Promise<void> {
  await fetchJson<null>(`/api/directories/${id}`, jsonRequest("PATCH", { name }));
}

export async function deleteDirectory(id: number): Promise<void> {
  await fetchJson<null>(`/api/directories/${id}`, jsonRequest("DELETE"));
}

export async function moveContractToDirectory(id: number, input: MoveContractInput): Promise<LocalContractRecord> {
  return fetchJson(`/api/contracts/${id}/directory`, jsonRequest("PATCH", input));
}

export async function moveContractsToDirectory(ids: number[], chainId: number, input: MoveContractInput): Promise<LocalContractRecord[]> {
  return fetchJson("/api/contracts/batch", jsonRequest("PATCH", { ids, chainId, ...input }));
}

export async function addHistory(input: AddHistoryInput): Promise<number> {
  const result = await fetchJson<{ id: number }>("/api/history", jsonRequest("POST", input));
  return result.id;
}

export async function updateHistory(
  id: number,
  updates: Pick<LocalHistoryRecord, "result" | "error" | "txHash">
): Promise<void> {
  await fetchJson<null>(`/api/history/${id}`, jsonRequest("PATCH", updates));
}

export async function listHistory(options?: {
  contractId?: number;
  chainId?: number;
  limit?: number;
}): Promise<LocalHistoryRecord[]> {
  return fetchJson(
    `/api/history${buildQuery({
      contractId: options?.contractId,
      chainId: options?.chainId,
      limit: options?.limit,
    })}`,
    jsonRequest("GET")
  );
}

export async function clearHistory(contractId?: number, chainId?: number): Promise<void> {
  await fetchJson<null>(`/api/history${buildQuery({ contractId, chainId })}`, jsonRequest("DELETE"));
}

export async function clearAllLocalData(): Promise<void> {
  await fetchJson<null>("/api/local-data", jsonRequest("DELETE"));
}

export async function exportLocalData(): Promise<LocalDataSnapshot> {
  return fetchJson("/api/local-data", jsonRequest("GET"));
}

export async function importLocalData(snapshot: LocalDataSnapshot): Promise<ImportLocalDataResult> {
  return fetchJson("/api/local-data", jsonRequest("POST", snapshot));
}
