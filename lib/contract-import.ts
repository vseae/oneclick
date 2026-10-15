import type { InterfaceAbi } from "ethers";
import type { UpsertContractInput } from "@/lib/local-store";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

interface ParseContractImportOptions {
  defaultChainId: number;
  sourceName?: string;
}

interface ContractImportSource {
  name: string;
  text: () => Promise<string>;
}

interface ParseContractImportSourcesResult {
  contracts: UpsertContractInput[];
  errors: string[];
}

interface ContractImportLike {
  name?: unknown;
  contractName?: unknown;
  address?: unknown;
  chainId?: unknown;
  abi?: unknown;
}

function parseChainId(value: unknown, defaultChainId: number): number {
  const raw = typeof value === "undefined" || value === null || value === "" ? defaultChainId : value;
  const chainId = Number(raw);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("链 ID 必须是正整数");
  }
  return chainId;
}

function parseAbi(value: unknown): InterfaceAbi {
  const abi = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(abi)) {
    throw new Error("ABI 必须是 JSON 数组");
  }
  return abi as InterfaceAbi;
}

function getName(item: ContractImportLike, sourceName?: string): string {
  const name = item.name ?? item.contractName;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  const fallback = sourceName?.replace(/\.json$/i, "").trim();
  if (fallback) {
    return fallback;
  }

  throw new Error("合约名称不能为空");
}

function normalizeItem(
  item: ContractImportLike,
  options: ParseContractImportOptions
): UpsertContractInput {
  if (!item || typeof item !== "object") {
    throw new Error("合约条目必须是对象");
  }

  if (typeof item.address !== "string" || !ADDRESS_PATTERN.test(item.address.trim())) {
    throw new Error("无效的合约地址");
  }

  return {
    name: getName(item, options.sourceName),
    address: item.address.trim(),
    chainId: parseChainId(item.chainId, options.defaultChainId),
    abi: parseAbi(item.abi),
  };
}

export function parseContractImportPayload(
  payload: unknown,
  options: ParseContractImportOptions
): UpsertContractInput[] {
  if (!Number.isSafeInteger(options.defaultChainId) || options.defaultChainId <= 0) {
    throw new Error("当前钱包网络无效，无法导入合约");
  }

  const items = Array.isArray(payload) ? payload : [payload];
  return items.map((item) => normalizeItem(item as ContractImportLike, options));
}

export async function parseContractImportSources(
  sources: ContractImportSource[],
  options: Omit<ParseContractImportOptions, "sourceName">
): Promise<ParseContractImportSourcesResult> {
  const contracts: UpsertContractInput[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const payload = JSON.parse(await source.text());
      contracts.push(...parseContractImportPayload(payload, {
        ...options,
        sourceName: source.name,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析失败";
      errors.push(`${source.name}: ${message}`);
    }
  }

  return { contracts, errors };
}
