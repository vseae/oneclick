import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  MULTICALL3_ABI,
  MULTICALL3_CANONICAL_ADDRESS,
  getMulticall3Address,
  isMulticall3Supported,
} from "../../lib/multicall3";

describe("multicall3 registry", () => {
  it("resolves the canonical deployment for supported chains", () => {
    for (const chainId of [1, 11155111, 146, 43114, 43113, 143, 10143]) {
      expect(getMulticall3Address(chainId)).toBe(MULTICALL3_CANONICAL_ADDRESS);
      expect(isMulticall3Supported(chainId)).toBe(true);
    }
  });

  it("returns null for chains without a deployment", () => {
    // Sonic Blaze, exSat and exSat Testnet are not in the upstream deployment list.
    for (const chainId of [64165, 7200, 840000, 999999999999]) {
      expect(getMulticall3Address(chainId)).toBeNull();
      expect(isMulticall3Supported(chainId)).toBe(false);
    }
    expect(getMulticall3Address(undefined)).toBeNull();
    expect(getMulticall3Address(null)).toBeNull();
  });

  it("uses the per-chain address overrides", () => {
    expect(getMulticall3Address(324)).toBe("0xF9cda624FBC7e059355ce98a31693d299FACd963");
    expect(getMulticall3Address(2741)).toBe("0xF9cda624FBC7e059355ce98a31693d299FACd963");
    expect(getMulticall3Address(54176)).toBe("0x03657CDcDA1523C073b5e09c37dd199E6fBD1b99");
  });

  it("exposes a well formed address and the aggregate3 ABI", () => {
    expect(MULTICALL3_CANONICAL_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    for (const chainId of [1, 324, 2741, 54176]) {
      expect(getMulticall3Address(chainId)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }

    const iface = new ethers.Interface(MULTICALL3_ABI);
    // Known Multicall3 aggregate3 selector.
    expect(iface.getFunction("aggregate3")?.selector).toBe("0x82ad56cb");
  });

  it("encodes an aggregate3 call that ethers can decode again", () => {
    const iface = new ethers.Interface(MULTICALL3_ABI);
    const calls = [
      {
        target: "0x1111111111111111111111111111111111111111",
        allowFailure: true,
        callData: "0x06fdde03",
      },
      {
        target: "0x2222222222222222222222222222222222222222",
        allowFailure: true,
        callData: "0x18160ddd",
      },
    ];

    const data = iface.encodeFunctionData("aggregate3", [calls]);
    const decoded = iface.decodeFunctionData("aggregate3", data);

    expect(decoded[0]).toHaveLength(2);
    expect(decoded[0][0].target).toBe(calls[0].target);
    expect(decoded[0][1].callData).toBe(calls[1].callData);
  });
});
