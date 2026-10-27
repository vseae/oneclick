import { describe, expect, it } from "vitest";
import { Interface, id } from "ethers";
import {
  decodeRawLogWithAbi,
  decodeRawLogWithLocalAbis,
  decodeRawLogWithSignature,
  formatEventArgument,
  isHashedEventParamType,
  normalizeRawLogInput,
  parseEventSignature,
} from "../../lib/event-log";

const transferAbi = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const transferIface = new Interface(transferAbi);
const transferFragment = transferIface.getEvent("Transfer")!;

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";

const transferLog = transferIface.encodeEventLog(transferFragment, [FROM, TO, BigInt(1000)]);

describe("raw log input normalization", () => {
  it("trims fields and normalizes empty data to 0x", () => {
    expect(
      normalizeRawLogInput({
        topics: [`  ${id("Ping()")}  `, "", ""],
        data: "   ",
      })
    ).toEqual({ topics: [id("Ping()")], data: "0x" });
  });

  it("accepts a full log with data", () => {
    expect(
      normalizeRawLogInput({
        topics: transferLog.topics,
        data: ` ${transferLog.data} `,
      })
    ).toEqual({ topics: [...transferLog.topics], data: transferLog.data });
  });

  it("strips pasted whitespace and accepts an uppercase 0X prefix", () => {
    expect(
      normalizeRawLogInput({
        topics: [`0X${id("Ping()").slice(2).toUpperCase()}\n`],
        data: "  0X 12 34 AB  ",
      })
    ).toEqual({ topics: [`0x${id("Ping()").slice(2)}`], data: "0x1234ab" });
  });

  it("rejects empty topics, gaps and malformed hex", () => {
    expect(() => normalizeRawLogInput({ topics: [] })).toThrow("TOPIC_0");
    expect(() =>
      normalizeRawLogInput({ topics: [id("Ping()"), "", id("Ping()")] })
    ).toThrow("连续");

    expect(() => normalizeRawLogInput({ topics: ["0x1234"] })).toThrow("32 字节");
    expect(() =>
      normalizeRawLogInput({ topics: [id("Ping()")], data: "0x123" })
    ).toThrow("偶数位");
    expect(() =>
      normalizeRawLogInput({ topics: [id("Ping()")], data: "0xzz" })
    ).toThrow("十六进制");
  });

  it("rejects more than four topics", () => {
    expect(() =>
      normalizeRawLogInput({ topics: [id("Ping()"), id("Ping()"), id("Ping()"), id("Ping()"), id("Ping()")] })
    ).toThrow("最多");
  });
});

describe("event signature parsing", () => {
  it("parses canonical event signatures", () => {
    expect(parseEventSignature("Transfer(address,address,uint256)")).toEqual({
      name: "Transfer",
      types: ["address", "address", "uint256"],
    });
  });

  it("normalizes aliases and keeps tuple types intact", () => {
    expect(parseEventSignature("Swap(uint,int)").types).toEqual(["uint256", "int256"]);
    expect(
      parseEventSignature("Complex((address,uint256)[] pairs, bytes data)").types
    ).toEqual(["(address,uint256)[]", "bytes"]);
    expect(parseEventSignature("Ping()").types).toEqual([]);
  });

  it("normalizes legacy byte and function aliases", () => {
    expect(parseEventSignature("Legacy(byte,function)").types).toEqual(["bytes1", "bytes24"]);
    expect(parseEventSignature("Legacy(byte[2])").types).toEqual(["bytes1[2]"]);
  });

  it("rejects malformed signatures", () => {
    expect(() => parseEventSignature("Transfer")).toThrow("无效事件签名");
    expect(() => parseEventSignature("Transfer(address,)")).toThrow("无效事件签名");
  });
});

describe("hashed indexed parameter detection", () => {
  it("treats reference types as hashed and value types as recoverable", () => {
    expect(isHashedEventParamType("string")).toBe(true);
    expect(isHashedEventParamType("bytes")).toBe(true);
    expect(isHashedEventParamType("uint256[]")).toBe(true);
    expect(isHashedEventParamType("uint256[2]")).toBe(true);
    expect(isHashedEventParamType("(address,uint256)")).toBe(true);
    expect(isHashedEventParamType("bytes32")).toBe(false);
    expect(isHashedEventParamType("address")).toBe(false);
  });
});

describe("decodeRawLogWithAbi", () => {
  it("decodes indexed and non-indexed parameters from an ABI", () => {
    const decoded = decodeRawLogWithAbi(transferAbi, transferLog);

    expect(decoded.name).toBe("Transfer");
    expect(decoded.signature).toBe("Transfer(address,address,uint256)");
    expect(decoded.fullSignature).toBe(
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    );
    expect(decoded.params).toEqual([
      { name: "from", type: "address", indexed: true, hashed: false, value: FROM },
      { name: "to", type: "address", indexed: true, hashed: false, value: TO },
      { name: "value", type: "uint256", indexed: false, hashed: false, value: "1000" },
    ]);
  });

  it("exposes indexed dynamic values as their topic hash", () => {
    const abi = ["event Tagged(string indexed label, address indexed who)"];
    const iface = new Interface(abi);
    const log = iface.encodeEventLog(iface.getEvent("Tagged")!, [FROM, FROM]);

    const decoded = decodeRawLogWithAbi(abi, log);

    expect(decoded.params[0]).toMatchObject({
      name: "label",
      type: "string",
      indexed: true,
      hashed: true,
      value: log.topics[1],
    });
    expect(decoded.params[1]).toMatchObject({
      type: "address",
      indexed: true,
      hashed: false,
      value: FROM,
    });
  });

  it("uses canonical tuple types", () => {
    const abi = ["event Complex((address,uint256) pair)"];
    const iface = new Interface(abi);
    const log = iface.encodeEventLog(iface.getEvent("Complex")!, [[FROM, BigInt(7)]]);

    const decoded = decodeRawLogWithAbi(abi, log);

    expect(decoded.params[0].type).toBe("(address,uint256)");
    expect(decoded.params[0].value).toContain("7");
  });

  it("rejects logs whose topic0 is unknown to the ABI", () => {
    expect(() =>
      decodeRawLogWithAbi(["event Mint(address indexed to, uint256 amount)"], transferLog)
    ).toThrow("Topic0");
  });

  it("rejects logs whose data cannot be decoded", () => {
    expect(() =>
      decodeRawLogWithAbi(transferAbi, { topics: transferLog.topics, data: "0x" })
    ).toThrow("无法按");
  });

  it("rejects logs with extra topics", () => {
    const log = {
      topics: [...transferLog.topics, `0x${"00".repeat(32)}`],
      data: transferLog.data,
    };
    expect(() => decodeRawLogWithAbi(transferAbi, log)).toThrow("Topic 数量");
  });

  it("rejects logs with trailing data", () => {
    const log = {
      topics: transferLog.topics,
      data: `${transferLog.data}${"ff".repeat(32)}`,
    };
    expect(() => decodeRawLogWithAbi(transferAbi, log)).toThrow("DATA 与事件定义不匹配");
  });
});

describe("decodeRawLogWithSignature", () => {
  it("infers the indexed-first layout from the topic count", () => {
    const decoded = decodeRawLogWithSignature(
      "Transfer(address,address,uint256)",
      transferLog
    );

    expect(decoded.fullSignature).toBe(
      "event Transfer(address indexed, address indexed, uint256)"
    );
    expect(decoded.params).toEqual([
      { name: "param0", type: "address", indexed: true, hashed: false, value: FROM },
      { name: "param1", type: "address", indexed: true, hashed: false, value: TO },
      { name: "param2", type: "uint256", indexed: false, hashed: false, value: "1000" },
    ]);
  });

  it("decodes parameterless events from topic0 alone", () => {
    const log = { topics: [id("Ping()")], data: "0x" };
    const decoded = decodeRawLogWithSignature("Ping()", log);

    expect(decoded.params).toEqual([]);
    expect(decoded.fullSignature).toBe("event Ping()");
  });

  it("handles hashed indexed and non-indexed dynamic parameters", () => {
    const abi = ["event Tagged(string indexed label, address who, bytes data)"];
    const iface = new Interface(abi);
    const log = iface.encodeEventLog(iface.getEvent("Tagged")!, ["hello", TO, "0xdeadbeef"]);

    const decoded = decodeRawLogWithSignature("Tagged(string,address,bytes)", log);

    expect(decoded.params[0]).toMatchObject({
      type: "string",
      indexed: true,
      hashed: true,
      value: log.topics[1],
    });
    expect(decoded.params[1]).toMatchObject({ type: "address", indexed: false, value: TO });
    expect(decoded.params[2]).toMatchObject({ type: "bytes", indexed: false });
  });

  it("rejects a signature that does not match topic0", () => {
    expect(() =>
      decodeRawLogWithSignature("Mint(address,uint256)", transferLog)
    ).toThrow("Topic0 不匹配");
  });

  it("rejects more topics than event parameters", () => {
    const log = { topics: [id("Ping()"), id("Ping()"), id("Ping()")], data: "0x" };
    expect(() => decodeRawLogWithSignature("Ping()", log)).toThrow("Topic 数量");
  });

  it("rejects layouts that would ignore non-empty data", () => {
    const signature = "Foo(address,address)";
    const log = {
      topics: [
        id(signature),
        "0x0000000000000000000000001111111111111111111111111111111111111111",
        "0x0000000000000000000000002222222222222222222222222222222222222222",
      ],
      data: `0x${"00".repeat(32)}`,
    };

    expect(() => decodeRawLogWithSignature(signature, log)).toThrow();
  });

  it("flags ambiguity when several indexed layouts fit the same log", () => {
    const abi = ["event Deposit(uint256 amount, address indexed depositor)"];
    const iface = new Interface(abi);
    const log = iface.encodeEventLog(iface.getEvent("Deposit")!, [BigInt(12345), TO]);

    const decoded = decodeRawLogWithSignature("Deposit(uint256,address)", log);

    expect(decoded.layoutAmbiguous).toBe(true);
  });

  it("does not flag ambiguity when only one layout fits", () => {
    const signature = "Lock(address,uint256)";
    const log = {
      topics: [
        id(signature),
        `0x000000000000000000000000${FROM.slice(2)}`,
        `0x${"0".repeat(62)}2a`,
      ],
      data: "0x",
    };

    const decoded = decodeRawLogWithSignature(signature, log);

    expect(decoded.layoutAmbiguous).toBeFalsy();
    expect(decoded.params.every((param) => param.indexed)).toBe(true);
  });

  it("decodes non-indexed-first layouts like Uniswap V3 Mint but flags them", () => {
    const abi = [
      "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
    ];
    const iface = new Interface(abi);
    const log = iface.encodeEventLog(iface.getEvent("Mint")!, [
      FROM,
      TO,
      BigInt(-100),
      BigInt(100),
      BigInt(1000),
      BigInt(1),
      BigInt(2),
    ]);

    const decoded = decodeRawLogWithSignature(
      "Mint(address,address,int24,int24,uint128,uint256,uint256)",
      log
    );

    expect(decoded.params).toHaveLength(7);
    expect(decoded.layoutAmbiguous).toBe(true);
  });
});

describe("decodeRawLogWithLocalAbis", () => {
  it("decodes through the saved ABI that contains the event", () => {
    const results = decodeRawLogWithLocalAbis(
      [
        {
          name: "TokenA",
          address: FROM,
          abi: ["event Mint(address indexed to, uint256 amount)"],
        },
        {
          name: "TokenB",
          address: TO,
          abi: transferAbi,
        },
      ],
      transferLog
    );

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("local");
    expect(results[0].contractName).toBe("TokenB");
    expect(results[0].contractAddress).toBe(TO);
    expect(results[0].params[2].value).toBe("1000");
  });

  it("deduplicates contracts exposing the same event signature", () => {
    const results = decodeRawLogWithLocalAbis(
      [
        { name: "TokenA", address: FROM, abi: transferAbi },
        { name: "TokenB", address: TO, abi: transferAbi },
      ],
      transferLog
    );

    expect(results).toHaveLength(1);
    expect(results[0].contractName).toBe("TokenA");
  });

  it("returns no results when no saved ABI matches", () => {
    expect(
      decodeRawLogWithLocalAbis(
        [{ name: "TokenA", abi: ["event Mint(address indexed to, uint256 amount)"] }],
        transferLog
      )
    ).toEqual([]);
  });

  it("skips saved ABIs whose event shape does not match the log", () => {
    const results = decodeRawLogWithLocalAbis(
      [
        {
          name: "WrongShape",
          abi: ["event Transfer(address indexed from, uint256 indexed value, address indexed to)"],
        },
      ],
      transferLog
    );

    expect(results).toEqual([]);
  });
});

describe("formatEventArgument", () => {
  it("keeps the hash for indexed reference types", () => {
    const abi = ["event Tagged(string indexed label)"];
    const iface = new Interface(abi);
    const log = iface.encodeEventLog(iface.getEvent("Tagged")!, ["hello"]);
    const parsed = iface.parseLog(log)!;

    expect(formatEventArgument(iface.getEvent("Tagged")!.inputs[0], parsed.args[0])).toEqual({
      value: log.topics[1],
      hashed: true,
    });
  });
});
