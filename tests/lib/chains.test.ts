import { describe, expect, it } from "vitest";
import { sonicTestnet, SUPPORTED_CHAINS } from "@/lib/chains";

describe("Sonic Testnet", () => {
  it("uses the current official network parameters in the contract preset", () => {
    expect(sonicTestnet.id).toBe(14601);
    expect(sonicTestnet.name).toBe("Sonic Testnet");
    expect(sonicTestnet.rpcUrls.default.http).toEqual(["https://rpc.testnet.soniclabs.com"]);
    expect(sonicTestnet.blockExplorers.default.url).toBe("https://testnet.sonicscan.org");
    expect(SUPPORTED_CHAINS).toContainEqual({ id: sonicTestnet.id, name: sonicTestnet.name });
    const chainIds: number[] = SUPPORTED_CHAINS.map((chain) => chain.id);
    expect(chainIds).not.toContain(64165);
    expect(chainIds).not.toContain(57054);
  });
});
