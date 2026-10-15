import { emptyOk, fail, parsePositiveId } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parsePositiveId(rawId);
    getSqliteStore().updateHistory(id, await request.json());
    return emptyOk();
  } catch (error) {
    return fail(error);
  }
}
