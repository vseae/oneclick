"use client";

import { useSyncExternalStore } from "react";
import { formatAmount } from "@/lib/convert";

/**
 * A single display-precision preference shared by every value read in the app
 * (interaction results and the system log). It is intentionally a tiny module
 * level store so switching precision in one place updates all readers.
 */
const STORAGE_KEY = "oneclick:value-decimals";
const MAX_DECIMALS = 255;
const INTEGER_VALUE_RE = /^-?\d+$/;

/**
 * Format a raw integer result with the shared display precision.
 *
 * Returns `null` when precision is off ("原始值") or the value is not a plain
 * integer (arrays, hashes, booleans…), in which case callers should show and
 * copy the original string. When it does return a string, that same string is
 * what the copy action must use so the clipboard matches what is displayed.
 */
export function formatValueForDecimals(
  value: string,
  decimals: number | null
): string | null {
  if (decimals === null) return null;
  const trimmed = value.trim();
  if (!INTEGER_VALUE_RE.test(trimmed)) return null;
  return formatAmount(BigInt(trimmed), decimals);
}

const listeners = new Set<() => void>();

function readStored(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_DECIMALS) return null;
    return parsed;
  } catch {
    return null;
  }
}

let current: number | null = readStored();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

/** The server always renders raw values so hydration stays deterministic. */
function getServerSnapshot() {
  return null;
}

export function setValueDecimals(next: number | null) {
  if (next !== null && (!Number.isInteger(next) || next < 0 || next > MAX_DECIMALS)) {
    return;
  }
  current = next;
  try {
    if (next === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Storage can be unavailable in private mode; the in-memory value still works.
  }
  listeners.forEach((listener) => listener());
}

export function useValueDecimals(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
