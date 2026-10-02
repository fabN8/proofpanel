"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

/** A button that sends one POST request, shows progress and errors, then refreshes or navigates. */
export function ActionButton({
  url,
  label,
  busyLabel = "Working…",
  variant = "primary",
  confirmText,
  redirectTo,
  successText,
}: {
  url: string;
  label: string;
  busyLabel?: string;
  variant?: keyof typeof buttonClass;
  confirmText?: string;
  redirectTo?: string;
  successText?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setDone(true);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={run} disabled={busy} className={buttonClass[variant]}>
        {busy ? busyLabel : label}
      </button>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      {done && successText && !error ? <p className="mt-2 text-sm text-emerald-700">{successText}</p> : null}
    </div>
  );
}
