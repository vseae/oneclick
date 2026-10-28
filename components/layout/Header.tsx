"use client";

import dynamic from "next/dynamic";
import { Wrench } from "lucide-react";

const CustomConnectButton = dynamic(() => import("@/components/CustomConnectButton"), {
  ssr: false,
});

export default function Header() {
  return (
    <header className="terminal-topbar">
      <div className="flex h-full w-full min-w-0 items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <div className="truncate text-[24px] leading-none font-semibold tracking-[0.01em] text-[var(--terminal-blue)] [font-family:IBM_Plex_Mono,ui-monospace,monospace] md:text-[28px]">
            OneClick
          </div>
          <p className="mt-1 hidden truncate text-[11px] font-medium tracking-[0.02em] text-[var(--terminal-text-secondary)] md:block">
            Smart Contract Interaction Tool
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <div className="xl:hidden">
            <a
              href="#toolkit"
              className="terminal-btn terminal-btn-secondary terminal-btn-icon h-9 w-9"
              aria-label="跳到工具箱"
              title="工具箱"
            >
              <Wrench size={15} aria-hidden="true" />
            </a>
          </div>
          <CustomConnectButton />
        </div>
      </div>
    </header>
  );
}
