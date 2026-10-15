"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const id = window.setTimeout(callback, 0);
  return () => window.clearTimeout(id);
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
