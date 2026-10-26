import { beforeEach, describe, expect, it, vi } from "vitest";

describe("signature lookup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("normalizes function selector input", async () => {
    const mod = await import("../../lib/signature-lookup");
    expect(mod.normalizeSignatureInput("a9059cbb")).toEqual({
      kind: "function",
      hex: "0xa9059cbb",
    });
    expect(mod.normalizeSignatureInput("0X08C379A0")).toEqual({
      kind: "function",
      hex: "0x08c379a0",
    });
  });

  it("normalizes event topic input", async () => {
    const mod = await import("../../lib/signature-lookup");
    expect(
      mod.normalizeSignatureInput(
        "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      )
    ).toEqual({
      kind: "event",
      hex: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    });
  });

  it("rejects invalid signature input", async () => {
    const mod = await import("../../lib/signature-lookup");
    expect(() => mod.normalizeSignatureInput("0x123")).toThrow("无效签名格式");
    expect(() => mod.normalizeSignatureInput("0xzzzzzzzz")).toThrow("无效签名格式");
  });

  it("looks up candidates from local ABI, 4byte and sourcify", async () => {
    vi.doMock("../../lib/local-store", () => ({
      listContractsByChainId: vi.fn(async () => [
        {
          id: 1,
          name: "TokenA",
          address: "0x1111111111111111111111111111111111111111",
          chainId: 1,
          abi: [{
            type: "function",
            name: "transfer",
            stateMutability: "nonpayable",
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          }],
        },
      ]),
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 2,
          results: [
            {
              text_signature: "transfer(address,uint256)",
            },
            {
              text_signature: "workMyDirefulOwner(uint256,uint256)",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            function: {
              "0xa9059cbb": [
                { name: "transfer(address,uint256)", hasVerifiedContract: true },
              ],
            },
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const mod = await import("../../lib/signature-lookup");
    const result = await mod.lookupSignatureCandidates("0xa9059cbb", 1);

    expect(result.normalized.kind).toBe("function");
    expect(
      result.candidates.some(
        (item) =>
          item.name === "transfer(address,uint256)" &&
          item.source === "local" &&
          item.kind === "function"
      )
    ).toBe(true);
    expect(
      result.candidates.some(
        (item) =>
          item.name === "workMyDirefulOwner(uint256,uint256)" &&
          item.source === "4byte" &&
          item.kind === "ambiguous"
      )
    ).toBe(true);
    expect(
      result.candidates.some(
        (item) =>
          item.name === "transfer(address,uint256)" &&
          item.source === "sourcify" &&
          item.kind === "ambiguous"
      )
    ).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("4byte.directory");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("api.4byte.sourcify.dev");
  });

  it("handles partial upstream failures and keeps successful sources", async () => {
    vi.doMock("../../lib/local-store", () => ({
      listContractsByChainId: vi.fn(async () => []),
    }));

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            function: {
              "0x08c379a0": [{ name: "Error(string)", hasVerifiedContract: true }],
            },
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const mod = await import("../../lib/signature-lookup");
    const result = await mod.lookupSignatureCandidates("0x08c379a0", 1);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].source).toBe("sourcify");
    expect(result.candidates[0].kind).toBe("error");
    expect(result.errors.some((err) => err.source === "4byte")).toBe(true);
  });

  it("deduplicates same signature within same source", async () => {
    vi.doMock("../../lib/local-store", () => ({
      listContractsByChainId: vi.fn(async () => []),
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 2,
          results: [
            { text_signature: "Error(string)" },
            { text_signature: "Error(string)" },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            function: {
              "0x08c379a0": [
                { name: "Error(string)", hasVerifiedContract: true },
                { name: "Error(string)", hasVerifiedContract: false },
              ],
            },
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const mod = await import("../../lib/signature-lookup");
    const result = await mod.lookupSignatureCandidates("0x08c379a0", 1);

    const bySource = result.candidates.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {});

    expect(bySource["4byte"]).toBe(1);
    expect(bySource["sourcify"]).toBe(1);
    expect(result.candidates.every((item) => item.kind === "error")).toBe(true);
  });

  it("labels local functions, custom errors and events", async () => {
    vi.doMock("../../lib/local-store", () => ({
      listContractsByChainId: vi.fn(async () => [
        {
          id: 1,
          name: "TokenA",
          address: "0x1111111111111111111111111111111111111111",
          chainId: 1,
          abi: [
            {
              type: "function",
              name: "transfer",
              stateMutability: "nonpayable",
              inputs: [
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
            },
            {
              type: "error",
              name: "OwnableUnauthorizedAccount",
              inputs: [{ name: "account", type: "address" }],
            },
            {
              type: "event",
              name: "Transfer",
              anonymous: false,
              inputs: [
                { name: "from", type: "address", indexed: true },
                { name: "to", type: "address", indexed: true },
                { name: "value", type: "uint256", indexed: false },
              ],
            },
          ],
        },
      ]),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ results: [], ok: true, result: { function: {}, event: {} } }),
      })) as unknown as typeof fetch
    );

    const mod = await import("../../lib/signature-lookup");

    const functionResult = await mod.lookupSignatureCandidates("0xa9059cbb", 1);
    expect(functionResult.candidates.find((item) => item.source === "local")).toMatchObject({
      name: "transfer(address,uint256)",
      kind: "function",
    });

    const errorResult = await mod.lookupSignatureCandidates("0x118cdaa7", 1);
    expect(errorResult.candidates.find((item) => item.source === "local")).toMatchObject({
      name: "OwnableUnauthorizedAccount(address)",
      kind: "error",
    });

    const eventResult = await mod.lookupSignatureCandidates(
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      1
    );
    expect(eventResult.candidates.find((item) => item.source === "local")).toMatchObject({
      name: "Transfer(address,address,uint256)",
      kind: "event",
    });
  });

  it("labels remote event results as events", async () => {
    vi.doMock("../../lib/local-store", () => ({
      listContractsByChainId: vi.fn(async () => []),
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ text_signature: "Transfer(address,address,uint256)" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            function: {},
            event: {
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": [
                { name: "Transfer(address,address,uint256)", hasVerifiedContract: true },
              ],
            },
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const mod = await import("../../lib/signature-lookup");
    const result = await mod.lookupSignatureCandidates(
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      1
    );

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((item) => item.kind === "event")).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("event-signatures");
  });

  it("queries local signatures from the selected chain only", async () => {
    const listContractsByChainId = vi.fn(async () => [
      {
        id: 1,
        name: "TokenA",
        address: "0x1111111111111111111111111111111111111111",
        chainId: 1,
        abi: [
          {
            type: "function",
            name: "transfer",
            stateMutability: "nonpayable",
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
      },
    ]);

    vi.doMock("../../lib/local-store", () => ({
      listContractsByChainId,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ results: [] }),
      })) as unknown as typeof fetch
    );

    const mod = await import("../../lib/signature-lookup");
    const result = await mod.lookupSignatureCandidates("0xa9059cbb", 1);

    expect(listContractsByChainId).toHaveBeenCalledWith(1);
    expect(result.candidates.some((item) => item.source === "local")).toBe(true);
  });
});
