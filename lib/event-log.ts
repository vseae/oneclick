import { decodeAbiParameters, decodeEventLog, encodeAbiParameters, keccak256, toBytes, type Abi, type AbiEvent, type AbiParameter, type Hex } from "viem";
import { abiSelector, abiSignature, normalizeAbi, parameterType, parseParameter } from "./abi";
import { formatResult } from "./contract-utils";

/** Where a decoded raw event came from. */
export type RawEventDecodeSource = "abi" | "local" | "4byte" | "sourcify";

/** A raw EVM log, as pasted by the user or read from a receipt. */
export interface RawEventLog {
  /** topic0 (event signature hash) first, then the indexed argument hashes. */
  topics: string[];
  data: string;
}

/** A saved ABI the raw decoder may try against. */
export interface RawEventAbiSource {
  name: string;
  address?: string;
  abi: Abi;
}

export interface DecodedEventParam {
  name: string;
  type: string;
  indexed: boolean;
  /** True when the value is the keccak256 hash of an indexed reference type. */
  hashed: boolean;
  value: string;
}

export interface DecodedRawEvent {
  name: string;
  /** Canonical event sighash, e.g. `Transfer(address,address,uint256)`. */
  signature: string;
  /** Human-readable signature with indexed markers. */
  fullSignature: string;
  params: DecodedEventParam[];
  source: RawEventDecodeSource;
  contractName?: string;
  contractAddress?: string;
  /**
   * Signature-only decoding cannot know which parameters are indexed; true when
   * more than one indexed layout also decodes this log.
   */
  layoutAmbiguous?: boolean;
}

const MAX_EVENT_TOPICS = 4;
const TOPIC_PATTERN = /^0x[0-9a-fA-F]{64}$/i;
const DATA_PATTERN = /^0x(?:[0-9a-fA-F]{2})*$/i;
const SIGNATURE_PATTERN = /^([A-Za-z_$][A-Za-z0-9_$]*)\(([\s\S]*)\)$/;

/** Upper bound for indexed-position layouts we are willing to enumerate. */
const MAX_LAYOUT_COMBINATIONS = 4096;

/**
 * Validate and normalize the topic/data fields of a raw log. Topics must be a
 * contiguous run starting at topic0, and data must be an even-length hex blob.
 */
export function normalizeRawLogInput(input: {
  topics: Array<string | null | undefined>;
  data?: string | null;
}): RawEventLog {
  const topics = input.topics.map((topic) => normalizeHexField(topic));

  while (topics.length > 0 && topics[topics.length - 1] === "") {
    topics.pop();
  }

  if (topics.length === 0) {
    throw new Error("至少需要填写 TOPIC_0（事件签名哈希）");
  }
  if (topics.length > MAX_EVENT_TOPICS) {
    throw new Error(`一条日志最多包含 ${MAX_EVENT_TOPICS} 个 Topic`);
  }
  if (topics.some((topic) => topic === "")) {
    throw new Error("Topic 需要从 TOPIC_0 开始连续填写，不能留空中间项");
  }
  topics.forEach((topic, index) => {
    if (!TOPIC_PATTERN.test(topic)) {
      throw new Error(`TOPIC_${index} 必须是 0x 开头的 32 字节十六进制字符串`);
    }
  });

  const data = normalizeHexField(input.data) || "0x";
  if (!DATA_PATTERN.test(data)) {
    throw new Error("DATA 必须是 0x 开头的偶数位十六进制字符串");
  }

  return { topics, data };
}

/** Strip pasted whitespace/newlines and normalize the hex casing and 0X prefix. */
function normalizeHexField(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toLowerCase();
}

export interface ParsedEventSignature {
  name: string;
  types: string[];
}

/** Parse a canonical event sighash such as `Transfer(address,address,uint256)`. */
export function parseEventSignature(signature: string): ParsedEventSignature {
  const trimmed = signature.trim();
  const match = SIGNATURE_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error("无效事件签名：格式应为 Name(type1,type2,...)");
  }

  const name = match[1];
  const body = match[2].trim();
  const rawParams = body.length === 0 ? [] : splitSignatureParams(body, trimmed);
  const types = rawParams.map((raw) => normalizeSignatureParamType(raw, trimmed));

  return { name, types };
}

function splitSignatureParams(body: string, signature: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth < 0) {
        throw new Error(`无效事件签名：括号不匹配 (${signature})`);
      }
    } else if (char === "," && depth === 0) {
      parts.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(body.slice(start).trim());
  if (parts.some((part) => part.length === 0)) {
    throw new Error(`无效事件签名：存在空参数 (${signature})`);
  }

  return parts;
}

function normalizeSignatureParamType(raw: string, signature: string): string {
  // Signatures from 4byte / Sourcify / local ABIs are canonical and carry no
  // parameter names, but tolerate a stray `indexed` or name anyway.
  const rawType = raw.trim().startsWith("(") ? raw.trim() : raw.trim().split(/\s+/)[0];
  // Solidity's deprecated `byte` alias canonicalizes to bytes1, and `function`
  // is an alias for bytes24.
  const typeOnly = rawType.replace(/\bbyte\b/g, "bytes1").replace(/\bfunction\b/g, "bytes24");

  try {
    return parameterType(parseParameter(typeOnly));
  } catch {
    throw new Error(`无法解析事件参数类型 ${raw} (${signature})`);
  }
}

function buildCanonicalSignature(name: string, types: string[]): string {
  return `${name}(${types.join(",")})`;
}

function buildFullSignature(
  name: string,
  types: string[],
  indexedIndexes: ReadonlySet<number>
): string {
  const params = types
    .map((type, index) => (indexedIndexes.has(index) ? `${type} indexed` : type))
    .join(", ");
  return `event ${name}(${params})`;
}

/**
 * Indexed reference types (arrays, tuples, string, bytes) are stored as a
 * keccak256 hash in the log topic, so their original value cannot be recovered.
 */
export function isHashedEventParamType(type: string): boolean {
  const trimmed = type.trim();
  if (trimmed === "string" || trimmed === "bytes" || trimmed === "tuple") {
    return true;
  }
  return trimmed.endsWith("]") || trimmed.startsWith("(");
}

/** Canonical display type for a decoded ABI parameter (tuples included). */
export function formatEventParamType(input: AbiParameter): string {
  return parameterType(input);
}

export function formatEventArgument(
  input: AbiParameter & { indexed?: boolean },
  value: unknown
): { value: string; hashed: boolean } {
  if (input.indexed && isHashedEventParamType(input.type)) {
    const hash = typeof value === "string" ? value : (value as { hash?: string } | null)?.hash;
    if (hash) return { value: hash, hashed: true };
  }
  return { value: formatResult(value), hashed: false };
}

function assertLogMatchesEvent(fragment: AbiEvent, log: RawEventLog): void {
  const expectedTopics = 1 + fragment.inputs.filter((input) => input.indexed).length;
  if (log.topics.length !== expectedTopics) {
    throw new Error(`Topic 数量与事件定义不匹配：该事件需要 ${expectedTopics} 个 Topic，实际收到 ${log.topics.length} 个`);
  }
  const params = fragment.inputs.filter((input) => !input.indexed);
  if (!params.length) {
    if (log.data !== "" && log.data !== "0x") throw new Error("DATA 与事件定义不匹配：该事件没有非 indexed 参数");
    return;
  }
  let encoded: string;
  try {
    const decoded = decodeAbiParameters(params, log.data as Hex);
    encoded = encodeAbiParameters(params, decoded);
  } catch {
    throw new Error("DATA 无法按事件定义解码");
  }
  if (encoded.toLowerCase() !== log.data.toLowerCase()) throw new Error("DATA 与事件定义不匹配：存在多余或缺失的编码数据");
}

export function decodeRawLogWithAbi(abi: Abi, log: RawEventLog, source: RawEventDecodeSource = "abi"): DecodedRawEvent {
  const topic0 = log.topics[0];
  if (!topic0) throw new Error("日志缺少 TOPIC_0，无法匹配事件");
  const fragment = normalizeAbi(abi).find((item): item is AbiEvent => item.type === "event" && abiSelector(item).toLowerCase() === topic0.toLowerCase());
  if (!fragment) throw new Error("该 ABI 中没有事件与日志的 Topic0 匹配");
  assertLogMatchesEvent(fragment, log);
  let args: readonly unknown[] | Record<string, unknown>;
  try {
    args = decodeEventLog({ abi: [fragment], topics: log.topics as [Hex, ...Hex[]], data: log.data as Hex }).args as readonly unknown[] | Record<string, unknown>;
  } catch {
    throw new Error("日志数据无法按 ABI 中的事件定义解码，请检查 Topic / DATA 是否属于该合约");
  }
  const params = fragment.inputs.map((input, index) => {
    const value = Array.isArray(args) ? args[index] : (args as Record<string, unknown>)[input.name || String(index)];
    const formatted = formatEventArgument(input, value);
    return { name: input.name || `param${index}`, type: parameterType(input), indexed: Boolean(input.indexed), hashed: formatted.hashed, value: formatted.value };
  });
  return {
    name: fragment.name,
    signature: abiSignature(fragment),
    fullSignature: `event ${fragment.name}(${fragment.inputs.map((input) => `${parameterType(input)}${input.indexed ? " indexed" : ""}${input.name ? ` ${input.name}` : ""}`).join(", ")})`,
    params,
    source,
  };
}

export function decodeRawLogWithLocalAbis(sources: RawEventAbiSource[], log: RawEventLog): DecodedRawEvent[] {
  const results: DecodedRawEvent[] = [];
  const seen = new Set<string>();
  for (const item of sources) {
    try {
      const decoded = decodeRawLogWithAbi(item.abi, log, "local");
      if (seen.has(decoded.fullSignature)) continue;
      seen.add(decoded.fullSignature);
      results.push({ ...decoded, contractName: item.name, contractAddress: item.address });
    } catch { /* This ABI does not describe the log. */ }
  }
  return results;
}

/** Enumerate every layout of `indexedCount` indexed positions over `paramCount` params. */
function layoutCombinations(paramCount: number, indexedCount: number): number[][] {
  if (indexedCount < 0 || indexedCount > paramCount) {
    return [];
  }

  const combinations: number[][] = [];
  const current: number[] = [];

  const walk = (start: number) => {
    if (current.length === indexedCount) {
      combinations.push([...current]);
      if (combinations.length > MAX_LAYOUT_COMBINATIONS) {
        throw new Error("事件参数过多，无法枚举 indexed 参数位置");
      }
      return;
    }
    const remaining = indexedCount - current.length;
    for (let index = start; index <= paramCount - remaining; index += 1) {
      current.push(index);
      walk(index + 1);
      current.pop();
    }
  };

  walk(0);
  return combinations;
}

function decodeParamsForLayout(
  types: string[],
  indexedIndexes: ReadonlySet<number>,
  log: RawEventLog
): DecodedEventParam[] {
  const indexedValues = new Map<number, unknown>();
  const orderedIndexes = [...indexedIndexes].sort((left, right) => left - right);

  orderedIndexes.forEach((paramIndex, topicOffset) => {
    const type = types[paramIndex];
    const topic = log.topics[topicOffset + 1];
    if (isHashedEventParamType(type)) {
      indexedValues.set(paramIndex, { hash: topic });
      return;
    }

    const [decoded] = decodeAbiParameters([parseParameter(type)], topic as Hex);
    indexedValues.set(paramIndex, decoded);
  });

  const nonIndexedTypes = types.filter((_, index) => !indexedIndexes.has(index));
  const nonIndexedValues =
    nonIndexedTypes.length > 0 ? Array.from(decodeAbiParameters(nonIndexedTypes.map(parseParameter), log.data as Hex)) : [];

  // A layout only counts as a match when the data re-encodes to exactly the
  // pasted payload; this rejects layouts whose parameter counts merely fit.
  if (nonIndexedTypes.length > 0) {
    const reencoded = encodeAbiParameters(nonIndexedTypes.map(parseParameter), nonIndexedValues);
    if (reencoded.toLowerCase() !== log.data.toLowerCase()) {
      throw new Error("DATA 与推断的非 indexed 参数布局不一致");
    }
  } else if (log.data !== "" && log.data !== "0x") {
    throw new Error("DATA 非空，但该布局没有非 indexed 参数");
  }

  let nonIndexedOffset = 0;
  return types.map((type, index) => {
    const indexed = indexedIndexes.has(index);
    const hashed = indexed && isHashedEventParamType(type);
    const value = indexed ? indexedValues.get(index) : nonIndexedValues[nonIndexedOffset++];
    const hash = hashed ? (value as { hash?: string } | undefined)?.hash ?? null : null;

    return {
      name: `param${index}`,
      type,
      indexed,
      hashed: hashed && hash !== null,
      value: hash ?? formatResult(value),
    };
  });
}

/**
 * Decode a raw log from a canonical event signature alone (no ABI). The number
 * of indexed parameters is known from the topic count, but not which parameters
 * they are, so every plausible layout is tried starting with the common
 * "indexed parameters come first" ordering.
 */
export function decodeRawLogWithSignature(
  signature: string,
  log: RawEventLog,
  source: RawEventDecodeSource = "4byte"
): DecodedRawEvent {
  const { name, types } = parseEventSignature(signature);
  const canonical = buildCanonicalSignature(name, types);

  const topic0 = log.topics[0];
  if (!topic0) {
    throw new Error("日志缺少 TOPIC_0，无法匹配事件");
  }
  if (keccak256(toBytes(canonical)).toLowerCase() !== topic0.toLowerCase()) {
    throw new Error("事件签名与日志的 Topic0 不匹配");
  }

  const indexedCount = log.topics.length - 1;
  const layouts = layoutCombinations(types.length, indexedCount);
  if (layouts.length === 0) {
    throw new Error("Topic 数量与事件参数数量不匹配，无法解码");
  }

  let decoded: DecodedRawEvent | null = null;

  for (const layout of layouts) {
    const indexedIndexes = new Set(layout);
    let params: DecodedEventParam[];
    try {
      params = decodeParamsForLayout(types, indexedIndexes, log);
    } catch {
      continue;
    }

    if (!decoded) {
      decoded = {
        name,
        signature: canonical,
        fullSignature: buildFullSignature(name, types, indexedIndexes),
        params,
        source,
      };
      continue;
    }

    // A second fitting layout means the signature alone cannot pin down which
    // parameters are indexed; flag it so the UI can avoid overstating accuracy.
    decoded.layoutAmbiguous = true;
    break;
  }

  if (!decoded) {
    throw new Error("无法用该事件签名解码日志：indexed 参数位置与 Topic 数量不匹配");
  }

  return decoded;
}
