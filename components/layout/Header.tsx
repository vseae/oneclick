"use client";

import dynamic from "next/dynamic";
import ToolMenu from "@/components/layout/ToolMenu";

const CustomConnectButton = dynamic(() => import("@/components/CustomConnectButton"), {
  ssr: false,
});

export default function Header() {
  return (
    <header className="terminal-topbar">
      <div className="flex h-full w-full min-w-0 items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <div className="truncate text-[28px] leading-none font-semibold tracking-[0.01em] text-[var(--terminal-blue)] [font-family:IBM_Plex_Mono,ui-monospace,monospace]">
            OneClick
          </div>
          <p className="mt-1 hidden text-[11px] font-medium tracking-[0.02em] text-[var(--terminal-text-secondary)] md:block">
            OneClick
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <ToolMenu />
          <CustomConnectButton />
        </div>
      </div>
    </header>
  );
}
