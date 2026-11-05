import { fail, ok, parsePositiveId } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return ok(getSqliteStore().moveContractToDirectory(parsePositiveId(id), await request.json()));
  } catch (error) {
    return fail(error);
  }
}
