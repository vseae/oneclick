# Single Current Contract Workspace

The page uses the left-side Contract Catalog as the only contract list and keeps one Current Contract in the central Interaction Panel at a time. Selecting another contract switches the panel while preserving each contract's in-session UI state; when no contract is selected, the central area shows an explicit empty state. This removes the previous multi-panel/main-table split and keeps the System Log as the separate history surface. Deleting a contract also deletes its associated System Log entries through the existing contract-history ownership relationship.

## Considered Options

- Keep multiple interaction panels and the central contract table: rejected because the interaction area becomes difficult to scan and duplicates the left catalog.
- Open each contract in a modal: rejected because contract method interaction is a sustained workflow that needs a stable workspace.
