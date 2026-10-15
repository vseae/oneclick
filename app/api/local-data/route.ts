import { emptyOk, fail, ok } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    return ok(getSqliteStore().exportLocalData());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(getSqliteStore().importLocalData(await request.json()));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  try {
    getSqliteStore().clearAllLocalData();
    return emptyOk();
  } catch (error) {
    return fail(error);
  }
}
