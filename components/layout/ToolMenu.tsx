"use client";

import { useState } from "react";
import { ArrowLeftRight, Code, FileCode, Fingerprint, Hash, Radio } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import UnitConverter from "@/components/UnitConverter";
import Keccak256Tool from "@/components/Keccak256Tool";
import AbiSelectorTool from "@/components/AbiSelectorTool";
import TxDecoderTool from "@/components/TxDecoderTool";
import EventLogTool from "@/components/EventLogTool";
import SignatureLookupTool from "@/components/SignatureLookupTool";

const tools = [
  { value: "converter", label: "单位转换", icon: ArrowLeftRight, component: UnitConverter },
  { value: "keccak", label: "Keccak256", icon: Hash, component: Keccak256Tool },
  { value: "selector", label: "Selector", icon: FileCode, component: AbiSelectorTool },
  { value: "decoder", label: "交易解码", icon: Code, component: TxDecoderTool },
  { value: "events", label: "事件日志", icon: Radio, component: EventLogTool },
  { value: "signature", label: "签名反查", icon: Fingerprint, component: SignatureLookupTool },
] as const;

type ToolValue = (typeof tools)[number]["value"];

export default function ToolMenu() {
  const [activeTool, setActiveTool] = useState<ToolValue | null>(null);
  const active = tools.find((tool) => tool.value === activeTool);
  const ActiveComponent = active?.component;

  return (
    <>
      <div className="hidden items-center gap-1 lg:flex" aria-label="工具箱">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.value}
              type="button"
              className="terminal-btn terminal-btn-secondary h-9 px-2.5"
              onClick={() => setActiveTool(tool.value)}
              title={tool.label}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="hidden xl:inline">{tool.label}</span>
            </button>
          );
        })}
      </div>
      <div className="hidden items-center gap-1 sm:flex lg:hidden" aria-label="工具箱">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.value}
              type="button"
              className="terminal-btn terminal-btn-secondary h-9 w-9 px-0"
              onClick={() => setActiveTool(tool.value)}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon size={15} aria-hidden="true" />
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
