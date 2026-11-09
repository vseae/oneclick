import { BaseError, ContractFunctionRevertedError, isAddress, parseAbiParameter, type Abi, type AbiFunction, type AbiParameter } from "viem";
import { abiSelector, abiSignature, arrayParameter, normalizeAbi, parameterType } from "./abi";

export function getReadableContractError(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      if (reverted.data?.errorName) return `Custom Error: ${reverted.data.errorName}(${(reverted.data.args ?? []).map(String).join(", ")})`;
      return reverted.reason || reverted.shortMessage;
    }
    return error.shortMessage || error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function formatResult(result: any): string {
  if (result === null || result === undefined) return "null";

  if (typeof result === "bigint") {
    return result.toString();
  }

  if (Array.isArray(result)) {
    return result.map(formatResult).join(", ");
  }

  if (typeof result === "object") {
    return JSON.stringify(
      result,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    );
  }

  return result.toString();
}

export function isReadMethod(method: AbiFunction): boolean {
  return method.stateMutability === "view" || method.stateMutability === "pure";
}

export function isWriteMethod(method: AbiFunction): boolean {
  return (
    method.stateMutability === "nonpayable" ||
    method.stateMutability === "payable"
  );
}

/**
 * Payable detection has to look at both the modern `stateMutability` and the
 * legacy `payable` flag: raw ABIs written before Solidity 0.6 often only carry
 * the boolean, and some ABI parsers can normalise those to `nonpayable`.
 */
export function isPayableMethod(method: AbiFunction): boolean {
  const legacy = (method as unknown as { payable?: boolean }).payable;
  return method.stateMutability === "payable" || legacy === true;
}

/**
 * Parse one raw input string into the JavaScript value the ABI encoder expects for the
 * given ABI type. Shared by the interaction panel and the encoder/batch tools so
 * every entry point accepts the same syntax.
 */
export function parseMethodParam(type: string | AbiParameter, raw: string): unknown {
  const param = typeof type === "string" ? parseAbiParameter(type as never) : type;
  const path = param.name || parameterType(param);
  const fail = (where: string, message: string): never => { throw new Error(`${where}: ${message}`); };

  const parse = (item: AbiParameter, value: unknown, where: string, nested: boolean): unknown => {
    const array = arrayParameter(item);
    if (array) {
      if (!Array.isArray(value)) return fail(where, "请输入 JSON 数组");
      if (array.length !== null && value.length !== array.length) {
        return fail(where, `需要 ${array.length} 个元素，实际 ${value.length} 个`);
      }
      return value.map((entry, index) => parse(array.child, entry, `${where}[${index}]`, true));
    }
    if (item.type === "tuple") {
      const components = "components" in item ? item.components ?? [] : [];
      if (Array.isArray(value)) {
        if (value.length !== components.length) return fail(where, `需要 ${components.length} 个字段，实际 ${value.length} 个`);
        return components.map((component, index) => parse(component, value[index], `${where}.${component.name || index}`, true));
      }
      const names = components.map((component) => component.name ?? "");
      if (!value || typeof value !== "object" || names.some((name) => !name) || new Set(names).size !== names.length) {
        return fail(where, "请输入按顺序排列的 JSON 数组；字段名称完整且唯一时也可使用对象");
      }
      const object = value as Record<string, unknown>;
      if (Object.keys(object).length !== names.length || names.some((name) => !Object.hasOwn(object, name))) {
        return fail(where, `字段必须且只能包含: ${names.join(", ")}`);
      }
      return components.map((component) => parse(component, object[component.name ?? ""], `${where}.${component.name}`, true));
    }
    if (item.type === "string") {
      return typeof value === "string" ? value : fail(where, "请输入字符串");
    }
    if (item.type === "bool") {
      if (nested && typeof value === "boolean") return value;
      if (!nested && (value === "true" || value === "false")) return value === "true";
      return fail(where, "请选择 true 或 false");
    }
    if (typeof value !== "string") return fail(where, nested && /^(u?int)\d+$/.test(item.type) ? "整数必须使用 JSON 字符串" : "类型不正确");
    if (!value.trim()) return fail(where, "此参数必填");
    const text = value.trim();
    const integer = item.type.match(/^(u?int)(\d+)$/);
    if (integer) {
      if (!/^-?\d+$/.test(text) && !/^0x[0-9a-f]+$/i.test(text)) return fail(where, "请输入整数；复合参数中的整数必须用双引号包围");
      const number = BigInt(text);
      const bits = BigInt(integer[2]);
      const signed = integer[1] === "int";
      const min = signed ? -(BigInt(1) << (bits - BigInt(1))) : BigInt(0);
      const max = signed ? (BigInt(1) << (bits - BigInt(1))) - BigInt(1) : (BigInt(1) << bits) - BigInt(1);
      if (number < min || number > max) return fail(where, `${item.type} 范围为 ${min} 至 ${max}`);
      return number;
    }
    if (item.type === "address") {
      if (!isAddress(text)) return fail(where, "请输入有效的 0x 地址（含正确的校验大小写）");
      return text;
    }
    const bytes = item.type.match(/^bytes(\d*)$/);
    if (bytes) {
      if (!/^0x(?:[0-9a-f]{2})*$/i.test(text)) return fail(where, "请输入 0x 开头的偶数位十六进制数据");
      if (bytes[1] && text.length !== 2 + Number(bytes[1]) * 2) return fail(where, `需要恰好 ${bytes[1]} 字节`);
      return text;
    }
    return fail(where, `不支持的 ABI 类型 ${item.type}`);
  };

  if (arrayParameter(param) || param.type === "tuple") {
    if (!raw.trim()) return fail(path, "此参数必填");
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return fail(path, "请输入有效的 JSON"); }
    const objects: (Set<string> | null)[] = [];
    for (const token of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]]/g)) {
      if (token[0] === "{") objects.push(new Set());
      else if (token[0] === "[") objects.push(null);
      else if (token[0] === "}" || token[0] === "]") objects.pop();
      else if (objects.at(-1) && /^\s*:/.test(raw.slice(token.index! + token[0].length))) {
        const keys = objects.at(-1)!;
        const key = JSON.parse(token[0]) as string;
        if (keys.has(key)) return fail(path, `JSON 对象包含重复字段 ${key}`);
        keys.add(key);
      }
    }
    return parse(param, value, path, false);
  }
  return parse(param, raw, path, false);
}

export function parseMethodParams(
  method: AbiFunction,
  raw: string[]
): unknown[] {
  return method.inputs.map((input, index) => {
    try { return parseMethodParam(input, raw[index] ?? ""); }
    catch (error) {
      if (!input.name && error instanceof Error) throw new Error(`param${index}: ${error.message}`);
      throw error;
    }
  });
}

export type SelectorType = "function" | "event" | "error";

export interface SelectorItem {
  type: SelectorType;
  name: string;
  signature: string;
  selector: string;
}

export function parseAbiSelectors(abiInput: unknown): SelectorItem[] {
  const abi: Abi = normalizeAbi(typeof abiInput === "string" ? JSON.parse(abiInput) : abiInput);
  return abi.flatMap((item) => {
    if (item.type !== "function" && item.type !== "event" && item.type !== "error") return [];
    return [{ type: item.type, name: item.name, signature: abiSignature(item), selector: abiSelector(item) }];
  });
}
