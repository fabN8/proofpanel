"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass } from "./ui";

export function SignInForm({ next, cta = "Continue" }: { next?: string; cta?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed.");
      if (next) router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium text-slate-700" htmlFor="email">
        Email address
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@university.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? "Signing in…" : cta}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <p className="text-xs text-slate-500">
        Demo sign-in: no password and no email is sent. A Solana wallet is created for you in the background. How your data is
        used:{" "}
        <Link href="/privacy" className="text-indigo-700 hover:underline">
          privacy notice
        </Link>
        .
      </p>
    </form>
  );
}
