import { parseAbi, parseAbiParameter, toEventSelector, toFunctionSelector, type Abi, type AbiEvent, type AbiFunction, type AbiParameter } from "viem";

/** Parse and validate ABI items before using them in the interface. */
export function normalizeAbi(value: unknown): Abi {
  if (!Array.isArray(value)) throw new Error("ABI 必须是数组");
  return value.flatMap((entry) => {
    if (typeof entry === "string") return [...parseAbi([entry] as readonly string[])];
    if (!entry || typeof entry !== "object") throw new Error("ABI 项无效");
    const item = entry as Record<string, unknown>;
    if (!["function", "event", "error", "constructor", "fallback", "receive"].includes(String(item.type))) throw new Error("ABI 项类型无效");
    if (["function", "event", "error"].includes(String(item.type)) && (typeof item.name !== "string" || !item.name)) throw new Error("ABI 名称无效");
    for (const key of ["inputs", "outputs"] as const) {
      if (item[key] === undefined) continue;
      if (!Array.isArray(item[key])) throw new Error("ABI 参数无效");
      for (const param of item[key]) validateParameter(param);
    }
    if (["function", "event", "error", "constructor"].includes(String(item.type)) && !Array.isArray(item.inputs)) throw new Error("ABI 参数无效");
    if (item.stateMutability !== undefined && !["pure", "view", "nonpayable", "payable"].includes(String(item.stateMutability))) throw new Error("ABI 可变性无效");
    if (item.type === "function") return [{ ...item, outputs: item.outputs ?? [], stateMutability: item.stateMutability ?? (item.payable ? "payable" : item.constant ? "view" : "nonpayable") }];
    return [item];
  }) as unknown as Abi;
}

function validateParameter(value: unknown): void {
  if (!value || typeof value !== "object" || !("type" in value) || typeof value.type !== "string") throw new Error("ABI 参数无效");
  if (value.type.startsWith("tuple")) {
    if (!("components" in value) || !Array.isArray(value.components)) throw new Error("ABI tuple 无效");
    value.components.forEach(validateParameter);
  }
  parseParameter(parameterType(value as AbiParameter));
}

export function parameterType(param: AbiParameter): string {
  if (!param.type.startsWith("tuple")) return param.type.replace(/^uint(?=\[|$)/, "uint256").replace(/^int(?=\[|$)/, "int256");
  const components = "components" in param ? param.components ?? [] : [];
  return `(${components.map(parameterType).join(",")})${param.type.slice(5)}`;
}

export function abiSignature(item: { name: string; inputs: readonly AbiParameter[] }): string {
  return `${item.name}(${item.inputs.map(parameterType).join(",")})`;
}

export function abiSelector(item: AbiFunction | AbiEvent | Extract<Abi[number], { type: "error" }>): `0x${string}` {
  return item.type === "event" ? toEventSelector(abiSignature(item)) : toFunctionSelector(abiSignature(item));
}

export function arrayParameter(param: AbiParameter): { child: AbiParameter; length: number | null } | null {
  const match = /^(.*)\[(\d*)\]$/.exec(param.type);
  return match ? { child: { ...param, type: match[1] } as AbiParameter, length: match[2] ? Number(match[2]) : null } : null;
}

export function parseParameter(value: string): AbiParameter {
  return parseAbiParameter(value as never);
}

/** Keep the selected overload and custom errors together for contract calls. */
export function functionAbi(method: AbiFunction, abi: Abi): Abi {
  return [method, ...abi.filter((item) => item.type === "error")];
}
