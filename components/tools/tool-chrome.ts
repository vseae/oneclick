"use client";

import { createContext } from "react";

export interface ToolChrome {
  onBack: () => void;
  onExpand: () => void;
  expanded: boolean;
}

/**
 * Supplied when a tool is rendered inside the right-side panel. The tool header
 * then owns the back/expand controls, so there is only one header per tool.
 */
export const ToolChromeContext = createContext<ToolChrome | null>(null);
