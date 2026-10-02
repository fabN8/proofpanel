"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "./ui";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sign-in with a one-time email code. Privy verifies the email and creates the user's own Solana wallet. */
export function PrivySignIn({ next, cta = "Sign in with email" }: { next?: string; cta?: string }) {
  const router = useRouter();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Trades the Privy sign-in for this app's session. Retries while the wallet is still being created. */
  async function exchange() {
    setBusy(true);
    setError(null);
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const token = await getAccessToken();
        if (!token) throw new Error("The sign-in did not complete. Please try again.");
        const res = await fetch("/api/auth/privy", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (next) router.push(next);
          router.refresh();
          return;
        }
        if (data.code !== "wallet_pending") throw new Error(data.error ?? "Sign-in failed.");
        setNote("Creating your wallet…");
        await sleep(1500);
      }
      throw new Error("Your wallet was not ready in time. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
      setNote(null);
    }
  }

  // If Privy has not loaded after a while, say why the button is still greyed out.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [ready]);

  const { login } = useLogin({
    onComplete: () => void exchange(),
    onError: (code) => {
      if (code !== "exited_auth_flow") setError("Sign-in was not completed. Please try again.");
    },
  });

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={!ready || busy}
        className={`${buttonClass.primary} w-full`}
        onClick={() => (authenticated ? void exchange() : login())}
      >
        {busy ? (note ?? "Signing in…") : cta}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {!ready && slow ? (
        <p className="text-sm text-amber-700">
          Sign-in is taking long to load. If this stays, check the Privy app id and that this address is an allowed origin in
          the Privy dashboard.
        </p>
      ) : null}
      <p className="text-xs text-slate-500">
        You get a one-time code by email. A Solana wallet that only you control is created for you; rewards are paid to it.
      </p>
    </div>
  );
}
