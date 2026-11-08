import { avalanche, avalancheFuji, exsat, mainnet, monad, monadTestnet, sepolia, sonic } from "viem/chains";
import { exsatTestnet, sonicTestnet } from "./chains";
import { formatAmount } from "./convert";

const chains = [mainnet, sepolia, sonic, sonicTestnet, avalanche, avalancheFuji, exsat, exsatTestnet, monad, monadTestnet];

export function getNativeChain(chainId: number | undefined) {
  return chains.find((chain) => chain.id === chainId);
}

export function getNativeCurrency(chainId: number | undefined): { name: string; symbol: string; decimals: number } | undefined {
  const currency = getNativeChain(chainId)?.nativeCurrency;
  if (!currency?.symbol || !Number.isInteger(currency.decimals) || currency.decimals < 0 || currency.decimals > 255) return undefined;
  return currency;
}

export function formatNativeAmount(value: bigint, chainId: number | undefined): string {
  const currency = getNativeCurrency(chainId);
  if (!currency) return `${value} 最小单位（币种未知）`;
  return `${formatAmount(value, currency.decimals)} ${currency.symbol}`;
}
