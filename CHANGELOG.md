# Changelog

All notable changes to this project are documented in this file. Versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-09

First versioned release, covering the project history to date.

### Added

- Import, organize, and manage contracts, including directories and bulk selection.
- Read and write contract functions, with typed parameter validation, transaction simulation, gas estimation, and write confirmation.
- Batch-read contract data and view transaction and operation history, with links to block explorers.
- Encode and decode ABI data, transactions, and event logs, and look up function, event, and error signatures.
- Convert token units, number bases, strings and bytes32, and Unix timestamps; calculate Keccak256 hashes.
- Connect wallets through RainbowKit, including WalletConnect, with address avatars and bundled chain icons.

### Changed

- Consolidated contract interaction into a single workspace and moved tools into a dedicated panel.
- Improved tool navigation, responsive layout, accessibility, and reduced-motion support.
- Migrated contract tools and wallet interactions to viem.

### Fixed

- Validated contract imports and synchronized workspace data with the contract catalog.
- Updated the Sonic testnet configuration and Multicall3 deployment.
