import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteStore } from "../../lib/server/sqlite-store";

const TOKEN_A = "0x1111111111111111111111111111111111111111";
const TOKEN_B = "0x2222222222222222222222222222222222222222";

let tempDirs: string[] = [];

function createTempStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "contracts-sqlite-"));
  tempDirs.push(dir);
  return createSqliteStore(path.join(dir, "app.sqlite"));
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("sqlite-store contracts", () => {
  it("creates and updates contracts by address and chain", () => {
    const store = createTempStore();

    const created = store.upsertContract({
      name: "TokenA",
      address: TOKEN_A.toUpperCase(),
      chainId: 1,
      abi: [],
    });
    const updated = store.upsertContract({
      name: "TokenA v2",
      address: TOKEN_A,
      chainId: 1,
      abi: [{ type: "function", name: "symbol", inputs: [], outputs: [] }],
    });

    expect(created.updated).toBe(false);
    expect(updated).toEqual({ id: created.id, updated: true });
    expect(store.listContracts()).toEqual([
      expect.objectContaining({
        id: created.id,
        name: "TokenA v2",
        address: TOKEN_A,
        chainId: 1,
        addressChainKey: `1:${TOKEN_A}`,
      }),
    ]);
  });

  it("rejects non-positive chain ids", () => {
    const store = createTempStore();

    expect(() =>
      store.upsertContract({
        name: "BadChain",
        address: TOKEN_A,
        chainId: 0,
        abi: [],
      })
    ).toThrow("chainId must be a positive integer");
  });

  it("deletes contract history through foreign key cascade", () => {
    const store = createTempStore();
    const { id } = store.upsertContract({
      name: "TokenA",
      address: TOKEN_A,
      chainId: 1,
      abi: [],
    });

    store.addHistory({
      contractId: id,
      contractName: "TokenA",
      contractAddress: TOKEN_A,
      methodName: "symbol",
      methodType: "read",
      params: [],
      result: "TKA",
      chainId: 1,
    });

    store.deleteContract(id);

    expect(store.listContracts()).toHaveLength(0);
    expect(store.listHistory()).toHaveLength(0);
  });

  it("filters history by chain id", () => {
    const store = createTempStore();
    const tokenA = store.upsertContract({
      name: "TokenA",
      address: TOKEN_A,
      chainId: 1,
      abi: [],
    });
    const tokenB = store.upsertContract({
      name: "TokenB",
      address: TOKEN_B,
      chainId: 56,
      abi: [],
    });

    store.addHistory({
      contractId: tokenA.id,
      contractName: "TokenA",
      contractAddress: TOKEN_A,
      methodName: "symbol",
      methodType: "read",
      params: [],
      result: "TKA",
      chainId: 1,
    });
    store.addHistory({
      contractId: tokenB.id,
      contractName: "TokenB",
      contractAddress: TOKEN_B,
      methodName: "symbol",
      methodType: "read",
      params: [],
      result: "TKB",
      chainId: 56,
    });

    expect(store.listHistory({ chainId: 1 })).toHaveLength(1);
    expect(store.listHistory({ chainId: 1 })[0].contractName).toBe("TokenA");
    expect(store.listHistory({ chainId: 56 })[0].contractName).toBe("TokenB");
  });
});

describe("sqlite-store importLocalData", () => {
  it("keeps existing data when snapshot contracts are invalid", () => {
    const store = createTempStore();

    store.upsertContract({
      name: "TokenA",
      address: TOKEN_A,
      chainId: 1,
      abi: [],
    });

    expect(() =>
      store.importLocalData({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        contracts: [
          {
            name: "Bad",
            address: "invalid-address",
            chainId: 1,
            abi: [],
          },
        ],
        history: [],
      })
    ).toThrow("Snapshot contains invalid contract entries");

    expect(store.listContracts()).toHaveLength(1);
    expect(store.listContracts()[0].name).toBe("TokenA");
  });

  it("imports contracts and remaps history contractId atomically", () => {
    const store = createTempStore();

    const result = store.importLocalData({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      contracts: [
        {
          id: 10,
          name: "TokenA",
          address: TOKEN_A,
          chainId: 1,
          abi: [],
        },
        {
          id: 20,
          name: "TokenB",
          address: TOKEN_B,
          chainId: 56,
          abi: [],
        },
      ],
      history: [
        {
          id: 1,
          contractId: 10,
          contractName: "TokenA",
          contractAddress: TOKEN_A,
          methodName: "symbol",
          methodType: "read",
          params: [],
          result: "TKA",
          chainId: 1,
        },
        {
          id: 2,
          contractId: 999,
          contractName: "Ghost",
          contractAddress: "0x9999999999999999999999999999999999999999",
          methodName: "name",
          methodType: "read",
          params: [],
          result: "Ghost",
          chainId: 1,
        },
      ],
    });

    const contracts = store.listContracts();
    const tokenA = contracts.find((item) => item.name === "TokenA");

    expect(result).toEqual({
      contractsImported: 2,
      historyImported: 1,
      historySkipped: 1,
    });
    expect(contracts).toHaveLength(2);
    expect(tokenA).toBeDefined();
    expect(store.listHistory()).toEqual([
      expect.objectContaining({
        contractId: tokenA!.id,
        contractName: "TokenA",
        methodName: "symbol",
      }),
    ]);
  });
});
