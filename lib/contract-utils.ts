import { ethers } from "ethers";
import type { InterfaceAbi } from "ethers";

/**
 * Extract a user-friendly error message from ethers contract call errors.
 * Handles common error codes like BAD_DATA (empty return from non-contract address),
 * CALL_EXCEPTION, NETWORK_ERROR, etc.
 */
export function getReadableContractError(error: unknown, contractAbi?: any[]): string {
  if (!(error instanceof Error)) return String(error);

  const ethersError = error as any;
  const code = ethersError.code;

  if (code === "BAD_DATA" && ethersError.value === "0x") {
    const method = ethersError.info?.method ?? "";
    return `调用 ${method}() 返回空数据 — 目标地址可能不是合约地址，或该合约未实现此方法，请检查地址和 ABI 是否匹配`;
  }

  if (code === "CALL_EXCEPTION") {
    if (contractAbi) {
      const customError = parseCustomError(ethersError, contractAbi);
      if (customError !== ethersError.message) return customError;
    }
    return ethersError.reason ?? ethersError.message ?? "合约调用异常";
  }

  if (code === "NETWORK_ERROR") {
    return "网络错误 — 请检查 RPC 连接和网络设置";
  }

  if (code === "INSUFFICIENT_FUNDS") {
    return "余额不足，无法执行此交易";
  }

  if (code === "UNPREDICTABLE_GAS_LIMIT") {
    return "无法估算 Gas — 交易可能会失败，请检查参数和合约状态";
  }

  return ethersError.shortMessage ?? ethersError.reason ?? ethersError.message ?? "未知错误";
}

export function parseCustomError(error: any, contractAbi: any[]): string {
  try {
    const iface = new ethers.Interface(contractAbi);

    if (error?.data) {
      const errorData = error.data;

      // Try to parse the error
      for (const fragment of iface.fragments) {
        if (fragment.type === "error") {
          try {
            const errorFragment = fragment as ethers.ErrorFragment;
            const selector = ethers.id(errorFragment.format()).slice(0, 10);
            if (errorData.startsWith(selector)) {
              const decoded = iface.decodeErrorResult(errorFragment, errorData);
              return `Custom Error: ${errorFragment.name}(${decoded
                .map((d: any) => d.toString())
                .join(", ")})`;
            }
          } catch {
            continue;
          }
        }
      }
    }

    // If we can't parse, return the original error message
    return error?.message || error?.reason || error.toString();
  } catch {
    return error?.message || error?.reason || error.toString();
  }
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

export function isReadMethod(method: ethers.FunctionFragment): boolean {
  return method.stateMutability === "view" || method.stateMutability === "pure";
}

export function isWriteMethod(method: ethers.FunctionFragment): boolean {
  return (
    method.stateMutability === "nonpayable" ||
    method.stateMutability === "payable"
  );
}

/**
 * Payable detection has to look at both the modern `stateMutability` and the
 * legacy `payable` flag: raw ABIs written before Solidity 0.6 often only carry
 * the boolean, and ethers can normalise those to `nonpayable`.
 */
export function isPayableMethod(method: ethers.FunctionFragment): boolean {
  const legacy = (method as unknown as { payable?: boolean }).payable;
  return method.stateMutability === "payable" || legacy === true;
}

/**
 * Parse one raw input string into the JavaScript value ethers expects for the
 * given ABI type. Shared by the interaction panel and the encoder/batch tools so
 * every entry point accepts the same syntax.
 */
export function parseMethodParam(type: string | ethers.ParamType, raw: string): unknown {
  const param = typeof type === "string" ? ethers.ParamType.from(type) : type;
  const path = param.name || param.format("sighash");
  const fail = (where: string, message: string): never => { throw new Error(`${where}: ${message}`); };

  const parse = (item: ethers.ParamType, value: unknown, where: string, nested: boolean): unknown => {
    if (item.baseType === "array") {
      if (!Array.isArray(value)) return fail(where, "请输入 JSON 数组");
      if (item.arrayLength !== -1 && value.length !== item.arrayLength) {
        return fail(where, `需要 ${item.arrayLength} 个元素，实际 ${value.length} 个`);
      }
      return value.map((entry, index) => parse(item.arrayChildren!, entry, `${where}[${index}]`, true));
    }
    if (item.baseType === "tuple") {
      const components = item.components ?? [];
      if (Array.isArray(value)) {
        if (value.length !== components.length) return fail(where, `需要 ${components.length} 个字段，实际 ${value.length} 个`);
        return components.map((component, index) => parse(component, value[index], `${where}.${component.name || index}`, true));
      }
      const names = components.map((component) => component.name);
      if (!value || typeof value !== "object" || names.some((name) => !name) || new Set(names).size !== names.length) {
        return fail(where, "请输入按顺序排列的 JSON 数组；字段名称完整且唯一时也可使用对象");
      }
      const object = value as Record<string, unknown>;
      if (Object.keys(object).length !== names.length || names.some((name) => !Object.hasOwn(object, name))) {
        return fail(where, `字段必须且只能包含: ${names.join(", ")}`);
      }
      return components.map((component) => parse(component, object[component.name], `${where}.${component.name}`, true));
    }
    if (item.baseType === "string") {
      return typeof value === "string" ? value : fail(where, "请输入字符串");
    }
    if (item.baseType === "bool") {
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
      if (!ethers.isAddress(text)) return fail(where, "请输入有效的 0x 地址（含正确的校验大小写）");
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

  if (param.baseType === "array" || param.baseType === "tuple") {
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
  method: ethers.FunctionFragment,
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

function normalizeAbiInput(abiInput: unknown): InterfaceAbi {
  if (typeof abiInput === "string") {
    return JSON.parse(abiInput) as InterfaceAbi;
  }
  return abiInput as InterfaceAbi;
}

export function parseAbiSelectors(abiInput: unknown): SelectorItem[] {
  const abi = normalizeAbiInput(abiInput);
  const iface = new ethers.Interface(abi);
  const items: SelectorItem[] = [];

  iface.forEachFunction((fn) => {
    items.push({ type: "function", name: fn.name, signature: fn.format("sighash"), selector: fn.selector });
  });
  iface.forEachEvent((ev) => {
    items.push({ type: "event", name: ev.name, signature: ev.format("sighash"), selector: ev.topicHash });
  });
  iface.forEachError((err) => {
    items.push({ type: "error", name: err.name, signature: err.format("sighash"), selector: err.selector });
  });

  return items;
}
