import { emptyOk, fail, parsePositiveId } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    getSqliteStore().renameDirectory(parsePositiveId(id), body.name);
    return emptyOk();
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    getSqliteStore().deleteDirectory(parsePositiveId(id));
    return emptyOk();
  } catch (error) {
    return fail(error);
  }
}
