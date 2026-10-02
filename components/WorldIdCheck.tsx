"use client";

import { IDKitRequestWidget, proofOfHuman } from "@worldcoin/idkit";
import type { IDKitResult, RpContext } from "@worldcoin/idkit";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

interface WorldRequest {
  app_id: `app_${string}`;
  action: string;
  environment: "production" | "staging";
  rp_context: RpContext;
}

/** The World ID human check: proves this account belongs to a unique person. */
export function WorldIdCheck({ label = "Verify with World ID" }: { label?: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<WorldRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/verify/world-id/request", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start the check.");
      setRequest(data as WorldRequest);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the check.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOnServer(result: IDKitResult) {
    const res = await fetch("/api/verify/world-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.error ?? "The check failed.";
      setError(message);
      throw new Error(message);
    }
  }

  return (
    <div>
      <button type="button" onClick={begin} disabled={busy} className={buttonClass.secondary}>
        {busy ? "Preparing…" : label}
      </button>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      {request?.environment === "staging" ? (
        <p className="mt-2 text-xs text-slate-500">
          Test mode: scan or paste the code in World&apos;s simulator at simulator.worldcoin.org, not in the World App.
        </p>
      ) : null}
      {request ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={request.app_id}
          action={request.action}
          rp_context={request.rp_context}
          environment={request.environment}
          allow_legacy_proofs={true}
          preset={proofOfHuman()}
          handleVerify={verifyOnServer}
          onSuccess={() => router.refresh()}
          onError={() => setError((current) => current ?? "The check was not completed.")}
        />
      ) : null}
    </div>
  );
}
