"use client";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--terminal-bg)] p-6 text-[var(--terminal-text)]">
      <div className="terminal-card max-w-lg bg-[var(--terminal-card)] p-6 text-center">
        <p className="text-[12px] font-medium tracking-[0.1em] text-[var(--terminal-red)]">[SYSTEM_ERROR]</p>
        <h1 className="mt-2 text-[16px] font-medium">页面渲染失败</h1>
        <p className="mt-2 break-all font-mono text-[12px] leading-relaxed text-[var(--terminal-text-secondary)]">
          {error.message || "未知错误"}
        </p>
        <button type="button" className="terminal-btn terminal-btn-primary mt-4" onClick={reset}>
          重试
        </button>
      </div>
    </div>
  );
}
