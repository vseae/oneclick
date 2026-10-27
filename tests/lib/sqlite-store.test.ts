import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
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
    ).toThrow("链 ID 必须是正整数");
  });

  it("validates contract fields before writing", () => {
    const store = createTempStore();

    expect(() =>
      store.upsertContract({
        name: "BadAddress",
        address: "0x123",
        chainId: 1,
        abi: [],
      })
    ).toThrow("无效的合约地址");

    expect(() =>
      store.upsertContract({
        name: "   ",
        address: TOKEN_A,
        chainId: 1,
        abi: [],
      })
    ).toThrow("请输入合约名称");

    expect(() =>
      store.upsertContract({
        name: "BadAbi",
        address: TOKEN_A,
        chainId: 1,
        abi: {} as never,
      })
    ).toThrow("ABI 必须是合法的 JSON ABI 数组");

    const { id } = store.upsertContract({
      name: "Valid",
      address: TOKEN_A,
      chainId: 1,
      abi: [],
    });

    expect(() => store.updateContractById(id, { address: "0x123" })).toThrow("无效的合约地址");
    expect(() => store.updateContractById(id, { name: "  " })).toThrow("请输入合约名称");
    expect(() => store.updateContractById(id, { abi: {} as never })).toThrow("ABI 必须是合法的 JSON ABI 数组");
    expect(store.getContractById(id)).toEqual(
      expect.objectContaining({ name: "Valid", address: TOKEN_A })
    );

    expect(() => store.updateContractById(999, { name: "Missing" })).toThrow("合约不存在");
  });

  it("keeps history contract identity in sync when a contract is edited", () => {
    const store = createTempStore();
    const { id } = store.upsertContract({
      name: "OldName",
      address: TOKEN_A,
      chainId: 1,
      abi: [],
    });

    store.addHistory({
      contractId: id,
      contractName: "OldName",
      contractAddress: TOKEN_A,
      methodName: "symbol",
      methodType: "read",
      params: [],
      result: "TKA",
      chainId: 1,
    });

    store.updateContractById(id, { name: "NewName", address: TOKEN_B });

    expect(store.listHistory()).toEqual([
      expect.objectContaining({
        contractId: id,
        contractName: "NewName",
        contractAddress: TOKEN_B,
      }),
    ]);
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

  it("stores the payable value attached to a write", () => {
    const store = createTempStore();
    const { id } = store.upsertContract({
      name: "Vault",
      address: TOKEN_A,
      chainId: 1,
      abi: [],
    });

    store.addHistory({
      contractId: id,
      contractName: "Vault",
      contractAddress: TOKEN_A,
      methodName: "deposit",
      methodType: "write",
      params: [],
      value: "1500000000000000000",
      chainId: 1,
    });
    store.addHistory({
      contractId: id,
      contractName: "Vault",
      contractAddress: TOKEN_A,
      methodName: "deposit",
      methodType: "write",
      params: [],
      // Garbage values must never reach the column.
      value: "not-a-number",
      chainId: 1,
    });

    const history = store.listHistory();
    expect(history.filter((item) => item.value)).toEqual([
      expect.objectContaining({ methodName: "deposit", value: "1500000000000000000" }),
    ]);

    const exported = store.exportLocalData();
    expect(exported.history.filter((item) => item.value)).toEqual([
      expect.objectContaining({ value: "1500000000000000000" }),
    ]);
  });

  it("adds the payable value column to a pre-existing database", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "contracts-sqlite-legacy-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.sqlite");

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contractId INTEGER NOT NULL,
        contractName TEXT NOT NULL,
        contractAddress TEXT NOT NULL,
        methodName TEXT NOT NULL,
        methodType TEXT NOT NULL CHECK(methodType IN ('read', 'write')),
        params TEXT NOT NULL,
        result TEXT,
        error TEXT,
        txHash TEXT,
        timestamp TEXT NOT NULL,
        chainId INTEGER NOT NULL
      );
    `);
    legacy.close();

    const store = createSqliteStore(dbPath);
    const { id } = store.upsertContract({
      name: "Vault",
      address: TOKEN_A,
      chainId: 1,
      abi: [],
    });
    store.addHistory({
      contractId: id,
      contractName: "Vault",
      contractAddress: TOKEN_A,
      methodName: "deposit",
      methodType: "write",
      params: [],
      value: "42",
      chainId: 1,
    });

    expect(store.listHistory()).toEqual([
      expect.objectContaining({ contractId: id, value: "42" }),
    ]);
  });
});
