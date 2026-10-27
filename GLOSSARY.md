# OneClick Contract Interaction

This context defines the language used by the contract catalog and the contract interaction workspace.

## Contract Workspace

**Contract Catalog**:
The single network-scoped list of imported contracts used for search, selection, management, and opening an interaction panel.
_Avoid_: Main list, contract table

**Interaction Panel**:
The workspace for reading from and writing to the currently selected contract.
_Avoid_: Contract tab, contract window

**Current Contract**:
The one contract whose interaction panel is currently open.
_Avoid_: Active contracts, selected contracts (when referring to multiple items)

**Selector**:
The ABI-derived identifier for a contract function, event, or custom error, shown with its canonical signature.
_Avoid_: Method ID (when the item is an event topic or custom error)

**System Log**:
The network-scoped history of read and write operations performed through interaction panels.
_Avoid_: Main list, activity feed

**Value**:
The ETH amount attached to a payable write, entered in ETH and sent as wei.
_Avoid_: Amount (when referring to the ETH attached to a transaction)

**Simulation**:
An `eth_call` executed as the connected account before a write is sent, shown in the interaction panel as 预演.
_Avoid_: Dry run, test call

**Batch Read**:
Running several read-only calls at once — either multiple methods on one contract or one method across several contracts.
_Avoid_: Multicall (when naming the feature; Multicall3 is the on-chain contract)
