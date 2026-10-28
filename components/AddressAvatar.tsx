"use client";

import { useMemo } from "react";

interface AddressAvatarProps {
  address: string;
  ensImage?: string | null;
  size: number;
}

/** Block colours pulled from the terminal palette so avatars stay on-theme. */
const BLOCK_COLORS = ["#2563eb", "#0f766e", "#b45309", "#5b7ea8", "#1d4ed8", "#0e7490"];

/**
 * Deterministic blockie-style identicon generated from the address bytes.
 *
 * Replaces RainbowKit's default emoji avatar. The pattern is mirrored on the
 * vertical axis so it reads as an identicon while staying recognisable per
 * address — the same address always produces the same avatar.
 */
export default function AddressAvatar({ address, ensImage, size }: AddressAvatarProps) {
  const { cells, color, background } = useMemo(() => {
    const hex = address.toLowerCase().replace(/^0x/, "");
    const bytes: number[] = [];
    for (let index = 0; index < 32; index += 2) {
      bytes.push(parseInt(hex.slice(index, index + 2) || "0", 16));
    }

    const cells: boolean[] = [];
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const mirrored = column < 3 ? column : 4 - column;
        cells.push(bytes[(row * 3 + mirrored) % bytes.length] % 3 !== 0);
      }
    }

    return {
      cells,
      color: BLOCK_COLORS[bytes[0] % BLOCK_COLORS.length],
      background: "#f8fbff",
    };
  }, [address]);

  const box = { width: size, height: size, borderRadius: 9999 } as const;

  // An ENS avatar, when one exists, wins over the generated pattern.
  if (ensImage) {
    return (
      <div
        role="img"
        aria-hidden="true"
        style={{
          ...box,
          backgroundImage: `url(${ensImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          flexShrink: 0,
        }}
      />
    );
  }

  const cell = 100 / 5;

  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ ...box, display: "block", flexShrink: 0 }}
    >
      <rect width="100" height="100" fill={background} />
      {cells.map((filled, index) =>
        filled ? (
          <rect
            key={index}
            x={(index % 5) * cell}
            y={Math.floor(index / 5) * cell}
            width={cell}
            height={cell}
            fill={color}
          />
        ) : null
      )}
    </svg>
  );
}
