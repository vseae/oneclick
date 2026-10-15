"use client";

interface ParsedFile {
  name: string;
  address: string;
  abi: any;
}

interface BatchUploadDialogProps {
  isOpen: boolean;
  parsedFiles: ParsedFile[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BatchUploadDialog({
  isOpen,
  parsedFiles,
  onConfirm,
  onCancel,
}: BatchUploadDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      <div className="relative terminal-card max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-[var(--terminal-separator)]">
          <h2 className="text-[14px] font-bold tracking-[0.1em] uppercase text-[var(--terminal-text)]">
            批量导入合约
          </h2>
          <p className="text-[12px] text-[var(--terminal-text-secondary)] mt-1">
            共 {parsedFiles.length} 个待导入合约
          </p>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-3">
            {parsedFiles.map((file, index) => (
              <div
                key={index}
                className="border border-[var(--terminal-separator)] p-3 bg-[var(--terminal-fill)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 border border-[var(--terminal-separator)] bg-[var(--terminal-card)] flex items-center justify-center text-[var(--terminal-blue)] font-bold text-[12px]">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[13px] uppercase tracking-[0.06em] text-[var(--terminal-text)]">
                      {file.name}
                    </h3>
                    <p className="text-[11px] text-[var(--terminal-text-secondary)] font-mono mt-1 break-all">
                      {file.address}
                    </p>
                    <p className="text-[11px] text-[var(--terminal-text-secondary)] mt-2">
                      ABI 条目: {Array.isArray(file.abi) ? file.abi.length : 0}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {parsedFiles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[12px] text-[var(--terminal-text-secondary)]">暂无可导入合约</p>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--terminal-separator)] p-4 flex gap-3">
          <button
            onClick={onCancel}
            className="terminal-btn terminal-btn-secondary flex-1"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={parsedFiles.length === 0}
            className="terminal-btn terminal-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            导入 {parsedFiles.length} 个合约
          </button>
        </div>
      </div>
    </div>
  );
}
