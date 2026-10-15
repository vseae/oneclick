"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi-config";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="bottom-right" />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
