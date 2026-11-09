# OneClick

OneClick is a smart contract interaction tool for EVM networks. It lets you read and call contracts using their ABIs and provides utilities for working with on-chain data.

## Features

- Import, organize, and manage contracts; read and write through a wallet with transaction simulation and gas estimation.
- Batch-read contracts and view transaction and operation history.
- Encode and decode ABIs, transactions, and event logs; look up function and event signatures.
- Use common utilities such as unit conversion and Keccak256 hashing.

## Getting started

Requires Node.js 22 or later and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Set `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` in `.env.local` using a project ID from [WalletConnect](https://cloud.walletconnect.com/) to enable WalletConnect connections. Open <http://localhost:3006> after starting the server.

The project uses Next.js, React, wagmi, and viem. Contracts and operation history are stored in `data/app.sqlite` on the machine running the server.

```bash
pnpm test   # Run tests
pnpm build  # Build for production
```
