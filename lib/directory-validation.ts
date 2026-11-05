import { z } from "zod";

export const directoryNameSchema = z.string().trim().min(1, "请输入目录名称");

const directoryInputSchema = z.object({
  name: directoryNameSchema,
  chainId: z.number().int("链 ID 必须为整数").positive("链 ID 必须是正整数"),
});

const moveContractSchema = z.union([
  z.object({ directoryId: z.number().int().positive().nullable() }).strict(),
  z.object({ newDirectoryName: directoryNameSchema }).strict(),
]);

export function assertDirectoryInput(value: unknown) {
  const result = directoryInputSchema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "目录参数无效");
  return result.data;
}

export function assertMoveContractInput(value: unknown) {
  const result = moveContractSchema.safeParse(value);
  if (!result.success) throw new Error("请选择目录或输入有效的新目录名称");
  return result.data;
}
