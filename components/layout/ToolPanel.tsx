"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Binary,
  ChevronRight,
  Clock,
  Code,
  Coins,
  FileCode,
  Fingerprint,
  Hash,
  Radio,
  Type,
} from "lucide-react";
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
    description: "解码事件日志",
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
  const active = allTools.find((tool) => tool.value === activeTool);
  const ActiveComponent = active?.component;

  if (active && ActiveComponent) {
    return (
      <div className="space-y-2">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-2">
          <button
            type="button"
            onClick={() => setActiveTool(null)}
            className="terminal-btn terminal-btn-secondary h-8 px-2.5"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span>全部工具</span>
          </button>
          <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.06em] text-[var(--terminal-text-secondary)]">
            {active.label}
          </span>
        </div>
        <ActiveComponent />
      </div>
    );
  }

  return (
    <section className="terminal-card" aria-label="工具面板">
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
              <span className="text-[10px] text-[var(--terminal-text-secondary)]">{group.hint}</span>
            </div>

            <div className="divide-y divide-[var(--terminal-separator)] overflow-hidden border border-[var(--terminal-separator)]">
              {group.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.value}
                    type="button"
                    onClick={() => setActiveTool(tool.value)}
                    className="group flex w-full items-center gap-2.5 bg-[var(--terminal-card)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--terminal-hover)] focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] text-[var(--terminal-blue)]">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-[var(--terminal-text)]">
                        {tool.label}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--terminal-text-secondary)]">
                        {tool.description}
                      </span>
                    </span>
                    <ChevronRight
                      size={13}
                      className="shrink-0 text-[var(--terminal-text-secondary)] transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-[10px] leading-relaxed text-[var(--terminal-text-secondary)]">
          工具会在右侧面板内打开；合约交互和系统日志保留在中间区域。
        </p>
      </div>
    </section>
  );
}
