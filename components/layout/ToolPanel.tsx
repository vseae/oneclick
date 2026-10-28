"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeftRight,
  Binary,
  Braces,
  Clock,
  Code,
  Coins,
  FileCode,
  Fingerprint,
  Hash,
  Layers,
  Radio,
  Type,
} from "lucide-react";
import { ToolChromeContext } from "@/components/tools/tool-chrome";
import UnitConverter from "@/components/UnitConverter";
import TokenUnitConverter from "@/components/TokenUnitConverter";
import BaseConversionTool from "@/components/BaseConversionTool";
import StringBytes32Tool from "@/components/StringBytes32Tool";
import UnixEpochTool from "@/components/UnixEpochTool";
import Keccak256Tool from "@/components/Keccak256Tool";
import AbiSelectorTool from "@/components/AbiSelectorTool";
import TxDecoderTool from "@/components/TxDecoderTool";
import EventLogTool from "@/components/EventLogTool";
import SignatureLookupTool from "@/components/SignatureLookupTool";
import EncoderTool from "@/components/EncoderTool";
import BatchReadTool from "@/components/BatchReadTool";

const converters = [
  {
    value: "converter",
    label: "ETH 单位换算",
    description: "Wei / GWei / Ether",
    icon: ArrowLeftRight,
    component: UnitConverter,
  },
  {
    value: "token",
    label: "代币单位换算",
    description: "按代币精度换算",
    icon: Coins,
    component: TokenUnitConverter,
  },
  {
    value: "base",
    label: "进制转换",
    description: "二 / 八 / 十 / 十六进制",
    icon: Binary,
    component: BaseConversionTool,
  },
  {
    value: "bytes32",
    label: "String ↔ Bytes32",
    description: "字符串与 bytes32 互转",
    icon: Type,
    component: StringBytes32Tool,
  },
  {
    value: "epoch",
    label: "时间戳 ↔ UTC",
    description: "Unix 时间戳转换",
    icon: Clock,
    component: UnixEpochTool,
  },
] as const;

const directTools = [
  {
    value: "encoder",
    label: "编码器",
    description: "Calldata / 构造参数",
    icon: Braces,
    component: EncoderTool,
  },
  {
    value: "batch",
    label: "批量读取",
    description: "Multicall3 聚合读取",
    icon: Layers,
    component: BatchReadTool,
  },
  {
    value: "keccak",
    label: "Keccak256",
    description: "文本哈希与选择器",
    icon: Hash,
    component: Keccak256Tool,
  },
  {
    value: "selector",
    label: "Selector",
    description: "解析 ABI 选择器",
    icon: FileCode,
    component: AbiSelectorTool,
  },
  {
    value: "decoder",
    label: "交易解码",
    description: "Calldata / 交易哈希",
    icon: Code,
    component: TxDecoderTool,
  },
  {
    value: "events",
    label: "事件日志",
    description: "回执 / 原始日志解码",
    icon: Radio,
    component: EventLogTool,
  },
  {
    value: "signature",
    label: "签名反查",
    description: "4 字节 / Topic 反查",
    icon: Fingerprint,
    component: SignatureLookupTool,
  },
] as const;

const toolGroups = [
  { label: "CALCULATORS", hint: "换算与编码", tools: converters },
  { label: "ABI & DATA", hint: "ABI 与链上数据", tools: directTools },
] as const;

const allTools = [...converters, ...directTools];

type ToolValue = (typeof allTools)[number]["value"];

export default function ToolPanel() {
  const [activeTool, setActiveTool] = useState<ToolValue | null>(null);
  const [expanded, setExpanded] = useState(false);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<ToolValue | null>(null);
  const toolButtons = useRef<Partial<Record<ToolValue, HTMLButtonElement | null>>>({});

  const active = allTools.find((tool) => tool.value === activeTool);
  const ActiveComponent = active?.component;

  /** Return to the list and restore focus to the tool that was just closed. */
  const handleBack = () => {
    if (activeTool) {
      pendingFocus.current = activeTool;
    }
    setExpanded(false);
    setActiveTool(null);
  };

  const openTool = (value: ToolValue) => {
    pendingFocus.current = null;
    setExpanded(false);
    setActiveTool(value);
  };

  /**
   * Opening a tool resets the internal panel scroll and moves focus into the
   * tool region. Going back restores focus to the originating tool button.
   */
  useEffect(() => {
    if (activeTool) {
      const scroller = activeRef.current?.closest<HTMLElement>(".terminal-main-tools");
      if (window.matchMedia("(min-width: 1280px)").matches) {
        scroller?.scrollTo({ top: 0 });
      } else {
        activeRef.current?.scrollIntoView({ block: "start" });
      }
      const backButton = activeRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-label="返回全部工具"]'
      );
      (backButton ?? activeRef.current)?.focus({ preventScroll: true });
      return;
    }

    const value = pendingFocus.current;
    if (value) {
      pendingFocus.current = null;
      toolButtons.current[value]?.focus();
    }
  }, [activeTool]);

  /** Expanded mode gives the same mounted tool the full main-column width. */
  useEffect(() => {
    const grid = activeRef.current?.closest(".terminal-main-grid");
    if (!grid) return;
    grid.classList.toggle("terminal-grid-expanded", expanded);
    return () => grid.classList.remove("terminal-grid-expanded");
  }, [expanded, activeTool]);

  useEffect(() => {
    if (expanded) {
      activeRef.current?.scrollIntoView({ block: "start" });
    }
  }, [expanded]);

  if (active && ActiveComponent) {
    return (
      <ToolChromeContext.Provider
        value={{
          onBack: handleBack,
          onExpand: () => setExpanded((current) => !current),
          expanded,
        }}
      >
        <div
          ref={activeRef}
          id="toolkit"
          role="region"
          aria-label={active.label}
          tabIndex={-1}
          className={
            expanded
              ? "mx-auto w-full max-w-5xl scroll-mt-20 outline-none"
              : "scroll-mt-20 outline-none"
          }
        >
          <ActiveComponent />
        </div>
      </ToolChromeContext.Provider>
    );
  }

  return (
    <section id="toolkit" className="terminal-card scroll-mt-20" aria-label="工具面板">
      <div className="terminal-panel-header flex items-start justify-between gap-3">
        <div>
          <h2 className="terminal-section-title">[TOOLKIT]</h2>
          <p className="mt-1 text-[12px] text-[var(--terminal-text-secondary)]">
            选择一个工具，在当前面板打开
          </p>
        </div>
        <span className="terminal-chip">{allTools.length} TOOLS</span>
      </div>

      <div className="terminal-panel-body space-y-4">
        {toolGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)]">
                {group.label}
              </h3>
              <span className="text-[11px] text-[var(--terminal-text-secondary)]">{group.hint}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-2">
              {group.tools.map((tool, index) => {
                const Icon = tool.icon;
                const isLastOdd =
                  group.tools.length % 2 === 1 && index === group.tools.length - 1;
                return (
                  <button
                    key={tool.value}
                    ref={(node) => {
                      toolButtons.current[tool.value] = node;
                    }}
                    type="button"
                    onClick={() => openTool(tool.value)}
                    title={`${tool.label} — ${tool.description}`}
                    className={`group flex min-h-[46px] items-start gap-2 border border-[var(--terminal-separator)] bg-[var(--terminal-card)] p-2 text-left transition-colors hover:border-[var(--terminal-blue)]/50 hover:bg-[var(--terminal-hover)] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] sm:min-h-[58px] ${
                      isLastOdd ? "col-span-2 md:col-span-1 xl:col-span-2" : ""
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] text-[var(--terminal-blue)]">
                      <Icon size={13} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-[var(--terminal-text)]">
                        {tool.label}
                      </span>
                      <span className="mt-0.5 hidden line-clamp-2 text-[11px] leading-snug text-[var(--terminal-text-secondary)] sm:block">
                        {tool.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
