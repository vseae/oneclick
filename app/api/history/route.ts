import { emptyOk, fail, ok, parseOptionalPositiveInteger } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = parseOptionalPositiveInteger(searchParams.get("contractId"));
    const chainId = parseOptionalPositiveInteger(searchParams.get("chainId"));
    const limit = parseOptionalPositiveInteger(searchParams.get("limit"));
    return ok(getSqliteStore().listHistory({ contractId, chainId, limit }));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const id = getSqliteStore().addHistory(await request.json());
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = parseOptionalPositiveInteger(searchParams.get("contractId"));
    const chainId = parseOptionalPositiveInteger(searchParams.get("chainId"));
    getSqliteStore().clearHistory(contractId, chainId);
    return emptyOk();
  } catch (error) {
    return fail(error);
  }
}
