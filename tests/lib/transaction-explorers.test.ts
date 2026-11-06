import { describe, expect, it } from "vitest";
import { getTransactionExplorers } from "@/lib/transaction-explorers";

const hash = `0x${"a".repeat(64)}`;

describe("transaction explorers", () => {
  it.each([
    [1, "https://etherscan.io"],
    [11155111, "https://sepolia.etherscan.io"],
    [146, "https://sonicscan.org"],
    [14601, "https://testnet.sonicscan.org"],
    [43114, "https://snowtrace.io"],
    [43113, "https://testnet.snowtrace.io"],
    [7200, "https://scan.exsat.network"],
    [840000, "https://scan-testnet.exsat.network"],
    [143, "https://monadvision.com"],
    [10143, "https://testnet.monadexplorer.com"],
  ])("uses the configured explorer for chain %i", (chainId, baseUrl) => {
    expect(getTransactionExplorers(chainId, hash)[0].url).toBe(`${baseUrl}/tx/${hash}`);
  });

  it("offers the configured alternatives for Monad", () => {
    expect(getTransactionExplorers(143, hash).map((explorer) => explorer.name)).toEqual([
      "MonadVision", "Monadscan",
    ]);
  });

  it("does not guess an explorer for an unknown chain", () => {
    expect(getTransactionExplorers(64165, hash)).toEqual([]);
    expect(getTransactionExplorers(57054, hash)).toEqual([]);
  });
});
