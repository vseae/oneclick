import { AbiCoder, id, Indexed, Interface, ParamType } from "ethers";
import type { EventFragment, InterfaceAbi, LogDescription } from "ethers";
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
  abi: InterfaceAbi;
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
    return ParamType.from(typeOnly).format("sighash");
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

function isHashedParam(input: ParamType): boolean {
  if (input.baseType === "array" || input.baseType === "tuple") {
    return true;
  }
  return input.type === "string" || input.type === "bytes";
}

function getIndexedHash(value: unknown): string | null {
  if (value instanceof Indexed) {
    return value.hash;
  }
  if (
    value !== null &&
    typeof value === "object" &&
    "hash" in value &&
    typeof (value as { hash?: unknown }).hash === "string"
  ) {
    return (value as { hash: string }).hash;
  }
  return null;
}

/** Canonical display type for a decoded ABI parameter (tuples included). */
export function formatEventParamType(input: ParamType): string {
  try {
    return input.format("sighash");
  } catch {
    return input.type;
  }
}

/** Format one decoded argument, keeping indexed reference-type hashes readable. */
export function formatEventArgument(
  input: ParamType,
  value: unknown
): { value: string; hashed: boolean } {
  if (input.indexed && isHashedParam(input)) {
    const hash = getIndexedHash(value);
    if (hash) {
      return { value: hash, hashed: true };
    }
  }
  return { value: formatResult(value), hashed: false };
}

function buildDecodedEvent(
  parsed: LogDescription,
  source: RawEventDecodeSource
): DecodedRawEvent {
  const params = parsed.fragment.inputs.map((input, index) => {
    const formatted = formatEventArgument(input, parsed.args[index]);
    return {
      name: input.name || `param${index}`,
      type: formatEventParamType(input),
      indexed: Boolean(input.indexed),
      hashed: formatted.hashed,
      value: formatted.value,
    };
  });

  return {
    name: parsed.name,
    signature: parsed.signature,
    fullSignature: parsed.fragment.format("full"),
    params,
    source,
  };
}

function createInterface(abi: InterfaceAbi): Interface {
  try {
    return new Interface(abi);
  } catch {
    throw new Error("ABI 格式无效，无法创建事件接口");
  }
}

/**
 * Reject logs that do not exactly match the event definition. An event's
 * signature hash does not commit to its indexed flags, so the same topic0 can
 * describe differently-shaped logs across contracts; ethers' `parseLog` is
 * lenient about extra topics/data, which would silently decode wrong values.
 */
function assertLogMatchesEvent(fragment: EventFragment, log: RawEventLog): void {
  const expectedTopics = 1 + fragment.inputs.filter((input) => input.indexed).length;
  if (log.topics.length !== expectedTopics) {
    throw new Error(
      `Topic 数量与事件定义不匹配：该事件需要 ${expectedTopics} 个 Topic，实际收到 ${log.topics.length} 个`
    );
  }

  const nonIndexedTypes = fragment.inputs
    .filter((input) => !input.indexed)
    .map((input) => formatEventParamType(input));
  const coder = AbiCoder.defaultAbiCoder();

  if (nonIndexedTypes.length === 0) {
    if (log.data !== "" && log.data !== "0x") {
      throw new Error("DATA 与事件定义不匹配：该事件没有非 indexed 参数");
    }
    return;
  }

  let reencoded: string;
  try {
    reencoded = coder.encode(nonIndexedTypes, coder.decode(nonIndexedTypes, log.data));
  } catch {
    throw new Error("DATA 无法按事件定义解码");
  }
  if (reencoded.toLowerCase() !== log.data.toLowerCase()) {
    throw new Error("DATA 与事件定义不匹配：存在多余或缺失的编码数据");
  }
}

/**
 * Decode a raw log against an ABI. The event is matched by topic0, and the
 * ABI's indexed markers drive the split between topics and data.
 */
export function decodeRawLogWithAbi(
  abi: InterfaceAbi,
  log: RawEventLog,
  source: RawEventDecodeSource = "abi"
): DecodedRawEvent {
  const topic0 = log.topics[0];
  if (!topic0) {
    throw new Error("日志缺少 TOPIC_0，无法匹配事件");
  }

  const iface = createInterface(abi);
  let fragment;
  try {
    fragment = iface.getEvent(topic0);
  } catch {
    fragment = null;
  }
  if (!fragment) {
    throw new Error("该 ABI 中没有事件与日志的 Topic0 匹配");
  }

  assertLogMatchesEvent(fragment, log);

  let parsed;
  try {
    parsed = iface.parseLog({ topics: log.topics, data: log.data });
  } catch {
    throw new Error("日志数据无法按 ABI 中的事件定义解码，请检查 Topic / DATA 是否属于该合约");
  }
  if (!parsed) {
    throw new Error("该 ABI 中没有事件与日志的 Topic0 匹配");
  }

  return buildDecodedEvent(parsed, source);
}

/** Decode a raw log against every saved ABI that contains the event topic. */
export function decodeRawLogWithLocalAbis(
  sources: RawEventAbiSource[],
  log: RawEventLog
): DecodedRawEvent[] {
  const topic0 = log.topics[0];
  if (!topic0) {
    return [];
  }

  const results: DecodedRawEvent[] = [];
  const seenSignatures = new Set<string>();

  for (const source of sources) {
    let iface: Interface;
    try {
      iface = new Interface(source.abi);
    } catch {
      continue;
    }

    let fragment;
    try {
      fragment = iface.getEvent(topic0);
    } catch {
      fragment = null;
    }
    if (!fragment) {
      continue;
    }

    try {
      assertLogMatchesEvent(fragment, log);
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = iface.parseLog({ topics: log.topics, data: log.data });
    } catch {
      continue;
    }
    if (!parsed) {
      continue;
    }

    const decoded = buildDecodedEvent(parsed, "local");
    decoded.contractName = source.name;
    decoded.contractAddress = source.address;

    if (seenSignatures.has(decoded.fullSignature)) {
      continue;
    }
    seenSignatures.add(decoded.fullSignature);
    results.push(decoded);
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
  const coder = AbiCoder.defaultAbiCoder();

  const indexedValues = new Map<number, unknown>();
  const orderedIndexes = [...indexedIndexes].sort((left, right) => left - right);

  orderedIndexes.forEach((paramIndex, topicOffset) => {
    const type = types[paramIndex];
    const topic = log.topics[topicOffset + 1];
    if (isHashedEventParamType(type)) {
      indexedValues.set(paramIndex, { hash: topic });
      return;
    }

    const [decoded] = coder.decode([type], topic);
    indexedValues.set(paramIndex, decoded);
  });

  const nonIndexedTypes = types.filter((_, index) => !indexedIndexes.has(index));
  const nonIndexedValues =
    nonIndexedTypes.length > 0 ? Array.from(coder.decode(nonIndexedTypes, log.data)) : [];

  // A layout only counts as a match when the data re-encodes to exactly the
  // pasted payload; this rejects layouts whose parameter counts merely fit.
  if (nonIndexedTypes.length > 0) {
    const reencoded = coder.encode(nonIndexedTypes, nonIndexedValues);
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
    const hash = hashed ? getIndexedHash(value) : null;

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
  if (id(canonical).toLowerCase() !== topic0.toLowerCase()) {
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
