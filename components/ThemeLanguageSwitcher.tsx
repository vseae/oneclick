"use client";

import { useApp } from "@/contexts/AppContext";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useApp();

  return (
    <div className="relative group">
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="terminal-btn terminal-btn-secondary min-w-[112px]"
      >
        <div className="relative px-1 py-0.5 flex items-center gap-2">
          {theme === "light" ? (
            <>
              <span className="text-sm">🌙</span>
              <span className="font-medium text-[var(--terminal-text)] text-[11px] tracking-[0.01em]">
                Dark
              </span>
            </>
          ) : (
            <>
              <span className="text-sm">☀️</span>
              <span className="font-medium text-[var(--terminal-text)] text-[11px] tracking-[0.01em]">
                Light
              </span>
            </>
          )}
        </div>
      </button>
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white border border-[var(--terminal-separator)] text-[var(--terminal-text-secondary)] text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 tracking-[0.01em] rounded-lg shadow-[0_12px_24px_rgba(21,45,86,0.08)]">
        {theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      </div>
    </div>
  );
}
