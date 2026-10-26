import type { InterfaceAbi } from "ethers";
import type { UpsertContractInput } from "@/lib/local-store";
import { contractAbiSchema, contractAddressSchema } from "@/lib/contract-validation";

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
  let abi = value;
  if (typeof value === "string") {
    try {
      abi = JSON.parse(value);
    } catch {
      throw new Error("ABI 必须是合法的 JSON");
    }
  }
  const result = contractAbiSchema.safeParse(abi);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "ABI 无效");
  }
  return result.data;
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

  if (typeof item.address !== "string") {
    throw new Error("无效的合约地址");
  }
  const address = contractAddressSchema.safeParse(item.address);
  if (!address.success) {
    throw new Error(address.error.issues[0]?.message ?? "无效的合约地址");
  }

  return {
    name: getName(item, options.sourceName),
    address: address.data,
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
      let payload: unknown;
      try {
        payload = JSON.parse(await source.text());
      } catch {
        throw new Error("JSON 格式错误");
      }
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
