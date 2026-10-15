import { Interface } from "ethers";
import { listContractsByChainId } from "./local-store";

export type SignatureKind = "function" | "event";
export type SignatureSource = "local" | "4byte" | "sourcify";

export interface NormalizedSignature {
  kind: SignatureKind;
  hex: string;
}

export interface SignatureCandidate {
  name: string;
  source: SignatureSource;
  extra?: string;
}

export interface SignatureLookupError {
  source: SignatureSource;
  message: string;
}

export interface SignatureLookupResult {
  normalized: NormalizedSignature;
  candidates: SignatureCandidate[];
  errors: SignatureLookupError[];
}

interface SourceContext {
  normalized: NormalizedSignature;
  chainId: number;
}

const FUNCTION_SELECTOR_HEX_LENGTH = 8;
const EVENT_TOPIC_HEX_LENGTH = 64;

export function normalizeSignatureInput(input: string): NormalizedSignature {
  const trimmed = input.trim();
  const withoutPrefix = trimmed.replace(/^0x/i, "");
  const lowered = withoutPrefix.toLowerCase();

  if (!/^[a-f0-9]+$/.test(lowered)) {
    throw new Error("无效签名格式：只允许十六进制字符");
  }

  if (lowered.length === FUNCTION_SELECTOR_HEX_LENGTH) {
    return { kind: "function", hex: `0x${lowered}` };
  }

  if (lowered.length === EVENT_TOPIC_HEX_LENGTH) {
    return { kind: "event", hex: `0x${lowered}` };
  }

  throw new Error("无效签名格式：请输入 4 字节函数选择器或 32 字节事件 Topic");
}

function candidateKey(candidate: SignatureCandidate): string {
  return `${candidate.source}:${candidate.name.toLowerCase()}`;
}

function deduplicateCandidates(candidates: SignatureCandidate[]): SignatureCandidate[] {
  const seen = new Set<string>();
  const unique: SignatureCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

async function lookupFromLocal(ctx: SourceContext): Promise<SignatureCandidate[]> {
  const contracts = await listContractsByChainId(ctx.chainId);
  const output: SignatureCandidate[] = [];

  for (const contract of contracts) {
    let iface: Interface;
    try {
      iface = new Interface(contract.abi);
    } catch {
      continue;
    }

    if (ctx.normalized.kind === "function") {
      iface.forEachFunction((fragment) => {
        if (fragment.selector.toLowerCase() === ctx.normalized.hex) {
          output.push({
            name: fragment.format("sighash"),
            source: "local",
            extra: `${contract.name} (${contract.address})`,
          });
        }
      });
      iface.forEachError((fragment) => {
        if (fragment.selector.toLowerCase() === ctx.normalized.hex) {
          output.push({
            name: fragment.format("sighash"),
            source: "local",
            extra: `${contract.name} (${contract.address})`,
          });
        }
      });
    } else {
      iface.forEachEvent((fragment) => {
        if (fragment.topicHash.toLowerCase() === ctx.normalized.hex) {
          output.push({
            name: fragment.format("sighash"),
            source: "local",
            extra: `${contract.name} (${contract.address})`,
          });
        }
      });
    }
  }

  return deduplicateCandidates(output);
}

function build4ByteEndpoint(ctx: SourceContext): string {
  const base = "https://www.4byte.directory/api/v1";
  const query = encodeURIComponent(ctx.normalized.hex);
  if (ctx.normalized.kind === "event") {
    return `${base}/event-signatures/?hex_signature=${query}`;
  }
  return `${base}/signatures/?hex_signature=${query}`;
}

async function lookupFrom4byte(ctx: SourceContext): Promise<SignatureCandidate[]> {
  const response = await fetch(build4ByteEndpoint(ctx), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ text_signature?: string }>;
  };

  const candidates = (payload.results ?? [])
    .map((item) => item.text_signature?.trim())
    .filter((item): item is string => Boolean(item))
    .map((name) => ({
      name,
      source: "4byte" as const,
    }));

  return deduplicateCandidates(candidates);
}

function buildSourcifyEndpoint(ctx: SourceContext): string {
  const base = "https://api.4byte.sourcify.dev/signature-database/v1/lookup";
  const queryParam = ctx.normalized.kind === "event" ? "event" : "function";
  return `${base}?${queryParam}=${encodeURIComponent(ctx.normalized.hex)}`;
}

async function lookupFromSourcify(ctx: SourceContext): Promise<SignatureCandidate[]> {
  const response = await fetch(buildSourcifyEndpoint(ctx), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok?: boolean;
    result?: {
      function?: Record<string, Array<{ name?: string; hasVerifiedContract?: boolean }>>;
      event?: Record<string, Array<{ name?: string; hasVerifiedContract?: boolean }>>;
    };
  };

  if (!payload.ok || !payload.result) {
    return [];
  }

  const map = ctx.normalized.kind === "event" ? payload.result.event : payload.result.function;
  const rows = map?.[ctx.normalized.hex] ?? [];

  const candidates = rows
    .map((item) => {
      const name = item.name?.trim();
      if (!name) {
        return null;
      }
      return {
        name,
        source: "sourcify" as const,
        extra: item.hasVerifiedContract ? "verified" : "unverified",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return deduplicateCandidates(candidates);
}

export async function lookupSignatureCandidates(input: string, chainId: number): Promise<SignatureLookupResult> {
  const normalized = normalizeSignatureInput(input);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("当前钱包网络无效，无法查询本地 ABI");
  }
  const ctx: SourceContext = { normalized, chainId };

  const settled = await Promise.allSettled([
    lookupFromLocal(ctx),
    lookupFrom4byte(ctx),
    lookupFromSourcify(ctx),
  ]);

  const sources: SignatureSource[] = ["local", "4byte", "sourcify"];
  const candidates: SignatureCandidate[] = [];
  const errors: SignatureLookupError[] = [];

  settled.forEach((item, index) => {
    const source = sources[index];
    if (item.status === "fulfilled") {
      candidates.push(...item.value);
      return;
    }

    const message = item.reason instanceof Error ? item.reason.message : String(item.reason);
    errors.push({ source, message });
  });

  return {
    normalized,
    candidates: deduplicateCandidates(candidates),
    errors,
  };
}
