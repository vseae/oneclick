import { describe, expect, it } from "vitest";
import { formatNativeAmount, getNativeChain } from "../../lib/native-currency";

describe("native currency", () => {
  it("uses the transaction chain's currency", () => {
    expect(formatNativeAmount(BigInt("1500000000000000000"), 43114)).toBe("1.5 AVAX");
    expect(formatNativeAmount(BigInt("1000000000000000000"), 1)).toBe("1 ETH");
    expect(getNativeChain(43114)?.nativeCurrency.name).toBe("Avalanche");
  });

  it("does not invent a symbol or precision for unknown chains", () => {
    expect(formatNativeAmount(BigInt(123), 999999)).toBe("123 最小单位（币种未知）");
    expect(getNativeChain(999999)).toBeUndefined();
  });
});
