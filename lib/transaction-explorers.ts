import {
  avalanche,
  avalancheFuji,
  exsat,
  mainnet,
  monad,
  monadTestnet,
  sepolia,
  sonic,
} from "viem/chains";
import { exsatTestnet, sonicTestnet } from "@/lib/chains";

const chains = [
  mainnet, sepolia, sonic, sonicTestnet, avalanche, avalancheFuji,
  exsat, exsatTestnet, monad, monadTestnet,
];

export function getTransactionExplorers(chainId: number, hash: string) {
  const chain = chains.find((item) => item.id === chainId);
  if (!chain?.blockExplorers) return [];

  return Object.values(chain.blockExplorers).map((explorer) => ({
    name: explorer.name,
    url: `${explorer.url.replace(/\/$/, "")}/tx/${encodeURIComponent(hash)}`,
  }));
}
