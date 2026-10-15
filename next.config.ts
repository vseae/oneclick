import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  // Ensure local in-app browser access via 127.0.0.1/localhost shares the same dev asset permissions.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.localhost"],
  turbopack: {
    root: path.resolve(__dirname),
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
