import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  isPayableMethod,
  isReadMethod,
  isWriteMethod,
  parseMethodParam,
  parseMethodParams,
} from "../../lib/contract-utils";

const abi = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function deposit() payable",
  "function setValues(uint256[] values, bool enabled)",
  "function balanceOf(address owner) view returns (uint256)",
];

describe("method param parsing", () => {
  it("parses primitives by ABI type", () => {
    expect(parseMethodParam("uint256", "42")).toBe(BigInt(42));
    expect(parseMethodParam("uint256", "")).toBe(BigInt(0));
    expect(parseMethodParam("int128", "-5")).toBe(BigInt(-5));
    expect(parseMethodParam("bool", "true")).toBe(true);
    expect(parseMethodParam("bool", "false")).toBe(false);
    expect(parseMethodParam("address", "0xabc")).toBe("0xabc");
    expect(parseMethodParam("string", "hello")).toBe("hello");
  });

  it("parses arrays as JSON", () => {
    expect(parseMethodParam("uint256[]", "[1,2]")).toEqual([1, 2]);
    expect(parseMethodParam("uint256[]", "")).toEqual([]);
    expect(() => parseMethodParam("uint256[]", "not-json")).toThrow();
  });

  it("maps every input of a function fragment", () => {
    const iface = new ethers.Interface(abi);
    const transfer = iface.getFunction("transfer")!;
    expect(parseMethodParams(transfer, ["0x0000000000000000000000000000000000000001", "100"])).toEqual([
      "0x0000000000000000000000000000000000000001",
      BigInt(100),
    ]);

    const setValues = iface.getFunction("setValues")!;
    expect(parseMethodParams(setValues, ["[7,8]", "true"])).toEqual([[7, 8], true]);
  });

  it("falls back to zero for missing raw inputs", () => {
    const iface = new ethers.Interface(abi);
    const transfer = iface.getFunction("transfer")!;
    expect(parseMethodParams(transfer, [])).toEqual(["", BigInt(0)]);
  });
});

describe("method classification", () => {
  it("classifies read, write and payable methods", () => {
    const iface = new ethers.Interface(abi);
    const balanceOf = iface.getFunction("balanceOf")!;
    const deposit = iface.getFunction("deposit")!;
    const transfer = iface.getFunction("transfer")!;

    expect(isReadMethod(balanceOf)).toBe(true);
    expect(isWriteMethod(balanceOf)).toBe(false);

    expect(isWriteMethod(transfer)).toBe(true);
    expect(isPayableMethod(transfer)).toBe(false);

    expect(isWriteMethod(deposit)).toBe(true);
    expect(isPayableMethod(deposit)).toBe(true);
  });
});

describe("payable detection", () => {
  it("honours the legacy payable flag when stateMutability is missing", () => {
    const iface = new ethers.Interface([
      { type: "function", name: "deposit", inputs: [], outputs: [], payable: true } as never,
      { type: "function", name: "withdraw", inputs: [], outputs: [], stateMutability: "nonpayable" } as never,
    ]);

    expect(isPayableMethod(iface.getFunction("deposit")!)).toBe(true);
    expect(isPayableMethod(iface.getFunction("withdraw")!)).toBe(false);
  });
});
