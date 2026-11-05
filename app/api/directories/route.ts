import { fail, ok, parseOptionalPositiveInteger } from "@/app/api/_lib/responses";
import { getSqliteStore } from "@/lib/server/sqlite-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return ok(getSqliteStore().listDirectories(parseOptionalPositiveInteger(searchParams.get("chainId"))));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(getSqliteStore().createDirectory(await request.json()));
  } catch (error) {
    return fail(error);
  }
}
