import { parseAbi } from "viem";

/**
 * Multicall3 deployment registry.
 *
 * Source: https://www.multicall3.com/deployments (backed by the `deployments.json`
 * file in https://github.com/mds1/multicall). Regenerate this list when the
 * upstream deployment set changes.
 *
 * Sonic Testnet (14601) is also included based on its verified on-chain
 * deployment, which is not yet in the upstream list.
 *
 * Chains absent here have no known deployment, so batch reads stay disabled.
 */

export const MULTICALL3_CANONICAL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

/** Chains where Multicall3 is deployed at the canonical address. */
const CANONICAL_CHAIN_IDS: readonly number[] = [
  1, 3, 4, 5, 10, 14, 16, 18, 19, 25, 30, 31,
  40, 42, 56, 57, 61, 66, 69, 82, 83, 88, 89, 97,
  100, 106, 108, 109, 114, 122, 128, 130, 137, 138, 143, 146,
  148, 169, 185, 195, 196, 199, 204, 223, 239, 250, 252, 255,
  288, 311, 314, 321, 335, 338, 369, 420, 424, 480, 484, 499,
  545, 570, 592, 599, 689, 710, 747, 813, 820, 943, 964, 988,
  998, 999, 1029, 1030, 1088, 1101, 1111, 1114, 1115, 1116, 1130, 1131,
  1135, 1234, 1284, 1285, 1287, 1315, 1329, 1442, 1514, 1570, 1578, 1625,
  1689, 1729, 1868, 1875, 1992, 1996, 2000, 2001, 2021, 2222, 2331, 2345,
  2358, 2442, 2522, 2710, 2810, 2818, 3501, 3502, 3636, 3637, 3737, 3776,
  3799, 3939, 4002, 4061, 4062, 4201, 4689, 4759, 5000, 5001, 5003, 5101,
  5464, 5555, 5611, 5700, 5845, 5888, 6342, 6699, 7000, 7001, 7070, 7518,
  7560, 7700, 7701, 7869, 7979, 8082, 8131, 8453, 8822, 8899, 8911, 9000,
  9001, 9393, 9745, 10088, 10143, 10200, 10242, 10243, 11119, 11235, 11503, 12553,
  13371, 13473, 14601, 15557, 16661, 17000, 17777, 23294, 23451, 24101, 28802, 31612, 32520,
  32659, 33139, 34443, 35441, 35442, 35443, 41455, 41923, 42161, 42170, 42220, 42262,
  42299, 42766, 42793, 43111, 43113, 43114, 44787, 46688, 48899, 53302, 53935, 55244,
  57000, 57073, 58008, 59140, 59141, 59144, 59902, 60808, 64240, 71401, 80001, 80002,
  80069, 80094, 81457, 84531, 84532, 88811, 88817, 88819, 88882, 88888, 94168, 97477,
  98866, 98867, 98985, 111188, 112358, 128123, 132902, 167000, 167007, 167008, 167009, 200901,
  313313, 325000, 421611, 421613, 421614, 534351, 534352, 534353, 560048, 612055, 656476, 660279,
  686868, 713715, 743111, 747474, 763373, 1637450, 6038361, 7777777, 9999999, 11155111, 11155420, 12227330,
  23011913, 37084624, 52164803, 68840142, 89346162, 111557560, 168587773, 245022926, 245022934, 974399131, 999999999, 1020352220,
  1313161554, 1350216234, 1444673419, 1482601649, 1564830818, 1666600000, 2046399126, 5264468217, 47279324479, 123420000220,
];

/** Chains that deployed Multicall3 at a different address by design. */
const ADDRESS_OVERRIDES: Readonly<Record<number, string>> = {
  280: "0xF9cda624FBC7e059355ce98a31693d299FACd963",
  300: "0xF9cda624FBC7e059355ce98a31693d299FACd963",
  324: "0xF9cda624FBC7e059355ce98a31693d299FACd963",
  2741: "0xF9cda624FBC7e059355ce98a31693d299FACd963",
  11124: "0xF9cda624FBC7e059355ce98a31693d299FACd963",
  54176: "0x03657CDcDA1523C073b5e09c37dd199E6fBD1b99",
  541764: "0x03657CDcDA1523C073b5e09c37dd199E6fBD1b99",
  1612127: "0xF9cda624FBC7e059355ce98a31693d299FACd963",
};

const CANONICAL_CHAIN_SET: ReadonlySet<number> = new Set(CANONICAL_CHAIN_IDS);

/** Resolve the Multicall3 address for a chain, or null when it is not deployed. */
export function getMulticall3Address(chainId?: number | null): string | null {
  if (typeof chainId !== "number") return null;
  const override = ADDRESS_OVERRIDES[chainId];
  if (override) return override;
  return CANONICAL_CHAIN_SET.has(chainId) ? MULTICALL3_CANONICAL_ADDRESS : null;
}

export function isMulticall3Supported(chainId?: number | null): boolean {
  return getMulticall3Address(chainId) !== null;
}

/** Subset of the Multicall3 ABI needed to batch read-only calls. */
export const MULTICALL3_ABI = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);
