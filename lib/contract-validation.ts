import { ethers, type InterfaceAbi } from "ethers";
import { z } from "zod";

export const contractNameSchema = z
  .string()
  .trim()
  .min(1, "请输入合约名称")
  .max(120, "合约名称不能超过 120 个字符");

export const contractAddressSchema = z
  .string()
  .trim()
  .regex(/^0[xX][a-fA-F0-9]{40}$/, "无效的合约地址（应为 0x + 40 位十六进制）");

/**
 * ABI must be an array that ethers can actually parse. This rejects `{}`,
 * `null` and `"text"`, none of which can be rendered safely by the
 * interaction panel. An empty array is allowed (the contract simply exposes no
 * methods).
 */
export const contractAbiSchema = z.custom<InterfaceAbi>(
  (value) => {
    if (!Array.isArray(value)) return false;
    try {
      const iface = new ethers.Interface(value as InterfaceAbi);
      // Empty ABIs are allowed; non-empty arrays must contain at least one
      // fragment ethers can understand (rejects `[1, 2]` and similar junk).
      return value.length === 0 || iface.fragments.length > 0;
    } catch {
      return false;
    }
  },
  { message: "ABI 必须是合法的 JSON ABI 数组" }
);

export const contractInputSchema = z.object({
  name: contractNameSchema,
  address: contractAddressSchema,
  chainId: z.number().int("链 ID 必须为整数").positive("链 ID 必须是正整数"),
  abi: contractAbiSchema,
});

export const contractUpdateSchema = contractInputSchema.partial();

export type ContractInput = z.infer<typeof contractInputSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "合约参数无效";
}

/** Throws a human-readable Error; used by the SQLite store so every API route is covered. */
export function assertContractInput(value: unknown): ContractInput {
  const result = contractInputSchema.safeParse(value);
  if (!result.success) {
    throw new Error(firstIssue(result.error));
  }
  return result.data;
}

/** Throws a human-readable Error; used by PATCH /api/contracts/[id]. */
export function assertContractUpdate(value: unknown): ContractUpdateInput {
  const result = contractUpdateSchema.safeParse(value);
  if (!result.success) {
    throw new Error(firstIssue(result.error));
  }
  return result.data;
}

/** Parse an ABI from JSON text, with the same message used by the forms. */
export function parseAbiText(text: string): InterfaceAbi {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("ABI 必须是合法的 JSON");
  }

  const result = contractAbiSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(firstIssue(result.error));
  }
  return result.data;
}
