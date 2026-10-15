import { emptyOk, fail, ok, parsePositiveId } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parsePositiveId(rawId);
    return ok(getSqliteStore().getContractById(id));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parsePositiveId(rawId);
    getSqliteStore().updateContractById(id, await request.json());
    return emptyOk();
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parsePositiveId(rawId);
    getSqliteStore().deleteContract(id);
    return emptyOk();
  } catch (error) {
    return fail(error);
  }
}
