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
