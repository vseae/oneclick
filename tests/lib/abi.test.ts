import { describe, expect, it } from "vitest";
import { createPublicClient, custom, encodeErrorResult, encodeFunctionData, parseAbi } from "viem";
import { abiSelector, functionAbi, normalizeAbi } from "../../lib/abi";
import { getReadableContractError, parseMethodParams } from "../../lib/contract-utils";
import { contractAbiSchema } from "../../lib/contract-validation";

const address = "0x1111111111111111111111111111111111111111";

describe("viem ABI handling", () => {
  it("rejects malformed ABI items before saving or rendering them", () => {
    expect(contractAbiSchema.safeParse([{ type: "function" }]).success).toBe(false);
    expect(contractAbiSchema.safeParse([{ type: "function", name: "f", inputs: [{ type: "tuple" }] }]).success).toBe(false);
    expect(contractAbiSchema.safeParse([{ type: "unknown" }]).success).toBe(false);
  });

  it("encodes the selected overload with nested tuple input", () => {
    const abi = normalizeAbi(parseAbi([
      "function submit(uint256 value)",
      "function submit((address owner, uint256 amount) order)",
    ]));
    const methods = abi.filter((item) => item.type === "function");
    const tupleMethod = methods[1];
    const args = parseMethodParams(tupleMethod, [`{"owner":"${address}","amount":"42"}`]);
    const data = encodeFunctionData({ abi: [tupleMethod], functionName: "submit", args });
    expect(data.slice(0, 10)).toBe(abiSelector(tupleMethod));
    expect(abiSelector(tupleMethod)).not.toBe(abiSelector(methods[0]));
    expect(data).toBe(`${abiSelector(tupleMethod)}${"0".repeat(24)}${address.slice(2)}${"0".repeat(62)}2a`);
  });

  it("decodes a custom revert returned by a simulated contract call", async () => {
    const abi = parseAbi([
      "function submit(uint256 amount)",
      "error InsufficientBalance(uint256 available)",
    ]);
    const method = abi[0];
    const data = encodeErrorResult({ abi, errorName: "InsufficientBalance", args: [BigInt(7)] });
    const client = createPublicClient({ transport: custom({ request: async () => { throw { code: 3, message: "execution reverted", data }; } }) });
    try {
      await client.simulateContract({ address, abi: functionAbi(method, abi), functionName: method.name, args: [BigInt(8)], account: address });
      throw new Error("expected revert");
    } catch (error) {
      expect(getReadableContractError(error)).toContain("InsufficientBalance(7)");
    }
  });
});
