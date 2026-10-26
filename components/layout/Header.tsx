"use client";

import dynamic from "next/dynamic";

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
          <p className="mt-1 hidden truncate text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)] md:block">
            Smart Contract Interaction Tool
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <CustomConnectButton />
        </div>
      </div>
    </header>
  );
}
