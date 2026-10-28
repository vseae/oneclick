import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  // Ensure local in-app browser access via 127.0.0.1/localhost shares the same dev asset permissions.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.localhost"],
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // WalletConnect (pulled in by RainbowKit) depends on pino@7, whose
      // thread-stream transport drags its own test files — and their dev-only
      // deps (`tape`, `tap`, `fastbench`, `desm`) — into the bundle graph.
      // pino's browser entry never touches thread-stream, so resolve to it.
      pino: "pino/browser.js",
    },
  },
  webpack: (config) => {
    config.externals.push('pino-pretty', 'encoding');
    return config;
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Connection",
          value: "keep-alive",
        },
      ],
    },
  ],
};

export default nextConfig;
