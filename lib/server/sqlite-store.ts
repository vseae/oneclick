import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  AddHistoryInput,
  ImportLocalDataResult,
  LocalContractRecord,
  LocalDataSnapshot,
  LocalHistoryRecord,
  UpdateContractInput,
  UpsertContractInput,
} from "@/lib/local-store";
import { assertContractInput, assertContractUpdate, contractInputSchema } from "@/lib/contract-validation";

type SqliteDatabase = Database.Database;

interface ContractRow {
  id: number;
  name: string;
  address: string;
  chainId: number;
  abi: string;
  createdAt: string;
  addressChainKey: string;
}

interface HistoryRow {
  id: number;
  contractId: number;
  contractName: string;
  contractAddress: string;
  methodName: string;
  methodType: "read" | "write";
  params: string;
  result: string | null;
  error: string | null;
  txHash: string | null;
  timestamp: string;
  chainId: number;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "app.sqlite");

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function buildAddressChainKey(chainId: number, address: string): string {
  return `${chainId}:${normalizeAddress(address)}`;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parsePositiveInteger(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

function assertValidChainId(chainId: unknown, fieldName: string): asserts chainId is number {
  if (!isPositiveInteger(chainId)) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

/**
 * History rows keep a denormalized snapshot of the contract name/address for
 * display. Keep those fields in sync when a contract is renamed or moved so the
 * System Log never shows a stale identity.
 */
function syncHistoryContractFields(
  db: SqliteDatabase,
  contractId: number,
  name: string,
  address: string
): void {
  db.prepare(
    "UPDATE history SET contractName = ?, contractAddress = ? WHERE contractId = ?"
  ).run(name, address, contractId);
}

function rowToContract(row: ContractRow): LocalContractRecord {
  return {
    ...row,
    abi: parseJson(row.abi),
  };
}

function rowToHistory(row: HistoryRow): LocalHistoryRecord {
  return {
    id: row.id,
    contractId: row.contractId,
    contractName: row.contractName,
    contractAddress: row.contractAddress,
    methodName: row.methodName,
    methodType: row.methodType,
    params: parseJson(row.params),
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    txHash: row.txHash ?? undefined,
    timestamp: row.timestamp,
    chainId: row.chainId,
  };
}

function ensureDatabaseDirectory(dbPath: string) {
  const dir = path.dirname(dbPath);
  mkdirSync(dir, { recursive: true });
}

function initializeSchema(db: SqliteDatabase) {
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      chainId INTEGER NOT NULL,
      abi TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      addressChainKey TEXT NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_contracts_chain_id
      ON contracts(chainId);

    CREATE TABLE IF NOT EXISTS history (
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
      chainId INTEGER NOT NULL,
      FOREIGN KEY(contractId) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_contract_id
      ON history(contractId);

    CREATE INDEX IF NOT EXISTS idx_history_timestamp
      ON history(timestamp);

    CREATE INDEX IF NOT EXISTS idx_history_chain_id
      ON history(chainId);
  `);
}

function prepareSnapshot(snapshot: LocalDataSnapshot) {
  if (!snapshot || !Array.isArray(snapshot.contracts) || !Array.isArray(snapshot.history)) {
    throw new Error("Invalid snapshot format");
  }

  type PreparedContract = {
    sourceId?: number;
    record: Omit<LocalContractRecord, "id"> & { id?: number };
  };

  type PreparedHistory = {
    sourceContractId: number;
    record: Omit<LocalHistoryRecord, "id" | "contractId"> & { id?: number };
  };

  const preparedContracts: PreparedContract[] = [];
  let invalidContractCount = 0;

  for (const item of snapshot.contracts) {
    if (!item || !item.name || !item.address || !item.abi) {
      invalidContractCount += 1;
      continue;
    }

    const chainId = parsePositiveInteger(item.chainId);
    if (!chainId) {
      invalidContractCount += 1;
      continue;
    }

    const parsed = contractInputSchema.safeParse({
      name: item.name,
      address: item.address,
      chainId,
      abi: item.abi,
    });
    if (!parsed.success) {
      invalidContractCount += 1;
      continue;
    }

    const normalizedAddress = normalizeAddress(parsed.data.address);
    const sourceId = typeof item.id === "number" && Number.isInteger(item.id) && item.id > 0 ? item.id : undefined;
    preparedContracts.push({
      sourceId,
      record: {
        id: sourceId,
        name: parsed.data.name,
        address: normalizedAddress,
        chainId,
        abi: parsed.data.abi,
        createdAt: item.createdAt ?? new Date().toISOString(),
        addressChainKey: buildAddressChainKey(chainId, normalizedAddress),
      },
    });
  }

  if (invalidContractCount > 0) {
    throw new Error("Snapshot contains invalid contract entries");
  }

  let historySkipped = 0;
  const preparedHistory: PreparedHistory[] = [];

  for (const item of snapshot.history) {
    if (!item) {
      historySkipped += 1;
      continue;
    }

    const sourceContractId = parsePositiveInteger(item.contractId);
    const chainId = parsePositiveInteger(item.chainId);
    if (!sourceContractId || !chainId) {
      historySkipped += 1;
      continue;
    }

    if (
      !item.contractName ||
      !item.contractAddress ||
      !item.methodName ||
      !item.methodType ||
      (item.methodType !== "read" && item.methodType !== "write") ||
      !Array.isArray(item.params)
    ) {
      historySkipped += 1;
      continue;
    }

    preparedHistory.push({
      sourceContractId,
      record: {
        id: typeof item.id === "number" && Number.isInteger(item.id) && item.id > 0 ? item.id : undefined,
        contractName: String(item.contractName),
        contractAddress: String(item.contractAddress),
        methodName: String(item.methodName),
        methodType: item.methodType,
        params: item.params,
        result: item.result,
        error: item.error,
        txHash: item.txHash,
        timestamp: item.timestamp ?? new Date().toISOString(),
        chainId,
      },
    });
  }

  return { preparedContracts, preparedHistory, historySkipped };
}

export function createSqliteStore(dbPath = DEFAULT_DB_PATH) {
  ensureDatabaseDirectory(dbPath);
  const db = new Database(dbPath);
  initializeSchema(db);

  const listContracts = (): LocalContractRecord[] => {
    const rows = db.prepare("SELECT * FROM contracts ORDER BY id DESC").all() as ContractRow[];
    return rows.map(rowToContract);
  };

  const listContractsByChainId = (chainId: number): LocalContractRecord[] => {
    const rows = db
      .prepare("SELECT * FROM contracts WHERE chainId = ? ORDER BY id DESC")
      .all(chainId) as ContractRow[];
    return rows.map(rowToContract);
  };

  const getContractById = (id: number): LocalContractRecord | null => {
    const row = db.prepare("SELECT * FROM contracts WHERE id = ?").get(id) as ContractRow | undefined;
    return row ? rowToContract(row) : null;
  };

  const upsertContract = (rawInput: UpsertContractInput): { id: number; updated: boolean } => {
    const input = assertContractInput(rawInput);
    const normalizedAddress = normalizeAddress(input.address);
    const addressChainKey = buildAddressChainKey(input.chainId, normalizedAddress);
    const existing = db
      .prepare("SELECT * FROM contracts WHERE addressChainKey = ?")
      .get(addressChainKey) as ContractRow | undefined;

    if (existing) {
      const updateExisting = db.transaction(() => {
        db.prepare(
          `UPDATE contracts
           SET name = ?, address = ?, chainId = ?, abi = ?, addressChainKey = ?
           WHERE id = ?`
        ).run(input.name, normalizedAddress, input.chainId, serializeJson(input.abi), addressChainKey, existing.id);
        syncHistoryContractFields(db, existing.id, input.name, normalizedAddress);
      });
      updateExisting();
      return { id: existing.id, updated: true };
    }

    const result = db.prepare(
      `INSERT INTO contracts (name, address, chainId, abi, createdAt, addressChainKey)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(input.name, normalizedAddress, input.chainId, serializeJson(input.abi), new Date().toISOString(), addressChainKey);

    return { id: Number(result.lastInsertRowid), updated: false };
  };

  const upsertContractsBatch = (contracts: UpsertContractInput[]) => {
    return contracts.map((contract) => {
      try {
        const result = upsertContract(contract);
        return {
          id: result.id,
          name: contract.name,
          success: true,
          updated: result.updated,
        };
      } catch (error) {
        return {
          name: contract.name,
          success: false,
          error: error instanceof Error ? error.message : "unknown error",
        };
      }
    });
  };

  const deleteContract = (id: number): void => {
    db.prepare("DELETE FROM contracts WHERE id = ?").run(id);
  };

  const deleteContracts = (ids: number[]): void => {
    if (ids.length === 0) {
      return;
    }

    const remove = db.transaction((contractIds: number[]) => {
      for (const id of contractIds) {
        db.prepare("DELETE FROM contracts WHERE id = ?").run(id);
      }
    });
    remove(ids);
  };

  const updateContractById = (id: number, rawUpdates: UpdateContractInput): void => {
    const updates = assertContractUpdate(rawUpdates);

    const existing = getContractById(id);
    if (!existing) {
      throw new Error("合约不存在，可能已被删除");
    }

    const nextName = updates.name ?? existing.name;
    const nextChainId = updates.chainId ?? existing.chainId;
    const nextAddress = normalizeAddress(updates.address ?? existing.address);
    const nextAbi = updates.abi ?? existing.abi;
    const nextAddressChainKey = buildAddressChainKey(nextChainId, nextAddress);
    const conflict = db
      .prepare("SELECT id FROM contracts WHERE addressChainKey = ?")
      .get(nextAddressChainKey) as { id: number } | undefined;

    if (conflict && conflict.id !== id) {
      throw new Error("当前网络已存在相同地址的合约");
    }

    const update = db.transaction(() => {
      db.prepare(
        `UPDATE contracts
         SET name = ?, address = ?, chainId = ?, abi = ?, addressChainKey = ?
         WHERE id = ?`
      ).run(nextName, nextAddress, nextChainId, serializeJson(nextAbi), nextAddressChainKey, id);
      syncHistoryContractFields(db, id, nextName, nextAddress);
    });
    update();
  };

  const addHistory = (input: AddHistoryInput): number => {
    assertValidChainId(input.chainId, "chainId");
    const result = db.prepare(
      `INSERT INTO history (
        contractId, contractName, contractAddress, methodName, methodType,
        params, result, error, txHash, timestamp, chainId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.contractId,
      input.contractName,
      input.contractAddress,
      input.methodName,
      input.methodType,
      serializeJson(input.params),
      input.result ?? null,
      input.error ?? null,
      input.txHash ?? null,
      input.timestamp ?? new Date().toISOString(),
      input.chainId
    );

    return Number(result.lastInsertRowid);
  };

  const updateHistory = (
    id: number,
    updates: Pick<LocalHistoryRecord, "result" | "error" | "txHash">
  ): void => {
    const existing = db.prepare("SELECT id FROM history WHERE id = ?").get(id);
    if (!existing) {
      throw new Error("History record not found");
    }

    db.prepare("UPDATE history SET result = ?, error = ?, txHash = ? WHERE id = ?").run(
      updates.result ?? null,
      updates.error ?? null,
      updates.txHash ?? null,
      id
    );
  };

  const listHistory = (options?: { contractId?: number; chainId?: number; limit?: number }): LocalHistoryRecord[] => {
    const filters: string[] = [];
    const values: number[] = [];

    if (typeof options?.contractId === "number") {
      filters.push("contractId = ?");
      values.push(options.contractId);
    }

    if (typeof options?.chainId === "number") {
      filters.push("chainId = ?");
      values.push(options.chainId);
    }

    const whereClause = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
    const rows = db
      .prepare(`SELECT * FROM history${whereClause} ORDER BY timestamp DESC, id DESC`)
      .all(...values) as HistoryRow[];

    const mapped = rows.map(rowToHistory);
    return typeof options?.limit === "number" && options.limit > 0 ? mapped.slice(0, options.limit) : mapped;
  };

  const clearHistory = (contractId?: number, chainId?: number): void => {
    const filters: string[] = [];
    const values: number[] = [];

    if (typeof contractId === "number") {
      filters.push("contractId = ?");
      values.push(contractId);
    }

    if (typeof chainId === "number") {
      filters.push("chainId = ?");
      values.push(chainId);
    }

    const whereClause = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
    db.prepare(`DELETE FROM history${whereClause}`).run(...values);
  };

  const clearAllLocalData = (): void => {
    const clear = db.transaction(() => {
      db.prepare("DELETE FROM history").run();
      db.prepare("DELETE FROM contracts").run();
    });
    clear();
  };

  const exportLocalData = (): LocalDataSnapshot => {
    const contracts = listContracts();
    const history = listHistory();

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      contracts: contracts.map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        chainId: item.chainId,
        abi: item.abi,
        createdAt: item.createdAt,
      })),
      history: history.map((item) => ({
        id: item.id,
        contractId: item.contractId,
        contractName: item.contractName,
        contractAddress: item.contractAddress,
        methodName: item.methodName,
        methodType: item.methodType,
        params: item.params,
        result: item.result,
        error: item.error,
        txHash: item.txHash,
        timestamp: item.timestamp,
        chainId: item.chainId,
      })),
    };
  };

  const importLocalData = (snapshot: LocalDataSnapshot): ImportLocalDataResult => {
    const { preparedContracts, preparedHistory, historySkipped: initialHistorySkipped } = prepareSnapshot(snapshot);
    const importTransaction = db.transaction(() => {
      db.prepare("DELETE FROM history").run();
      db.prepare("DELETE FROM contracts").run();

      const contractIdMap = new Map<number, number>();
      let contractsImported = 0;
      let historyImported = 0;
      let historySkipped = initialHistorySkipped;

      for (const item of preparedContracts) {
        const result = db.prepare(
          `INSERT INTO contracts (name, address, chainId, abi, createdAt, addressChainKey)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          item.record.name,
          item.record.address,
          item.record.chainId,
          serializeJson(item.record.abi),
          item.record.createdAt,
          item.record.addressChainKey
        );

        if (typeof item.sourceId === "number") {
          contractIdMap.set(item.sourceId, Number(result.lastInsertRowid));
        }
        contractsImported += 1;
      }

      for (const item of preparedHistory) {
        const mappedContractId = contractIdMap.get(item.sourceContractId);
        if (!mappedContractId) {
          historySkipped += 1;
          continue;
        }

        db.prepare(
          `INSERT INTO history (
            contractId, contractName, contractAddress, methodName, methodType,
            params, result, error, txHash, timestamp, chainId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          mappedContractId,
          item.record.contractName,
          item.record.contractAddress,
          item.record.methodName,
          item.record.methodType,
          serializeJson(item.record.params),
          item.record.result ?? null,
          item.record.error ?? null,
          item.record.txHash ?? null,
          item.record.timestamp,
          item.record.chainId
        );
        historyImported += 1;
      }

      return {
        contractsImported,
        historyImported,
        historySkipped,
      };
    });

    return importTransaction();
  };

  const close = (): void => {
    db.close();
  };

  return {
    listContracts,
    listContractsByChainId,
    getContractById,
    upsertContract,
    upsertContractsBatch,
    deleteContract,
    deleteContracts,
    updateContractById,
    addHistory,
    updateHistory,
    listHistory,
    clearHistory,
    clearAllLocalData,
    exportLocalData,
    importLocalData,
    close,
  };
}

let store: ReturnType<typeof createSqliteStore> | null = null;

export function getSqliteStore() {
  if (!store) {
    store = createSqliteStore();
  }
  return store;
}
