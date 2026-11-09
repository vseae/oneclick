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
      abi: [{ type: "function", name: "symbol", inputs: [], outputs: [], stateMutability: "view" }],
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

describe("sqlite-store contract directories", () => {
  it("persists directories, validates names and isolates them by network", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "contract-directories-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.sqlite");
    const store = createSqliteStore(dbPath);
    const directory = store.createDirectory({ name: "  Tokens  ", chainId: 1 });
    store.createDirectory({ name: "Tokens", chainId: 56 });
    const empty = store.createDirectory({ name: "Empty", chainId: 1 });

    expect(() => store.createDirectory({ name: "Tokens ", chainId: 1 })).toThrow("同名目录");
    expect(() => store.createDirectory({ name: " ", chainId: 1 })).toThrow("请输入目录名称");
    expect(() => store.createDirectory({ name: "Bad", chainId: 0 })).toThrow("正整数");
    expect(() => store.renameDirectory(empty.id, "Tokens")).toThrow("同名目录");
    expect(() => store.renameDirectory(directory.id, " ")).toThrow("请输入目录名称");
    store.renameDirectory(directory.id, "  Assets  ");
    store.close();

    const reopened = createSqliteStore(dbPath);
    expect(reopened.listDirectories(1).map((item) => item.name)).toEqual(["Assets", "Empty"]);
    expect(reopened.listDirectories(56).map((item) => item.name)).toEqual(["Tokens"]);
    reopened.close();
  });

  it("moves contracts and deleting a directory preserves contracts and System Log", () => {
    const store = createTempStore();
    const { id } = store.upsertContract({ name: "TokenA", address: TOKEN_A, chainId: 1, abi: [] });
    const directory = store.createDirectory({ name: "Tokens", chainId: 1 });
    const other = store.createDirectory({ name: "Other", chainId: 1 });
    store.addHistory({ contractId: id, contractName: "TokenA", contractAddress: TOKEN_A, methodName: "symbol", methodType: "read", params: [], result: "TKA", chainId: 1 });
    const original = store.getContractById(id);
    const history = store.listHistory();

    expect(store.moveContractToDirectory(id, { directoryId: directory.id })).toEqual({ ...original, directoryId: directory.id });
    store.moveContractToDirectory(id, { directoryId: other.id });
    expect(store.getContractById(id)?.directoryId).toBe(other.id);
    store.moveContractToDirectory(id, { directoryId: null });
    expect(store.getContractById(id)).toEqual(original);
    store.moveContractToDirectory(id, { directoryId: directory.id });
    store.deleteDirectory(directory.id);

    expect(store.getContractById(id)).toEqual(original);
    expect(store.listHistory()).toEqual(history);
    expect(store.listDirectories()).toEqual([other]);
  });

  it("rejects missing or foreign-network destinations without modifying the contract", () => {
    const store = createTempStore();
    const { id } = store.upsertContract({ name: "TokenA", address: TOKEN_A, chainId: 1, abi: [] });
    const foreign = store.createDirectory({ name: "Tokens", chainId: 56 });
    expect(() => store.moveContractToDirectory(id, { directoryId: foreign.id })).toThrow("其他网络");
    expect(() => store.moveContractToDirectory(id, { directoryId: 999 })).toThrow("目录不存在");
    expect(() => store.moveContractToDirectory(id, { directoryId: -1 })).toThrow("请选择目录");
    expect(() => store.moveContractToDirectory(id, {} as never)).toThrow("请选择目录");
    expect(() => store.moveContractToDirectory(id, { directoryId: null, newDirectoryName: "Both" } as never)).toThrow("请选择目录");
    expect(() => store.moveContractToDirectory(999, { newDirectoryName: "Ghost" })).toThrow("合约不存在");
    expect(store.listDirectories()).toEqual([foreign]);
    expect(store.getContractById(id)?.directoryId).toBeNull();
  });

  it("creates a directory and moves atomically, preserves membership on reimport and ungroups when changing network", () => {
    const store = createTempStore();
    const input = { name: "TokenA", address: TOKEN_A, chainId: 1, abi: [] };
    const { id } = store.upsertContract(input);
    const moved = store.moveContractToDirectory(id, { newDirectoryName: "Tokens" });
    expect(store.listDirectories()).toEqual([{ id: moved.directoryId, name: "Tokens", chainId: 1 }]);
    expect(() => store.moveContractToDirectory(id, { newDirectoryName: "Tokens" })).toThrow("同名目录");
    expect(store.getContractById(id)?.directoryId).toBe(moved.directoryId);
    store.upsertContract({ ...input, name: "Updated" });
    expect(store.getContractById(id)?.directoryId).toBe(moved.directoryId);
    store.updateContractById(id, { chainId: 56 });
    expect(store.getContractById(id)?.directoryId).toBeNull();
  });

  it("upgrades an existing contracts table without losing contracts or history", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "contract-directories-legacy-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.sqlite");
    const legacy = new Database(dbPath);
    legacy.exec(`CREATE TABLE contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT NOT NULL,
      chainId INTEGER NOT NULL, abi TEXT NOT NULL, createdAt TEXT NOT NULL, addressChainKey TEXT NOT NULL UNIQUE
    );
    CREATE TABLE history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, contractId INTEGER NOT NULL,
      contractName TEXT NOT NULL, contractAddress TEXT NOT NULL, methodName TEXT NOT NULL,
      methodType TEXT NOT NULL, params TEXT NOT NULL, result TEXT, error TEXT, txHash TEXT,
      timestamp TEXT NOT NULL, chainId INTEGER NOT NULL,
      FOREIGN KEY(contractId) REFERENCES contracts(id) ON DELETE CASCADE
    )`);
    legacy.prepare("INSERT INTO contracts VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(12, "TokenA", TOKEN_A, 1, "[]", "2026-01-01", `1:${TOKEN_A}`);
    legacy.prepare("INSERT INTO history (contractId, contractName, contractAddress, methodName, methodType, params, result, timestamp, chainId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(12, "TokenA", TOKEN_A, "symbol", "read", "[]", "TKA", "2026-01-01", 1);
    legacy.close();

    const store = createSqliteStore(dbPath);
    expect(store.getContractById(12)).toMatchObject({ name: "TokenA", directoryId: null });
    const history = store.listHistory();
    expect(history).toEqual([expect.objectContaining({ contractId: 12, contractName: "TokenA", result: "TKA" })]);
    const directory = store.createDirectory({ name: "Tokens", chainId: 1 });
    store.moveContractToDirectory(12, { directoryId: directory.id });
    store.deleteDirectory(directory.id);
    expect(store.getContractById(12)?.directoryId).toBeNull();
    expect(store.listHistory()).toEqual(history);
    store.close();
  });

  it("round-trips directories, empty directories, membership and history with remapped IDs", () => {
    const store = createTempStore();
    const { id } = store.upsertContract({ name: "TokenA", address: TOKEN_A, chainId: 1, abi: [] });
    store.moveContractToDirectory(id, { newDirectoryName: "Tokens" });
    store.createDirectory({ name: "Empty", chainId: 56 });
    store.addHistory({ contractId: id, contractName: "TokenA", contractAddress: TOKEN_A, methodName: "symbol", methodType: "read", params: [], chainId: 1 });
    const snapshot = store.exportLocalData();
    expect(snapshot.schemaVersion).toBe(2);

    store.importLocalData(snapshot);
    const restored = store.listContracts()[0];
    const directory = store.listDirectories(1)[0];
    expect(restored.id).not.toBe(id);
    expect(restored.directoryId).toBe(directory.id);
    expect(directory.id).not.toBe(snapshot.contracts[0].directoryId);
    expect(store.listDirectories(56)[0].name).toBe("Empty");
    expect(store.listHistory()[0].contractId).toBe(restored.id);
  });

  it("rejects invalid backups atomically and restores old backups as ungrouped", () => {
    const store = createTempStore();
    const { id } = store.upsertContract({ name: "TokenA", address: TOKEN_A, chainId: 1, abi: [] });
    store.moveContractToDirectory(id, { newDirectoryName: "Tokens" });
    const snapshot = store.exportLocalData();
    expect(() => store.importLocalData({ ...snapshot, directories: [] })).toThrow("directory references");
    expect(() => store.importLocalData({ ...snapshot, directories: snapshot.directories!.map((item) => ({ ...item, chainId: 56 })) })).toThrow("directory references");
    expect(() => store.importLocalData({ ...snapshot, directories: [...snapshot.directories!, { id: 999, name: "Tokens", chainId: 1 }] })).toThrow();
    expect(store.listContracts()[0].directoryId).toBe(snapshot.contracts[0].directoryId);
    expect(store.listDirectories()).toEqual(snapshot.directories);

    store.importLocalData({ schemaVersion: 1, exportedAt: snapshot.exportedAt, contracts: snapshot.contracts, history: snapshot.history });
    expect(store.listContracts()[0].directoryId).toBeNull();
    expect(store.listDirectories()).toEqual([]);
    store.createDirectory({ name: "Empty", chainId: 1 });
    store.clearAllLocalData();
    expect(store.listDirectories()).toEqual([]);
    expect(store.listContracts()).toEqual([]);
  });
});

describe("sqlite-store bulk contract operations", () => {
  function seedBatch() {
    const store = createTempStore();
    const ids = [TOKEN_A, TOKEN_B, "0x3333333333333333333333333333333333333333"].map((address, index) => {
      const { id } = store.upsertContract({ name: `Token${index}`, address, chainId: 1, abi: [] });
      store.addHistory({ contractId: id, contractName: `Token${index}`, contractAddress: address, methodName: "symbol", methodType: "read", params: [], chainId: 1 });
      return id;
    });
    return { store, ids };
  }

  it("moves only selected contracts together and preserves their logs", () => {
    const { store, ids } = seedBatch();
    const first = store.createDirectory({ name: "First", chainId: 1 });
    const destination = store.createDirectory({ name: "Destination", chainId: 1 });
    store.moveContractToDirectory(ids[0], { directoryId: first.id });
    const history = store.listHistory();
    const untouched = store.getContractById(ids[2]);

    const moved = store.moveContractsToDirectory([ids[0], ids[1], ids[0]], 1, { directoryId: destination.id });
    expect(moved.map((contract) => contract.id)).toEqual(ids.slice(0, 2));
    expect(moved.every((contract) => contract.directoryId === destination.id)).toBe(true);
    expect(store.getContractById(ids[2])).toEqual(untouched);
    expect(store.listHistory()).toEqual(history);
    store.moveContractsToDirectory(ids.slice(0, 2), 1, { directoryId: null });
    expect(store.listContracts().every((contract) => contract.directoryId === null)).toBe(true);
  });

  it("creates one directory for the entire batch and rejects duplicate names without moving anything", () => {
    const { store, ids } = seedBatch();
    const moved = store.moveContractsToDirectory(ids, 1, { newDirectoryName: "  Tokens  " });
    expect(store.listDirectories()).toEqual([{ id: moved[0].directoryId, name: "Tokens", chainId: 1 }]);
    expect(new Set(moved.map((contract) => contract.directoryId)).size).toBe(1);
    const before = store.listContracts();
    expect(() => store.moveContractsToDirectory(ids, 1, { newDirectoryName: "Tokens" })).toThrow("同名目录");
    expect(store.listContracts()).toEqual(before);
  });

  it("validates the entire selection before moving or deleting", () => {
    const { store, ids } = seedBatch();
    const foreign = store.upsertContract({ name: "Foreign", address: TOKEN_A, chainId: 56, abi: [] });
    const directory = store.createDirectory({ name: "Foreign", chainId: 56 });
    const before = store.listContracts();
    const history = store.listHistory();
    expect(() => store.moveContractsToDirectory([ids[0], 999], 1, { newDirectoryName: "Ghost" })).toThrow("不存在");
    expect(() => store.moveContractsToDirectory([ids[0], foreign.id], 1, { newDirectoryName: "Ghost" })).toThrow("当前网络");
    expect(() => store.moveContractsToDirectory(ids, 1, { directoryId: directory.id })).toThrow("其他网络");
    expect(() => store.deleteContracts([ids[0], 999], 1)).toThrow("不存在");
    expect(() => store.deleteContracts([ids[0], foreign.id], 1)).toThrow("当前网络");
    expect(() => store.deleteContracts([], 1)).toThrow("至少选择");
    expect(() => store.deleteContracts([-1], 1)).toThrow();
    expect(() => store.deleteContracts(ids, 0)).toThrow("正整数");
    expect(store.listContracts()).toEqual(before);
    expect(store.listHistory()).toEqual(history);
    expect(store.listDirectories()).toEqual([directory]);
  });

  it("deletes selected contracts and their logs while preserving unselected contracts and directories", () => {
    const { store, ids } = seedBatch();
    const directory = store.createDirectory({ name: "Tokens", chainId: 1 });
    store.moveContractsToDirectory(ids.slice(0, 2), 1, { directoryId: directory.id });
    const untouched = store.getContractById(ids[2]);
    store.deleteContracts([ids[0], ids[1], ids[0]], 1);
    expect(store.listContracts()).toEqual([untouched]);
    expect(store.listHistory()).toEqual([expect.objectContaining({ contractId: ids[2] })]);
    expect(store.listDirectories()).toEqual([directory]);
  });

  it("rolls back earlier updates, newly created directories and cascaded logs when a later database write fails", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "contracts-batch-atomic-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "app.sqlite");
    const store = createSqliteStore(dbPath);
    const first = store.upsertContract({ name: "First", address: TOKEN_A, chainId: 1, abi: [] });
    const second = store.upsertContract({ name: "Second", address: TOKEN_B, chainId: 1, abi: [] });
    store.addHistory({ contractId: first.id, contractName: "First", contractAddress: TOKEN_A, methodName: "symbol", methodType: "read", params: [], chainId: 1 });
    const db = new Database(dbPath);
    db.exec(`
      CREATE TRIGGER reject_batch_move BEFORE UPDATE OF directoryId ON contracts WHEN OLD.id = ${second.id}
      BEGIN SELECT RAISE(ABORT, 'test move failure'); END;
      CREATE TRIGGER reject_batch_delete BEFORE DELETE ON contracts WHEN OLD.id = ${second.id}
      BEGIN SELECT RAISE(ABORT, 'test delete failure'); END;
    `);
    const contracts = store.listContracts();
    const history = store.listHistory();
    expect(() => store.moveContractsToDirectory([first.id, second.id], 1, { newDirectoryName: "Rollback" })).toThrow("test move failure");
    expect(store.listDirectories()).toEqual([]);
    expect(store.listContracts()).toEqual(contracts);
    expect(() => store.deleteContracts([first.id, second.id], 1)).toThrow("test delete failure");
    expect(store.listContracts()).toEqual(contracts);
    expect(store.listHistory()).toEqual(history);
    db.close();
    store.close();
  });
});
