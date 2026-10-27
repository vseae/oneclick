import { describe, expect, it } from "vitest";
import { formatValueForDecimals } from "../../lib/value-decimals";

describe("formatValueForDecimals", () => {
  it("keeps the raw value when precision is off", () => {
    expect(formatValueForDecimals("18000000000000000000", null)).toBeNull();
  });

  it("formats plain integer results with the selected precision", () => {
    expect(formatValueForDecimals("18000000000000000000", 18)).toBe("18");
    expect(formatValueForDecimals("1500000", 6)).toBe("1.5");
    expect(formatValueForDecimals("1", 18)).toBe("0.000000000000000001");
    expect(formatValueForDecimals("42", 0)).toBe("42");
  });

  it("formats negative integers", () => {
    expect(formatValueForDecimals("-1500000", 6)).toBe("-1.5");
  });

  it("leaves non-integer results alone", () => {
    expect(formatValueForDecimals("true", 18)).toBeNull();
    expect(formatValueForDecimals("[1, 2]", 18)).toBeNull();
    expect(formatValueForDecimals("0xabcd", 18)).toBeNull();
    expect(formatValueForDecimals("1.5", 18)).toBeNull();
    expect(formatValueForDecimals("", 18)).toBeNull();
  });
});
