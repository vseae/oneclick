"use client";

import { useAccount } from "wagmi";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";
import {
  deleteContract as deleteLocalContract,
  deleteContracts as deleteLocalContracts,
  listContractsByChainId,
  updateContractById,
} from "@/lib/local-store";

interface Contract {
  id: number;
  name: string;
  address: string;
  abi: ethers.InterfaceAbi;
  chainId: number;
  createdAt: string;
}

interface ContractListProps {
  onSelectContract: (contract: any) => void;
  selectedContractId?: number;
}

type SortType = "name-asc" | "name-desc" | "time-asc" | "time-desc" | "manual";

export default function ContractList({
  onSelectContract,
  selectedContractId,
}: ContractListProps) {
  const { chainId } = useAccount();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAbi, setEditAbi] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 4;
  const [currentPage, setCurrentPage] = useState(1);
  const [sortType, setSortType] = useState<SortType>("time-desc");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [manualOrder, setManualOrder] = useState<number[]>([]);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchContracts = useCallback(async () => {
    if (!chainId) {
      setContracts([]);
      setLoading(false);
      return;
    }

    try {
      const data = await listContractsByChainId(chainId);
      setContracts(data as Contract[]);
    } catch (error) {
      console.error("Failed to fetch contracts:", error);
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    const handleUpdate = () => fetchContracts();
    window.addEventListener("contractsUpdated", handleUpdate);
    return () => window.removeEventListener("contractsUpdated", handleUpdate);
  }, [fetchContracts]);

  // Filter contracts by search query
  const filteredContracts = useMemo(() => {
    if (!searchQuery) return contracts;
    const query = searchQuery.toLowerCase();
    return contracts.filter(
      (contract) =>
        contract.name.toLowerCase().includes(query) ||
        contract.address.toLowerCase().includes(query)
    );
  }, [contracts, searchQuery]);

  // Sort contracts
  const sortedContracts = useMemo(() => {
    const sorted = [...filteredContracts];
    switch (sortType) {
      case "name-asc":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case "time-asc":
        return sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "time-desc":
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "manual":
        if (manualOrder.length === 0) return sorted;
        return sorted.sort((a, b) => {
          const indexA = manualOrder.indexOf(a.id);
          const indexB = manualOrder.indexOf(b.id);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      default:
        return sorted;
    }
  }, [filteredContracts, sortType, manualOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedContracts.length / pageSize);
  const paginatedContracts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedContracts.slice(start, start + pageSize);
  }, [sortedContracts, currentPage, pageSize]);

  // Initialize manual order
  useEffect(() => {
    if (contracts.length > 0 && manualOrder.length === 0) {
      setManualOrder(contracts.map((c) => c.id));
    }
  }, [contracts, manualOrder.length]);

  // Reset to page 1 when search query or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const handleClearAll = async () => {
    try {
      if (contracts.length === 0) {
        toast.error("No contracts to clear");
        return;
      }

      const ids = contracts.map((c) => c.id);
      await deleteLocalContracts(ids);
      toast.success("🎉 All contracts cleared!");
      setShowClearDialog(false);
      fetchContracts();
    } catch (error) {
      toast.error("Failed to clear contracts");
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteLocalContract(id);
      toast.success("✅ Contract deleted");
      setShowDeleteDialog(false);
      setDeleteTargetId(null);
      await fetchContracts();
    } catch (error: any) {
      toast.error(`Failed to delete contract: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setSortType("manual");
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...manualOrder];
    const draggedId = sortedContracts[draggedIndex].id;
    const targetId = sortedContracts[index].id;

    const draggedOrderIndex = newOrder.indexOf(draggedId);
    const targetOrderIndex = newOrder.indexOf(targetId);

    newOrder.splice(draggedOrderIndex, 1);
    newOrder.splice(targetOrderIndex, 0, draggedId);

    setManualOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleEdit = (contract: Contract) => {
    setEditingId(contract.id);
    setEditName(contract.name);
    setEditAddress(contract.address);
    setEditAbi(JSON.stringify(contract.abi, null, 2));
  };

  const handleSaveEdit = async (id: number) => {
    try {
      let parsedAbi;
      try {
        parsedAbi = JSON.parse(editAbi);
      } catch {
        toast.error("Invalid ABI JSON format");
        return;
      }

      await updateContractById(id, {
        name: editName,
        address: editAddress,
        abi: parsedAbi,
      });
      setEditingId(null);
      toast.success("Contract updated");
      if (selectedContractId === id) {
        onSelectContract({
          id,
          name: editName,
          address: editAddress,
          abi: parsedAbi,
          chainId: chainId || 1,
          createdAt: "",
        });
      }
      fetchContracts();
    } catch (error: any) {
      toast.error(error.message || "Failed to update contract");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditAddress("");
    setEditAbi("");
  };

  if (loading) {
    return (
      <div className="terminal-card p-6 text-center terminal-scanline">
        <p className="text-[13px] tracking-[0.08em] uppercase text-[var(--terminal-text-secondary)]">Loading contracts... ⏳</p>
      </div>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <div className="terminal-card p-6 text-center terminal-scanline">
        <p className="text-[13px] leading-relaxed text-[var(--terminal-text-secondary)]">
          No contracts found for this network. Upload some contracts to get
          started! 🚀
        </p>
      </div>
    );
  }

  return (
    <div className="terminal-card p-6 terminal-scanline">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[18px] font-bold tracking-[0.08em] uppercase text-[var(--terminal-red)]">📋 Contracts</h2>
        {contracts.length > 0 && (
          <button
            onClick={() => setShowClearDialog(true)}
            className="terminal-btn text-[var(--terminal-red)] border-[var(--terminal-red)] hover:bg-[var(--terminal-red)] hover:text-[#2a0909]"
            title="Clear all contracts"
          >
            🗑️ Clear All
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="terminal-input w-full"
          placeholder="🔍 Search by name or address..."
        />
      </div>

      {/* Sort and Page Size Controls */}
      {contracts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          {/* Sort Buttons */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-[12px] font-semibold tracking-[0.06em] uppercase self-center mr-1 text-[var(--terminal-text-secondary)]">
              Sort:
            </span>
            <button
              onClick={() => setSortType("name-asc")}
              className={`terminal-btn text-[11px] px-3 py-1 ${
                sortType === "name-asc"
                  ? "bg-[var(--terminal-blue)] text-[#022628] border-[var(--terminal-blue)]"
                  : "terminal-btn-secondary"
              }`}
            >
              🔤 A→Z
            </button>
            <button
              onClick={() => setSortType("name-desc")}
              className={`terminal-btn text-[11px] px-3 py-1 ${
                sortType === "name-desc"
                  ? "bg-[var(--terminal-blue)] text-[#022628] border-[var(--terminal-blue)]"
                  : "terminal-btn-secondary"
              }`}
            >
              🔤 Z→A
            </button>
            <button
              onClick={() => setSortType("time-asc")}
              className={`terminal-btn text-[11px] px-3 py-1 ${
                sortType === "time-asc"
                  ? "bg-[var(--terminal-blue)] text-[#022628] border-[var(--terminal-blue)]"
                  : "terminal-btn-secondary"
              }`}
            >
              ⏰ Old
            </button>
            <button
              onClick={() => setSortType("time-desc")}
              className={`terminal-btn text-[11px] px-3 py-1 ${
                sortType === "time-desc"
                  ? "bg-[var(--terminal-blue)] text-[#022628] border-[var(--terminal-blue)]"
                  : "terminal-btn-secondary"
              }`}
            >
              ⏰ New
            </button>
            <button
              onClick={() => setSortType("manual")}
              className={`terminal-btn text-[11px] px-3 py-1 ${
                sortType === "manual"
                  ? "bg-[var(--terminal-blue)] text-[#022628] border-[var(--terminal-blue)]"
                  : "terminal-btn-secondary"
              }`}
            >
              ✋ Manual
            </button>
          </div>

          {/* Removed Page Size Selector - Fixed to 4 items per page */}
        </div>
      )}

      <div className="space-y-3">
        {paginatedContracts.map((contract, index) => (
          <div
            key={contract.id}
            draggable={sortType === "manual"}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`border p-4 transition-all ${
              sortType === "manual" ? "cursor-move" : ""
            } ${
              selectedContractId === contract.id
                ? "bg-[var(--terminal-blue)]/12 border-[var(--terminal-blue)]"
                : "bg-[var(--terminal-card)] border-[var(--terminal-separator)] hover:border-[var(--terminal-blue)]/55"
            }`}
          >
            {editingId === contract.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="terminal-input w-full"
                  placeholder="Contract Name"
                />
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="terminal-input w-full font-mono"
                  placeholder="Contract Address"
                />
                <textarea
                  value={editAbi}
                  onChange={(e) => setEditAbi(e.target.value)}
                  className="terminal-input w-full min-h-[200px] font-mono text-xs"
                  placeholder="ABI JSON"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(contract.id!)}
                    className="terminal-btn flex-1 text-[var(--terminal-green)] border-[var(--terminal-green)] hover:bg-[var(--terminal-green)] hover:text-[#052006]"
                  >
                    💾 Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="terminal-btn terminal-btn-secondary flex-1"
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-[16px] font-bold tracking-[0.04em] text-[var(--terminal-text)]">
                    {contract.name}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(contract)}
                      className="text-[var(--terminal-blue)] hover:text-[var(--terminal-blue)]/80 text-lg"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTargetId(contract.id!);
                        setShowDeleteDialog(true);
                      }}
                      className="text-[var(--terminal-red)] hover:text-[var(--terminal-red)]/80 text-lg"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <p className="text-[12px] text-[var(--terminal-text-secondary)] font-mono break-all mb-3">
                  {contract.address}
                </p>

                <button
                  onClick={() => onSelectContract(contract)}
                  className="terminal-btn terminal-btn-primary w-full"
                >
                  🔌 Interact
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="terminal-btn terminal-btn-secondary px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-[12px] font-semibold tracking-[0.04em] text-[var(--terminal-text-secondary)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="terminal-btn terminal-btn-secondary px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showClearDialog}
        title="Clear All Contracts?"
        message="⚠️ This will permanently delete ALL contracts for this network. This action cannot be undone!"
        confirmText="Yes, Clear All"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearDialog(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Contract?"
        message="Are you sure you want to delete this contract? This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type="warning"
        onConfirm={() => deleteTargetId && handleDelete(deleteTargetId)}
        onCancel={() => {
          setShowDeleteDialog(false);
          setDeleteTargetId(null);
        }}
      />
    </div>
  );
}
