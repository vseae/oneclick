"use client";

import { useContext, type ReactNode } from "react";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { ToolChromeContext } from "@/components/tools/tool-chrome";

interface ToolHeaderProps {
  title: string;
  subtitle: string;
  chip?: string;
  action?: ReactNode;
}

export default function ToolHeader({ title, subtitle, chip, action }: ToolHeaderProps) {
  const chrome = useContext(ToolChromeContext);

  return (
    <div className="terminal-panel-header flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {chrome && (
          <button
            type="button"
            onClick={chrome.onBack}
            className="terminal-btn terminal-btn-secondary terminal-btn-icon h-8 w-8 shrink-0"
            aria-label="返回全部工具"
            title="全部工具"
          >
            <ArrowLeft size={14} aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="terminal-section-title truncate">[{title}]</h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--terminal-text-secondary)]">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {chip && (
          <div className="hidden sm:block">
            <span className="terminal-chip">{chip}</span>
          </div>
        )}
        {chrome && (
          <button
            type="button"
            onClick={chrome.onExpand}
            className="terminal-btn terminal-btn-secondary terminal-btn-icon h-8 w-8 shrink-0"
            aria-label={chrome.expanded ? "收起工具" : "展开工具"}
            title={chrome.expanded ? "收起工具" : "展开工具"}
          >
            {chrome.expanded ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}
