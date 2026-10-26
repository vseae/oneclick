/**
 * Pure conversion helpers shared by the calculator tools.
 *
 * Everything here is framework-free and BigInt-based so the tools never go
 * through floating point math and the logic stays unit testable.
 */

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Native ETH denomination units                                              */
/* -------------------------------------------------------------------------- */

export interface EthUnit {
  name: string;
  decimals: number;
}

/**
 * The full canonical denomination ladder. Every step is a factor of 1000,
 * which is why the exponents land on multiples of three.
 */
export const ETH_UNITS: readonly EthUnit[] = [
  { name: "Wei", decimals: 0 },
  { name: "KWei", decimals: 3 },
  { name: "MWei", decimals: 6 },
  { name: "GWei", decimals: 9 },
  { name: "Szabo", decimals: 12 },
  { name: "Finney", decimals: 15 },
  { name: "Ether", decimals: 18 },
  { name: "KEther", decimals: 21 },
  { name: "MEther", decimals: 24 },
  { name: "GEther", decimals: 27 },
  { name: "TEther", decimals: 30 },
  { name: "PEther", decimals: 33 },
  { name: "EEther", decimals: 36 },
  { name: "ZEther", decimals: 39 },
  { name: "YEther", decimals: 42 },
];

const HEX_AMOUNT_RE = /^0x[0-9a-f]+$/i;

/**
 * Parse a user supplied amount into its smallest integer representation.
 *
 * Accepted formats:
 * - plain decimal: `1`, `1.5`, `.5`
 * - `0x` hex: interpreted as an integer expressed in *the given unit*, which
 *   is how developer tools usually treat pasted wei/gwei hex values.
 */
export function parseAmount(input: string, decimals: number): Result<bigint> {
  const raw = input.trim().replace(/[\s_]/g, "");
  if (!raw) return { ok: false, error: "请输入数值" };

  if (HEX_AMOUNT_RE.test(raw)) {
    try {
      return { ok: true, value: BigInt(raw) * BigInt(10) ** BigInt(decimals) };
    } catch {
      return { ok: false, error: "十六进制数值无效" };
    }
  }

  if (raw.startsWith("-")) return { ok: false, error: "不支持负数" };
  if (!/^\d*\.?\d*$/.test(raw)) return { ok: false, error: "只允许数字和小数点" };

  const [integerPart = "", fractionPart = ""] = raw.split(".");
  if (!integerPart && !fractionPart) return { ok: false, error: "请输入数值" };

  if (fractionPart.length > decimals) {
    return { ok: false, error: `精度超出：该单位最多 ${decimals} 位小数` };
  }

  const digits = `${integerPart || "0"}${fractionPart.padEnd(decimals, "0")}`;
  return { ok: true, value: BigInt(digits) };
}

/** Render a smallest-unit integer back into a trimmed decimal string. */
export function formatAmount(value: bigint, decimals: number): string {
  if (value === BigInt(0)) return "0";
  if (decimals === 0) return value.toString();

  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const integerPart = absolute / base;
  const fractionPart = (absolute % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${negative ? "-" : ""}${integerPart}${fractionPart ? `.${fractionPart}` : ""}`;
}

/* -------------------------------------------------------------------------- */
/* Number base conversion                                                     */
/* -------------------------------------------------------------------------- */

export type BaseKey = "binary" | "octal" | "decimal" | "hexadecimal";

export interface BaseField {
  key: BaseKey;
  label: string;
  radix: number;
}

export const BASE_FIELDS: readonly BaseField[] = [
  { key: "binary", label: "Binary", radix: 2 },
  { key: "octal", label: "Octal", radix: 8 },
  { key: "decimal", label: "Decimal", radix: 10 },
  { key: "hexadecimal", label: "Hexadecimal", radix: 16 },
];

const BASE_DIGITS: Record<number, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^\d+$/,
  16: /^[0-9a-f]+$/i,
};

const BASE_PREFIX: Record<number, string> = { 2: "0b", 8: "0o", 16: "0x" };

/**
 * Parse a value written in the given radix. Optional `0x`/`0b`/`0o` prefixes,
 * whitespace and `_` separators are tolerated so pasted values just work.
 */
export function parseBaseValue(input: string, radix: number): Result<bigint> {
  let raw = input.trim().replace(/[\s_]/g, "").toLowerCase();
  if (!raw) return { ok: false, error: "请输入数值" };
  if (raw.startsWith("-")) return { ok: false, error: "不支持负数" };

  const prefix = BASE_PREFIX[radix];
  if (prefix && raw.startsWith(prefix)) raw = raw.slice(prefix.length);
  if (!raw) return { ok: false, error: "请输入数值" };

  const digits = BASE_DIGITS[radix];
  if (!digits || !digits.test(raw)) {
    return { ok: false, error: `不是合法的 ${radix} 进制数值` };
  }

  const bigRadix = BigInt(radix);
  let value = BigInt(0);
  for (const char of raw) {
    value = value * bigRadix + BigInt(parseInt(char, 16));
  }
  return { ok: true, value };
}

export function formatBaseValue(value: bigint, radix: number): string {
  return value.toString(radix);
}

/* -------------------------------------------------------------------------- */
/* string <-> bytes32                                                         */
/* -------------------------------------------------------------------------- */

const BYTES32_HEX_LENGTH = 64;

export function utf8ByteLength(input: string): number {
  return new TextEncoder().encode(input).length;
}

/** Encode a UTF-8 string into a right zero padded `bytes32` hex value. */
export function stringToBytes32(input: string): Result<string> {
  const bytes = new TextEncoder().encode(input);
  if (bytes.length > 32) {
    return { ok: false, error: `UTF-8 长度 ${bytes.length} 字节，超出 bytes32 的 32 字节上限` };
  }

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { ok: true, value: `0x${hex.padEnd(BYTES32_HEX_LENGTH, "0")}` };
}

/** Validate and right pad arbitrary hex data into a `bytes32` value. */
export function normalizeBytes32(input: string): Result<string> {
  const raw = input.trim().replace(/^0x/i, "").replace(/[\s_]/g, "").toLowerCase();
  if (!raw) return { ok: false, error: "请输入十六进制数据" };
  if (!/^[0-9a-f]+$/.test(raw)) return { ok: false, error: "只允许十六进制字符" };
  if (raw.length > BYTES32_HEX_LENGTH) {
    return { ok: false, error: `超过 32 字节（当前 ${Math.ceil(raw.length / 2)} 字节）` };
  }
  if (raw.length % 2 !== 0) return { ok: false, error: "十六进制字符数必须为偶数" };

  return { ok: true, value: `0x${raw.padEnd(BYTES32_HEX_LENGTH, "0")}` };
}

/**
 * Decode the UTF-8 payload of a `bytes32` value.
 *
 * The payload ends at the first zero byte, which matches how Solidity stores
 * short strings in `bytes32` (`bytes32("abc")` is `0x616263000...0`).
 */
export function bytes32ToString(input: string): Result<string> {
  const raw = input.trim().replace(/^0x/i, "");
  if (raw.length !== BYTES32_HEX_LENGTH || !/^[0-9a-f]+$/i.test(raw)) {
    return { ok: false, error: "bytes32 必须是 32 字节十六进制" };
  }

  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) {
    bytes[index] = parseInt(raw.slice(index * 2, index * 2 + 2), 16);
  }

  const terminator = bytes.indexOf(0);
  const payload = terminator === -1 ? bytes : bytes.slice(0, terminator);

  try {
    return { ok: true, value: new TextDecoder("utf-8", { fatal: true }).decode(payload) };
  } catch {
    return { ok: false, error: "内容不是有效的 UTF-8 文本（可能是哈希或二进制数据）" };
  }
}

/* -------------------------------------------------------------------------- */
/* Unix epoch <-> UTC                                                         */
/* -------------------------------------------------------------------------- */

export type EpochUnit = "seconds" | "milliseconds";

export interface ParsedEpoch {
  ms: number;
  unit: EpochUnit;
}

/** Parse a 10-digit seconds or 13-digit milliseconds timestamp. */
export function parseEpochInput(input: string): Result<ParsedEpoch> {
  const raw = input.trim().replace(/[\s_,]/g, "");
  if (!raw) return { ok: false, error: "请输入 Unix 时间戳" };
  if (!/^\d+$/.test(raw)) return { ok: false, error: "时间戳必须是整数" };
  if (raw.length > 13) return { ok: false, error: "时间戳位数过多，请检查是否为秒或毫秒" };

  const numeric = Number(raw);
  if (!Number.isSafeInteger(numeric)) return { ok: false, error: "时间戳超出可表示范围" };

  const unit: EpochUnit = raw.length <= 10 ? "seconds" : "milliseconds";
  return { ok: true, value: { ms: unit === "seconds" ? numeric * 1000 : numeric, unit } };
}

/** `2026-10-26 04:40:43 UTC` — timezone independent, no locale surprises. */
export function toUtcString(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 19).replace("T", " ")} UTC`;
}

export function toLocalString(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(ms));
}

/** Value string for an `<input type="datetime-local">` interpreted as UTC. */
export function toDateTimeLocalValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export interface UtcParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Parse `YYYY-MM-DDTHH:mm` / `YYYY-MM-DDTHH:mm:ss` as a UTC instant. */
export function parseDateTimeLocalUtc(input: string): Result<UtcParts> {
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return { ok: false, error: "请填写完整的 UTC 日期与时间" };

  const [, year, month, day, hour, minute, second = "0"] = match;
  const parts: UtcParts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };

  if (parts.month < 1 || parts.month > 12) return { ok: false, error: "月份必须在 1–12 之间" };
  if (parts.day < 1 || parts.day > 31) return { ok: false, error: "日期必须在 1–31 之间" };
  if (parts.hour > 23) return { ok: false, error: "小时必须在 0–23 之间" };
  if (parts.minute > 59) return { ok: false, error: "分钟必须在 0–59 之间" };
  if (parts.second > 59) return { ok: false, error: "秒必须在 0–59 之间" };

  return { ok: true, value: parts };
}

/** Convert already validated UTC parts into unix seconds, rejecting rollovers. */
export function utcPartsToEpochSeconds(parts: UtcParts): Result<number> {
  const ms = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  const date = new Date(ms);
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return { ok: false, error: "不存在的日期，请检查月份与天数" };
  }

  return { ok: true, value: Math.floor(ms / 1000) };
}

/** Human relative distance such as `3 分钟后` or `2 天前`. */
export function describeRelative(ms: number, now: number = Date.now()): string {
  const diffSeconds = Math.round((ms - now) / 1000);
  const absolute = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absolute < 60) return formatter.format(diffSeconds, "second");
  if (absolute < 3600) return formatter.format(Math.round(diffSeconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(diffSeconds / 3600), "hour");
  if (absolute < 2_592_000) return formatter.format(Math.round(diffSeconds / 86_400), "day");
  if (absolute < 31_536_000) return formatter.format(Math.round(diffSeconds / 2_592_000), "month");
  return formatter.format(Math.round(diffSeconds / 31_536_000), "year");
}

/** Render an exponent as unicode superscript, e.g. `18` -> `¹⁸`. */
export function toSuperscript(value: number): string {
  const map: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "-": "⁻",
  };
  return String(value)
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}
