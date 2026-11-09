"use client";

import type { AbiParameter } from "viem";
import { arrayParameter, parameterType } from "@/lib/abi";
import { parseMethodParam } from "@/lib/contract-utils";

function example(param: AbiParameter, budget = { remaining: 64 }): unknown {
  if (--budget.remaining < 0) throw new Error("示例过大");
  const array = arrayParameter(param);
  if (array) {
    const length = array.length ?? 1;
    if (length > budget.remaining) throw new Error("示例过大");
    return Array.from({ length }, () => example(array.child, budget));
  }
  if (param.type === "tuple") return ("components" in param ? param.components ?? [] : []).map((item) => example(item, budget));
  if (param.type === "bool") return true;
  if (param.type === "address") return "0x0000000000000000000000000000000000000001";
  if (param.type === "string") return "hello";
  if (param.type.startsWith("bytes")) return `0x${"00".repeat(Number(param.type.slice(5)) || 1)}`;
  return "1";
}

export default function AbiParamInput({ input, id, index, value, onChange, showError }: {
  input: AbiParameter;
  id: string;
  index: number;
  value: string;
  onChange: (value: string) => void;
  showError: boolean;
}) {
  let error: string | null = null;
  if (showError) {
    try { parseMethodParam(input, value); } catch (err) { error = err instanceof Error ? err.message : "参数无效"; }
  }
  let hint: string;
  try {
    hint = input.type === "string" ? "可留空；输入按原样传入" :
      arrayParameter(input) || input.type === "tuple"
        ? `示例: ${JSON.stringify(example(input))}（整数使用字符串）`
        : `示例: ${String(example(input))}`;
  } catch {
    hint = "请输入符合 ABI 类型的 JSON（整数使用字符串）";
  }
  const shared = {
    id, name: id, value, className: "terminal-input font-mono text-[13px]",
    "aria-invalid": Boolean(error), "aria-describedby": `${id}-hint${error ? ` ${id}-error` : ""}`,
  };
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-[var(--terminal-text-secondary)]">
        {input.name || `param${index}`}<span className="ml-1 opacity-60">({parameterType(input)})</span>
      </label>
      {input.type === "bool" ? (
        <select {...shared} onChange={(event) => onChange(event.target.value)}>
          <option value="">请选择…</option><option value="true">true</option><option value="false">false</option>
        </select>
      ) : (
        <input {...shared} onChange={(event) => onChange(event.target.value)} autoComplete="off" spellCheck={false} />
      )}
      <p id={`${id}-hint`} className="mt-1 break-all text-[10px] text-[var(--terminal-text-secondary)]">{hint}</p>
      {error && <p id={`${id}-error`} className="mt-1 break-all text-[11px] text-[var(--terminal-red)]" role="alert">{error}</p>}
    </div>
  );
}
