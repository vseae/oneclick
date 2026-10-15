import { fail, ok } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { contracts?: unknown };
    if (!Array.isArray(body.contracts)) {
      throw new Error("contracts must be an array");
    }
    return ok(getSqliteStore().upsertContractsBatch(body.contracts as any[]));
  } catch (error) {
    return fail(error);
  }
}
