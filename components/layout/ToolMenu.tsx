"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Binary,
  ChevronDown,
  Clock,
  Code,
  Coins,
  FileCode,
  Fingerprint,
  Hash,
  Radio,
  Type,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/**
 * Calculators live in a dropdown so the top bar does not grow one button per
 * conversion, while the ABI tooling keeps a direct entry point.
 */
const converters = [
  { value: "converter", label: "ETH 单位换算", icon: ArrowLeftRight, component: UnitConverter },
  { value: "token", label: "代币单位换算", icon: Coins, component: TokenUnitConverter },
  { value: "base", label: "进制转换", icon: Binary, component: BaseConversionTool },
  { value: "bytes32", label: "String ↔ Bytes32", icon: Type, component: StringBytes32Tool },
  { value: "epoch", label: "时间戳 ↔ UTC", icon: Clock, component: UnixEpochTool },
] as const;

const directTools = [
  { value: "keccak", label: "Keccak256", icon: Hash, component: Keccak256Tool },
  { value: "selector", label: "Selector", icon: FileCode, component: AbiSelectorTool },
  { value: "decoder", label: "交易解码", icon: Code, component: TxDecoderTool },
  { value: "events", label: "事件日志", icon: Radio, component: EventLogTool },
  { value: "signature", label: "签名反查", icon: Fingerprint, component: SignatureLookupTool },
] as const;

const allTools = [...converters, ...directTools];

type ToolValue = (typeof allTools)[number]["value"];

export default function ToolMenu() {
  const [activeTool, setActiveTool] = useState<ToolValue | null>(null);
  const active = allTools.find((tool) => tool.value === activeTool);
  const ActiveComponent = active?.component;

  return (
    <>
      <div className="hidden items-center gap-1 sm:flex" aria-label="工具箱">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="terminal-btn terminal-btn-secondary h-9 px-2.5"
                title="换算工具"
                aria-label="换算工具"
              />
            }
          >
            <ArrowLeftRight size={15} aria-hidden="true" />
            <span className="hidden xl:inline">换算</span>
            <ChevronDown size={12} className="opacity-70" aria-hidden="true" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-56 border border-[var(--terminal-separator)] bg-white/98 p-1"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>CALCULATORS</DropdownMenuLabel>
              {converters.map((tool) => {
                const Icon = tool.icon;
                return (
                  <DropdownMenuItem
                    key={tool.value}
                    onClick={() => setActiveTool(tool.value)}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] font-normal text-[var(--terminal-text)]"
                  >
                    <Icon size={14} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
                    <span className="truncate">{tool.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {directTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.value}
              type="button"
              className="terminal-btn terminal-btn-secondary h-9 px-2.5"
              onClick={() => setActiveTool(tool.value)}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="hidden xl:inline">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {activeTool && ActiveComponent && (
        <Dialog open onOpenChange={(open) => { if (!open) setActiveTool(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-0" showCloseButton={false}>
            <ActiveComponent />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
