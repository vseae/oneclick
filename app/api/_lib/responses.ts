import { NextResponse } from "next/server";

export function ok<T>(data: T) {
  return NextResponse.json({ data });
}

export function emptyOk() {
  return NextResponse.json({ data: null });
}

export function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Request failed";
  return NextResponse.json({ error: message }, { status });
}

export function parsePositiveId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("id must be a positive integer");
  }
  return id;
}

export function parseOptionalPositiveInteger(value: string | null): number | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error("value must be a positive integer");
  }
  return numberValue;
}
