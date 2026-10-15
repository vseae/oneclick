import { defineChain } from "viem";

export const exsatTestnet = defineChain({
  id: 840000,
  name: "exSat Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "BTC",
    symbol: "BTC",
  },
  rpcUrls: {
    default: { http: ["https://evm2.exactsat.io/"] },
  },
  blockExplorers: {
    default: {
      name: "exSat Explorer",
      url: "https://scan-testnet.exsat.network",
      apiUrl: "https://scan-testnet.exsat.network/api",
    },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 11155111, name: "Sepolia" },
  { id: 146, name: "Sonic" },
  { id: 64165, name: "Sonic Blaze Testnet" },
  { id: 43114, name: "Avalanche" },
  { id: 43113, name: "Avalanche Fuji" },
  { id: 7200, name: "exSat" },
  { id: 840000, name: "exSat Testnet" },
  { id: 143, name: "Monad" },
  { id: 10143, name: "Monad Testnet" },
] as const;
