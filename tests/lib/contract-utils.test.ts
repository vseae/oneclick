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
  it("rejects missing values and invalid booleans without changing their meaning", () => {
    expect(() => parseMethodParam("uint256", "")).toThrow();
    expect(() => parseMethodParam("bool", "")).toThrow();
    expect(() => parseMethodParam("bool", "anything")).toThrow();
    expect(parseMethodParam("bool", "true")).toBe(true);
    expect(parseMethodParam("bool", "false")).toBe(false);
    expect(parseMethodParam("string", "")).toBe("");
    expect(parseMethodParam("string", '""')).toBe('""');
    expect(parseMethodParam("string", "  hello  ")).toBe("  hello  ");
  });

  it("checks integer boundaries, addresses, and exact byte lengths", () => {
    expect(parseMethodParam("int8", "-128")).toBe(BigInt(-128));
    expect(parseMethodParam("uint8", "255")).toBe(BigInt(255));
    expect(() => parseMethodParam("int8", "-129")).toThrow(/范围/);
    expect(() => parseMethodParam("uint8", "256")).toThrow(/范围/);
    expect(() => parseMethodParam("uint8", "-1")).toThrow(/范围/);
    expect(() => parseMethodParam("address", "0xabc")).toThrow(/地址/);
    expect(parseMethodParam("bytes", "0x")).toBe("0x");
    expect(parseMethodParam("bytes2", "0x1234")).toBe("0x1234");
    expect(() => parseMethodParam("bytes2", "0x12")).toThrow(/2 字节/);
    expect(() => parseMethodParam("bytes", "0xabc")).toThrow();
  });

  it("validates fixed and nested arrays without JSON number precision loss", () => {
    expect(parseMethodParam("uint256[2]", '["9007199254740993","2"]')).toEqual([BigInt("9007199254740993"), BigInt(2)]);
    expect(parseMethodParam("uint8[]", "[]")).toEqual([]);
    expect(() => parseMethodParam("uint8[2]", '["1"]')).toThrow(/2 个元素/);
    expect(() => parseMethodParam("uint256[]", "[9007199254740993]")).toThrow();
    expect(() => parseMethodParam("uint8[]", "")).toThrow();
    expect(() => parseMethodParam("uint8[]", "not-json")).toThrow();
    expect(() => parseMethodParam("uint8[][]", '[["256"]]')).toThrow(/\[0\]\[0\]/);
  });

  it("validates tuple arrays and objects recursively", () => {
    const param = ethers.ParamType.from("tuple(address owner, uint8 amount, string note, bool active)");
    const address = "0x0000000000000000000000000000000000000001";
    expect(parseMethodParam(param, JSON.stringify([address, "5", "", true]))).toEqual([address, BigInt(5), "", true]);
    expect(parseMethodParam(param, JSON.stringify({ owner: address, amount: "5", note: "", active: true }))).toEqual([address, BigInt(5), "", true]);
    expect(() => parseMethodParam(param, JSON.stringify({ owner: address, amount: "5", note: "" }))).toThrow(/字段/);
    expect(() => parseMethodParam(param, `{"owner":"${address}","amount":"5","amount":"6","note":"","active":true}`)).toThrow(/重复字段/);
    expect(() => parseMethodParam(param, JSON.stringify([address, "256", "", true]))).toThrow(/amount/);
    expect(() => parseMethodParam(param, JSON.stringify([address, "5", "", "true"]))).toThrow(/active/);
  });

  it("requires every non-string input and keeps ABI field names in errors", () => {
    const iface = new ethers.Interface(abi);
    const transfer = iface.getFunction("transfer")!;
    expect(() => parseMethodParams(transfer, [])).toThrow(/to/);
    const setValues = iface.getFunction("setValues")!;
    expect(parseMethodParams(setValues, ['["7","8"]', "true"])).toEqual([[BigInt(7), BigInt(8)], true]);
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
