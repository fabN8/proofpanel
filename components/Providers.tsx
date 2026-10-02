"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

/** Wraps the app with Privy only when email login is configured. */
export function Providers({ privyAppId, children }: { privyAppId: string | null; children: ReactNode }) {
  if (!privyAppId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email"],
        appearance: { walletChainType: "solana-only" },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          ethereum: { createOnLogin: "off" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
