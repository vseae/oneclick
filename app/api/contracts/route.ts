import { fail, ok, parseOptionalPositiveInteger } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = parseOptionalPositiveInteger(searchParams.get("chainId"));
    const data =
      typeof chainId === "number"
        ? getSqliteStore().listContractsByChainId(chainId)
        : getSqliteStore().listContracts();
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return ok(getSqliteStore().upsertContract(body));
  } catch (error) {
    return fail(error);
  }
}
