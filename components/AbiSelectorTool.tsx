"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useSpring, animated, useTrail } from "react-spring";
import { Copy, FileCode, Search } from "lucide-react";
import { parseAbiSelectors, SelectorItem, SelectorType } from "@/lib/contract-utils";

const typeConfig: Record<SelectorType, { label: string; color: string; bgColor: string }> = {
  function: { label: "Function", color: "var(--terminal-blue)", bgColor: "var(--terminal-blue)" },
  event: { label: "Event", color: "var(--terminal-green)", bgColor: "var(--terminal-green)" },
  error: { label: "Error", color: "var(--terminal-red)", bgColor: "var(--terminal-red)" },
};

function SelectorRow({ item, style }: { item: SelectorItem; style: any }) {
  const cfg = typeConfig[item.type];

  return (
    <animated.div
      style={style}
      className="flex items-center justify-between p-3.5 hover:bg-[var(--terminal-hover)] transition-colors border-t border-[var(--terminal-separator)] first:border-t-0"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          className="text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 border shrink-0 uppercase"
          style={{ backgroundColor: `color-mix(in srgb, ${cfg.bgColor} 15%, transparent)`, color: cfg.color }}
        >
          {cfg.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[var(--terminal-text)] truncate">{item.name}</p>
          <p className="text-[12px] font-mono text-[var(--terminal-text-secondary)] truncate">{item.signature}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <code className="text-[12px] font-mono text-[var(--terminal-text-secondary)] bg-[var(--terminal-fill)] border border-[var(--terminal-separator)] px-2 py-1 max-w-[140px] truncate">
          {item.type === "event" ? `${item.selector.slice(0, 10)}…` : item.selector}
        </code>
        <button
          onClick={() => { navigator.clipboard.writeText(item.signature); toast.success(`[COPIED] 已复制 ${item.name} signature`); }}
          className="terminal-btn terminal-btn-secondary h-7 px-2"
          aria-label={`复制 ${item.name} 签名`}
        >
          <FileCode size={13} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(item.selector); toast.success(`[COPIED] 已复制 ${item.name} selector`); }}
          className="terminal-btn terminal-btn-secondary h-7 px-2"
          aria-label={`复制 ${item.name} 选择器`}
        >
          <Copy size={13} className="text-[var(--terminal-text-secondary)]" aria-hidden="true" />
        </button>
      </div>
    </animated.div>
  );
}

export default function AbiSelectorTool() {
  const [abiInput, setAbiInput] = useState("");
  const [items, setItems] = useState<SelectorItem[]>([]);
  const [parsed, setParsed] = useState(false);
  const [filter, setFilter] = useState<SelectorType | "all">("all");
  const [search, setSearch] = useState("");

  const fadeIn = useSpring({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    config: { tension: 280, friction: 24 },
  });

  const handleParse = () => {
    if (!abiInput.trim()) { toast.error("[INPUT_REQUIRED] 请输入 ABI JSON"); return; }
    try {
      const result = parseAbiSelectors(abiInput);
      setItems(result);
      setParsed(true);
      toast.success(`[PARSE_OK] 解析成功: ${result.length} 个选择器`);
    } catch (e: any) {
      toast.error("[PARSE_FAILED] ABI 解析失败: " + (e.message || "无效的 JSON"));
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.signature.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    all: items.length,
    function: items.filter((i) => i.type === "function").length,
    event: items.filter((i) => i.type === "event").length,
    error: items.filter((i) => i.type === "error").length,
  }), [items]);

  const trail = useTrail(filteredItems.length, {
    from: { opacity: 0, transform: "translateY(6px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    config: { tension: 300, friction: 26 },
  });

  const copyAll = () => {
    const text = filteredItems.map((i) => `${i.type}\t${i.name}\t${i.signature}\t${i.selector}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`[COPIED] 已复制 ${filteredItems.length} 个选择器`);
  };

  return (
    <animated.div style={fadeIn} className="terminal-card">
      <div className="terminal-panel-header flex items-center justify-between gap-3">
        <div>
          <h2 className="terminal-section-title">[ABI_SELECTOR_TOOL]</h2>
          <p className="text-[12px] text-[var(--terminal-text-secondary)] mt-1">
            Parse ABI and generate function/event/error selectors
          </p>
        </div>
        <span className="terminal-chip">PARSER</span>
      </div>

      <div className="terminal-panel-body space-y-4">
        {!parsed ? (
          <>
            <div className="border border-[var(--terminal-separator)] bg-[var(--terminal-fill)] p-3 space-y-3">
              <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">[ABI_INPUT]</p>
              <textarea
                id="abi-input"
                name="abi-json"
                value={abiInput}
                onChange={(e) => setAbiInput(e.target.value)}
                className="terminal-input font-mono text-[13px] resize-none"
                rows={8}
                placeholder="Paste ABI JSON array..."
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-2">
              <button className="terminal-btn terminal-btn-primary flex-1" onClick={handleParse}>
                <FileCode size={14} aria-hidden="true" />
                <span>PARSE_ABI</span>
              </button>
              <button className="terminal-btn terminal-btn-secondary" onClick={() => setAbiInput("")}>CLEAR</button>
            </div>
          </>
        ) : (
          <>
            <div className="border border-[var(--terminal-separator)]">
              <div className="px-3 py-2 border-b border-[var(--terminal-separator)] bg-[var(--terminal-fill)] flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">
                  [FILTER_AND_SEARCH]
                </p>
                <button className="terminal-btn terminal-btn-secondary text-[10px]" onClick={() => { setParsed(false); setItems([]); setFilter("all"); setSearch(""); }}>
                  BACK_TO_INPUT
                </button>
              </div>
              <div className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 p-1 bg-[var(--terminal-fill)] border border-[var(--terminal-separator)]" role="tablist" aria-label="筛选类型">
                {(["all", "function", "event", "error"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={filter === t}
                    onClick={() => setFilter(t)}
                    className={`px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] uppercase border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--terminal-blue)] ${
                      filter === t
                        ? "bg-[var(--terminal-card)] border-[var(--terminal-blue)] text-[var(--terminal-blue)]"
                        : "border-transparent text-[var(--terminal-text-secondary)]"
                    }`}
                  >
                    {t === "all" ? "All" : typeConfig[t].label} ({counts[t]})
                  </button>
                ))}
                </div>
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--terminal-text-secondary)]" aria-hidden="true" />
                  <div className="terminal-prompt-wrap">
                    <input
                      type="search"
                      name="selector-search"
                      placeholder="name / signature / selector"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="terminal-input pl-8 text-[13px]"
                      aria-label="搜索选择器"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                </div>
                <button className="terminal-btn terminal-btn-secondary text-[12px]" onClick={copyAll}>
                  <Copy size={13} aria-hidden="true" />
                  <span>COPY_ALL</span>
                </button>
              </div>
            </div>

            <div className="border border-[var(--terminal-separator)] max-h-[500px] overflow-y-auto" role="tabpanel">
              {filteredItems.length === 0 ? (
                <p className="text-center py-12 text-[14px] text-[var(--terminal-text-secondary)]">[EMPTY_RESULT] 无匹配结果</p>
              ) : (
                trail.map((style, i) => (
                  <SelectorRow key={`${filteredItems[i].type}-${filteredItems[i].name}`} item={filteredItems[i]} style={style} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </animated.div>
  );
}
