import { defineChain } from "viem";

export const sonicTestnet = defineChain({
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { decimals: 18, name: "Sonic", symbol: "S" },
  rpcUrls: { default: { http: ["https://rpc.testnet.soniclabs.com"] } },
  blockExplorers: {
    default: {
      name: "SonicScan",
      url: "https://testnet.sonicscan.org",
      apiUrl: "https://api.etherscan.io/v2/api?chainid=14601",
    },
  },
  testnet: true,
});

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
  { id: sonicTestnet.id, name: sonicTestnet.name },
  { id: 43114, name: "Avalanche" },
  { id: 43113, name: "Avalanche Fuji" },
  { id: 7200, name: "exSat" },
  { id: 840000, name: "exSat Testnet" },
  { id: 143, name: "Monad" },
  { id: 10143, name: "Monad Testnet" },
] as const;
