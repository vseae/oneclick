"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import BatchUploadDialog from "./BatchUploadDialog";
import { upsertContract, upsertContractsBatch } from "@/lib/local-store";

export default function ContractUpload() {
  const { chainId } = useAccount();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [abiText, setAbiText] = useState("");
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<
    Array<{ name: string; address: string; abi: any }>
  >([]);

  const handleSingleUpload = async () => {
    try {
      if (!name || !address || !abiText) {
        toast.error("Please fill in all fields!");
        return;
      }

      const abi = JSON.parse(abiText);
      await upsertContract({
        name,
        address,
        abi,
        chainId: chainId || 1,
      });

      toast.success(`Contract "${name}" uploaded successfully!`);
      setName("");
      setAddress("");
      setAbiText("");

      // Trigger a refresh and switch to contracts tab
      window.dispatchEvent(new Event("contractsUpdated"));
      window.dispatchEvent(new Event("contractUploaded"));
    } catch (error: any) {
      toast.error(error.message || "Failed to upload contract");
    }
  };

  const handleBatchUpload = async () => {
    try {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      fileInput.accept = ".json";

      fileInput.onchange = async (e: any) => {
        const files = Array.from(e.target.files) as File[];

        if (files.length === 0) {
          toast.error("No files selected");
          return;
        }

        setIsUploadingBatch(true);

        try {
          // Parse all JSON files and extract contract info
          const parsedFilesList: {
            name: string;
            address: string;
            abi: any;
          }[] = [];

          for (const file of files) {
            try {
              const content = await file.text();
              const json = JSON.parse(content);

              // Extract contract name from filename (remove .json extension)
              const contractName = file.name.replace(/\.json$/, "");

              // 过滤掉 _Implementation 和 _Proxy 文件
              if (
                contractName.includes("_Implementation") ||
                contractName.includes("_Proxy")
              ) {
                console.log(`Skipping ${contractName} (Implementation/Proxy)`);
                continue;
              }

              // Check if the JSON has the expected structure
              if (json.address && json.abi) {
                parsedFilesList.push({
                  name: contractName,
                  address: json.address,
                  abi: json.abi,
                });
              } else {
                toast.error(
                  `Invalid format in ${file.name}. Expected {address, abi}`
                );
              }
            } catch {
              toast.error(`Failed to parse ${file.name}`);
            }
          }

          if (parsedFilesList.length === 0) {
            toast.error("No valid deployment files found");
            setIsUploadingBatch(false);
            return;
          }

          // Show confirmation dialog
          setParsedFiles(parsedFilesList);
          setShowBatchDialog(true);
        } catch {
          toast.error("Failed to read files");
          setIsUploadingBatch(false);
        }
      };

      fileInput.click();
    } catch (error: any) {
      toast.error(error.message || "Failed to batch upload");
      setIsUploadingBatch(false);
    }
  };

  const handleBatchUploadConfirm = async () => {
    try {
      // Upload all parsed contracts
      const contractsToUpload = parsedFiles.map((file) => ({
        name: file.name,
        address: file.address,
        abi: file.abi,
        chainId: chainId || 1,
      }));
      const result = await upsertContractsBatch(contractsToUpload);
      const successCount = result.filter((r) => r.success).length;

      toast.success(`✨ Uploaded ${successCount} contracts!`);
      setShowBatchDialog(false);
      setIsUploadingBatch(false);
      setParsedFiles([]);

      // Trigger a refresh and switch to contracts tab
      window.dispatchEvent(new Event("contractsUpdated"));
      window.dispatchEvent(new Event("contractUploaded"));
    } catch (error: any) {
      toast.error(error.message || "Failed to upload contracts");
      setIsUploadingBatch(false);
    }
  };

  return (
    <div className="terminal-card p-6 space-y-6 terminal-scanline">
      <h2 className="text-[18px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-red)] mb-1">
        📄 Upload Contract
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-semibold tracking-[0.06em] uppercase mb-2 text-[var(--terminal-text-secondary)]">
            Contract Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="terminal-input w-full"
            placeholder="MyContract"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold tracking-[0.06em] uppercase mb-2 text-[var(--terminal-text-secondary)]">
            Contract Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="terminal-input w-full font-mono"
            placeholder="0x..."
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold tracking-[0.06em] uppercase mb-2 text-[var(--terminal-text-secondary)]">
            ABI (JSON)
          </label>
          <textarea
            value={abiText}
            onChange={(e) => setAbiText(e.target.value)}
            className="terminal-input w-full min-h-[220px] font-mono text-[12px] resize-y"
            placeholder='[{"inputs":[],"name":"myFunction","outputs":[],"stateMutability":"view","type":"function"}]'
            spellCheck={false}
          />
        </div>

        <button
          onClick={handleSingleUpload}
          className="terminal-btn terminal-btn-primary w-full"
        >
          📤 Upload Single Contract
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-[var(--terminal-separator)]" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="px-3 bg-[var(--terminal-card)] text-[var(--terminal-text-secondary)] font-semibold tracking-[0.08em] uppercase">
              OR
            </span>
          </div>
        </div>

        <button
          onClick={handleBatchUpload}
          disabled={isUploadingBatch}
          className="terminal-btn w-full border-[var(--terminal-green)] text-[var(--terminal-green)] hover:bg-[var(--terminal-green)] hover:text-[#051a06] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isUploadingBatch ? "⏳ Uploading..." : "📦 Batch Upload"}
        </button>

        <p className="text-[11px] text-[var(--terminal-text-secondary)] text-center leading-relaxed">
          Select JSON deployment files (e.g., FUSDGateway.json) with{" "}
          <code className="bg-[var(--terminal-fill)] px-1.5 py-0.5 border border-[var(--terminal-separator)] text-[var(--terminal-blue)]">address</code> and{" "}
          <code className="bg-[var(--terminal-fill)] px-1.5 py-0.5 border border-[var(--terminal-separator)] text-[var(--terminal-blue)]">abi</code> fields
        </p>
      </div>

      {/* Batch Upload Dialog */}
      <BatchUploadDialog
        isOpen={showBatchDialog}
        parsedFiles={parsedFiles}
        onConfirm={handleBatchUploadConfirm}
        onCancel={() => {
          setShowBatchDialog(false);
          setIsUploadingBatch(false);
          setParsedFiles([]);
        }}
      />
    </div>
  );
}
