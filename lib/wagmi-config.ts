import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
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

/**
 * RainbowKit ships icons for the chains it knows about; the rest render as a
 * bare label in the network switcher. Logos are bundled under `public/chains/`
 * so the switcher never depends on a third-party host staying up. Testnets
 * reuse their mainnet mark.
 */
const iconUrl = (file: string) => `/chains/${file}`;

const sonicWithIcon = { ...sonic, iconUrl: iconUrl("sonic.png") };
const sonicBlazeWithIcon = { ...sonicBlazeTestnet, iconUrl: iconUrl("sonic.png") };
const exsatWithIcon = { ...exsat, iconUrl: iconUrl("exsat.png") };
const exsatTestnetWithIcon = { ...exsatTestnet, iconUrl: iconUrl("exsat.png") };
const monadWithIcon = { ...monad, iconUrl: iconUrl("monad.svg") };
const monadTestnetWithIcon = { ...monadTestnet, iconUrl: iconUrl("monad.svg") };

export const chains = [
  mainnet,
  sepolia,
  sonicWithIcon,
  sonicBlazeWithIcon,
  avalanche,
  avalancheFuji,
  exsatWithIcon,
  exsatTestnetWithIcon,
  monadWithIcon,
  monadTestnetWithIcon,
] as const;

/**
 * WalletConnect Cloud project ID. Required by RainbowKit's default wallet set —
 * without it the WalletConnect-based wallets fail to connect, so the value is
 * inlined at build time from the environment rather than defaulted silently.
 */
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "";

export const config = getDefaultConfig({
  appName: "OneClick",
  appDescription: "Interact with EVM smart contracts easily",
  projectId,
  chains,
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
