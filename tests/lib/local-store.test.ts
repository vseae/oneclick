import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadStore() {
  vi.resetModules();
  return import("../../lib/local-store");
}

function mockFetchOnce(payload: unknown, init?: { ok?: boolean; status?: number }) {
  const response = {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: vi.fn(async () => payload),
  };
  const fetchMock = vi.fn(async () => response) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("local-store api facade", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists contracts through the contracts API", async () => {
    const fetchMock = mockFetchOnce({
      data: [
        {
          id: 1,
          name: "TokenA",
          address: "0x1111111111111111111111111111111111111111",
          chainId: 1,
          abi: [],
          createdAt: "2026-08-19T00:00:00.000Z",
          addressChainKey: "1:0x1111111111111111111111111111111111111111",
        },
      ],
    });
    const store = await loadStore();

    const contracts = await store.listContracts();

    expect(fetchMock).toHaveBeenCalledWith("/api/contracts", expect.objectContaining({ method: "GET" }));
    expect(contracts).toHaveLength(1);
    expect(contracts[0].name).toBe("TokenA");
  });

  it("lists history through the history API with chain filtering", async () => {
    const fetchMock = mockFetchOnce({
      data: [
        {
          id: 1,
          contractId: 2,
          contractName: "TokenA",
          contractAddress: "0x1111111111111111111111111111111111111111",
          methodName: "symbol",
          methodType: "read",
          params: [],
          result: "TKA",
          timestamp: "2026-08-19T00:00:00.000Z",
          chainId: 1,
        },
      ],
    });
    const store = await loadStore();

    const history = await store.listHistory({ chainId: 1 });

    expect(fetchMock).toHaveBeenCalledWith("/api/history?chainId=1", expect.objectContaining({ method: "GET" }));
    expect(history).toHaveLength(1);
    expect(history[0].contractName).toBe("TokenA");
  });

  it("upserts contracts through the contracts API", async () => {
    const fetchMock = mockFetchOnce({ data: { id: 7, updated: false } });
    const store = await loadStore();

    const result = await store.upsertContract({
      name: "TokenA",
      address: "0x1111111111111111111111111111111111111111",
      chainId: 1,
      abi: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contracts",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TokenA",
          address: "0x1111111111111111111111111111111111111111",
          chainId: 1,
          abi: [],
        }),
      })
    );
    expect(result).toEqual({ id: 7, updated: false });
  });

  it("imports local data through the local-data API", async () => {
    const fetchMock = mockFetchOnce({
      data: {
        contractsImported: 2,
        historyImported: 1,
        historySkipped: 1,
      },
    });
    const store = await loadStore();

    const result = await store.importLocalData({
      schemaVersion: 1,
      exportedAt: "2026-08-19T00:00:00.000Z",
      contracts: [],
      history: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/local-data",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          schemaVersion: 1,
          exportedAt: "2026-08-19T00:00:00.000Z",
          contracts: [],
          history: [],
        }),
      })
    );
    expect(result.contractsImported).toBe(2);
  });

  it("throws server error messages", async () => {
    mockFetchOnce({ error: "chainId must be a positive integer" }, { ok: false, status: 400 });
    const store = await loadStore();

    await expect(
      store.upsertContract({
        name: "Bad",
        address: "0x1111111111111111111111111111111111111111",
        chainId: 0,
        abi: [],
      })
    ).rejects.toThrow("chainId must be a positive integer");
  });
});
