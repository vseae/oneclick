import { createConfig, http, injected } from "wagmi";
import {
  mainnet,
  sepolia,
  sonic,
  exsat,
  sonicBlazeTestnet,
  avalanche,
  avalancheFuji,
  monad,
  monadTestnet,
} from "wagmi/chains";
import { exsatTestnet } from "@/lib/chains";

const chains = [
  mainnet,
  sepolia,
  sonic,
  sonicBlazeTestnet,
  avalanche,
  avalancheFuji,
  exsat,
  exsatTestnet,
  monad,
  monadTestnet,
] as const;

export const config = createConfig({
  chains,
  connectors: [injected()],
  // Keep the server and the first client render on the same wallet state.
  // Wagmi reconnects persisted wallet state after hydration.
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [sonic.id]: http(),
    [sonicBlazeTestnet.id]: http(),
    [avalanche.id]: http(),
    [avalancheFuji.id]: http(),
    [exsat.id]: http(),
    [exsatTestnet.id]: http(),
    [monad.id]: http(),
    [monadTestnet.id]: http(),
  },
});
