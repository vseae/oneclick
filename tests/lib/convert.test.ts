import { describe, expect, it } from "vitest";
import {
  BASE_FIELDS,
  ETH_UNITS,
  bytes32ToString,
  formatAmount,
  formatBaseValue,
  normalizeBytes32,
  parseAmount,
  parseBaseValue,
  parseDateTimeLocalUtc,
  parseEpochInput,
  stringToBytes32,
  toSuperscript,
  toUtcString,
  utcPartsToEpochSeconds,
} from "../../lib/convert";

// The repo targets ES2017, so BigInt literals are avoided in favour of helpers.
const big = (value: string | number) => BigInt(value);
const pow10 = (exponent: number) => big(10) ** big(exponent);

describe("eth unit conversion", () => {
  it("exposes the canonical 1000x denomination ladder", () => {
    expect(ETH_UNITS.map((unit) => unit.decimals)).toEqual([
      0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42,
    ]);
    expect(ETH_UNITS.find((unit) => unit.name === "Ether")?.decimals).toBe(18);
  });

  it("parses decimal amounts into the smallest unit", () => {
    expect(parseAmount("1", 18)).toEqual({ ok: true, value: pow10(18) });
    expect(parseAmount(".5", 18)).toEqual({ ok: true, value: big(5) * pow10(17) });
    expect(parseAmount("0.000000001", 9)).toEqual({ ok: true, value: big(1) });
    expect(parseAmount("42", 0)).toEqual({ ok: true, value: big(42) });
  });

  it("treats 0x input as an integer in the current unit", () => {
    expect(parseAmount("0x10", 0)).toEqual({ ok: true, value: big(16) });
    expect(parseAmount("0xff", 18)).toEqual({ ok: true, value: big(255) * pow10(18) });
  });

  it("rejects invalid and over-precise input", () => {
    expect(parseAmount("", 18).ok).toBe(false);
    expect(parseAmount("abc", 18).ok).toBe(false);
    expect(parseAmount("-1", 18).ok).toBe(false);
    expect(parseAmount("1.2.3", 18).ok).toBe(false);
    const tooPrecise = parseAmount("1.1234567890123456789", 18);
    expect(tooPrecise.ok).toBe(false);
    if (!tooPrecise.ok) expect(tooPrecise.error).toContain("精度超出");
  });

  it("formats without floating point and without trailing zeros", () => {
    expect(formatAmount(big(0), 18)).toBe("0");
    expect(formatAmount(pow10(18), 18)).toBe("1");
    expect(formatAmount(big(15) * pow10(17), 18)).toBe("1.5");
    expect(formatAmount(big(1), 18)).toBe("0.000000000000000001");
    expect(formatAmount(big(1500), 3)).toBe("1.5");
    expect(formatAmount(big(42), 0)).toBe("42");
  });

  it("round-trips every denomination", () => {
    const wei = big("123456789012345678901234");
    for (const unit of ETH_UNITS) {
      const rendered = formatAmount(wei, unit.decimals);
      const parsed = parseAmount(rendered, unit.decimals);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.value).toBe(wei);
    }
  });

  it("renders unicode superscripts for exponents", () => {
    expect(toSuperscript(18)).toBe("¹⁸");
    expect(toSuperscript(0)).toBe("⁰");
  });
});

describe("number base conversion", () => {
  it("covers binary, octal, decimal and hexadecimal", () => {
    expect(BASE_FIELDS.map((field) => field.radix)).toEqual([2, 8, 10, 16]);
  });

  it("parses values with and without prefixes", () => {
    expect(parseBaseValue("0xff", 16)).toEqual({ ok: true, value: big(255) });
    expect(parseBaseValue("0xFF", 16)).toEqual({ ok: true, value: big(255) });
    expect(parseBaseValue("0b1111", 2)).toEqual({ ok: true, value: big(15) });
    expect(parseBaseValue("0o777", 8)).toEqual({ ok: true, value: big(511) });
    expect(parseBaseValue("1_000", 10)).toEqual({ ok: true, value: big(1000) });
  });

  it("rejects digits outside the radix", () => {
    expect(parseBaseValue("2", 2).ok).toBe(false);
    expect(parseBaseValue("8", 8).ok).toBe(false);
    expect(parseBaseValue("ff", 10).ok).toBe(false);
    expect(parseBaseValue("", 16).ok).toBe(false);
  });

  it("round-trips against BigInt.toString", () => {
    const value = big(2) ** big(130) + big(12345);
    expect(formatBaseValue(value, 16)).toBe(value.toString(16));
    expect(formatBaseValue(value, 2)).toBe(value.toString(2));
    for (const field of BASE_FIELDS) {
      expect(parseBaseValue(formatBaseValue(value, field.radix), field.radix)).toEqual({
        ok: true,
        value,
      });
    }
  });
});

describe("string <-> bytes32", () => {
  it("right pads the utf8 payload", () => {
    expect(stringToBytes32("abc")).toEqual({
      ok: true,
      value: `0x616263${"0".repeat(58)}`,
    });
  });

  it("supports exactly 32 bytes and rejects more", () => {
    expect(stringToBytes32("a".repeat(32)).ok).toBe(true);
    const tooLong = stringToBytes32("a".repeat(33));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error).toContain("超出");
  });

  it("normalizes short hex into bytes32", () => {
    expect(normalizeBytes32("0x616263")).toEqual({
      ok: true,
      value: `0x616263${"0".repeat(58)}`,
    });
    expect(normalizeBytes32("616263").ok).toBe(true);
    expect(normalizeBytes32("0x61626").ok).toBe(false);
    expect(normalizeBytes32(`0x${"a".repeat(66)}`).ok).toBe(false);
  });

  it("decodes the payload up to the first zero byte", () => {
    expect(bytes32ToString(`0x616263${"0".repeat(58)}`)).toEqual({ ok: true, value: "abc" });
    expect(bytes32ToString(`0x${"0".repeat(64)}`)).toEqual({ ok: true, value: "" });
  });

  it("round-trips multibyte text", () => {
    const encoded = stringToBytes32("代币");
    expect(encoded.ok).toBe(true);
    if (encoded.ok) {
      expect(bytes32ToString(encoded.value)).toEqual({ ok: true, value: "代币" });
    }
  });

  it("rejects binary data that is not valid utf8", () => {
    const hashLike = `0x${"ff".repeat(32)}`;
    const decoded = bytes32ToString(hashLike);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toContain("UTF-8");
  });

  it("rejects non bytes32 length", () => {
    expect(bytes32ToString("0x1234").ok).toBe(false);
  });
});

describe("unix epoch conversion", () => {
  it("infers seconds versus milliseconds from length", () => {
    expect(parseEpochInput("1700000000")).toEqual({
      ok: true,
      value: { ms: 1_700_000_000_000, unit: "seconds" },
    });
    expect(parseEpochInput("1700000000000")).toEqual({
      ok: true,
      value: { ms: 1_700_000_000_000, unit: "milliseconds" },
    });
  });

  it("rejects malformed timestamps", () => {
    expect(parseEpochInput("abc").ok).toBe(false);
    expect(parseEpochInput("1.5").ok).toBe(false);
    expect(parseEpochInput("17000000000000").ok).toBe(false);
  });

  it("formats UTC without locale drift", () => {
    expect(toUtcString(0)).toBe("1970-01-01 00:00:00 UTC");
    expect(toUtcString(1_700_000_000_000)).toBe("2023-11-14 22:13:20 UTC");
  });

  it("converts UTC parts back to unix seconds", () => {
    const parts = parseDateTimeLocalUtc("2023-11-14T22:13:20");
    expect(parts.ok).toBe(true);
    if (parts.ok) {
      expect(utcPartsToEpochSeconds(parts.value)).toEqual({ ok: true, value: 1_700_000_000 });
    }
  });

  it("rejects impossible dates instead of rolling over", () => {
    const parts = parseDateTimeLocalUtc("2026-02-30T00:00:00");
    expect(parts.ok).toBe(true);
    if (parts.ok) expect(utcPartsToEpochSeconds(parts.value).ok).toBe(false);
    expect(parseDateTimeLocalUtc("2026-13-01T00:00").ok).toBe(false);
    expect(parseDateTimeLocalUtc("2026-01-01T24:00").ok).toBe(false);
  });
});
