import { describe, expect, it } from "vitest";

describe("contract import parser", () => {
  it("normalizes a single deployment artifact object with contractName", async () => {
    const mod = await import("../../lib/contract-import");
    const result = mod.parseContractImportPayload(
      {
        address: "0x1111111111111111111111111111111111111111",
        abi: [{ type: "function", name: "symbol", inputs: [], outputs: [] }],
        contractName: "DDVault",
      },
      { defaultChainId: 1, sourceName: "DDVault.json" }
    );

    expect(result).toEqual([
      {
        name: "DDVault",
        address: "0x1111111111111111111111111111111111111111",
        chainId: 1,
        abi: [{ type: "function", name: "symbol", inputs: [], outputs: [] }],
      },
    ]);
  });

  it("normalizes a batch array and falls back to filename names", async () => {
    const mod = await import("../../lib/contract-import");
    const result = mod.parseContractImportPayload(
      [
        {
          name: "TokenA",
          address: "0x2222222222222222222222222222222222222222",
          abi: [],
        },
        {
          contractName: "TokenB",
          address: "0x3333333333333333333333333333333333333333",
          abi: [],
        },
      ],
      { defaultChainId: 56, sourceName: "Batch.json" }
    );

    expect(result).toEqual([
      {
        name: "TokenA",
        address: "0x2222222222222222222222222222222222222222",
        chainId: 56,
        abi: [],
      },
      {
        name: "TokenB",
        address: "0x3333333333333333333333333333333333333333",
        chainId: 56,
        abi: [],
      },
    ]);
  });

  it("reads multiple import sources and preserves per-file parse errors", async () => {
    const mod = await import("../../lib/contract-import");
    const result = await mod.parseContractImportSources(
      [
        {
          name: "TokenA.json",
          text: async () => JSON.stringify({
            address: "0x4444444444444444444444444444444444444444",
            abi: [],
          }),
        },
        {
          name: "Broken.json",
          text: async () => "{",
        },
      ],
      { defaultChainId: 137 }
    );

    expect(result.contracts).toEqual([
      {
        name: "TokenA",
        address: "0x4444444444444444444444444444444444444444",
        chainId: 137,
        abi: [],
      },
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^Broken\.json:/);
  });
});
