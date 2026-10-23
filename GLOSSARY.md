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
