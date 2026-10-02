"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, buttonClass } from "./ui";

type State =
  | { kind: "loading" }
  | { kind: "paid"; amount: string; wallet: string; explorer: string | null; alreadyPaid: boolean; title: string }
  | { kind: "wait"; seconds: number; message: string }
  | { kind: "error"; message: string };

export function DoneClient({ token, code }: { token: string; code: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const started = useRef(false);

  const claim = useCallback(async () => {
    try {
      const res = await fetch("/api/submissions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, cc: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({
          kind: "paid",
          amount: (data.amountBase / 1_000_000).toFixed(2),
          wallet: data.wallet,
          explorer: data.explorer,
          alreadyPaid: data.alreadyPaid,
          title: data.studyTitle,
        });
      } else if (data.code === "too_fast") {
        setState({ kind: "wait", seconds: Number(data.waitSeconds) || 5, message: data.error });
      } else if (data.code === "paying") {
        setState({ kind: "wait", seconds: 3, message: data.error });
      } else {
        setState({ kind: "error", message: data.error ?? "Something went wrong." });
      }
    } catch {
      setState({ kind: "error", message: "Could not reach the server. Check your connection and try again." });
    }
  }, [token, code]);

  // Claim once when the page opens. The server is idempotent, so a repeat would not pay twice.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void claim();
  }, [claim]);

  // While waiting, count down one second at a time, then try again.
  useEffect(() => {
    if (state.kind !== "wait") return;
    const timer = setTimeout(() => {
      if (state.seconds <= 1) {
        setState({ kind: "loading" });
        void claim();
      } else {
        setState({ ...state, seconds: state.seconds - 1 });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, claim]);

  function retry() {
    setState({ kind: "loading" });
    void claim();
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-3" role="status">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden="true" />
        <p className="text-sm text-slate-700">Checking your completion and sending your payment…</p>
      </div>
    );
  }
  if (state.kind === "paid") {
    return (
      <div className="space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Icon name="check" className="h-7 w-7" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {state.alreadyPaid ? "Already paid" : "You have been paid"} {state.amount} USDC
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">For “{state.title}”. The money is in your wallet:</p>
        <p className="mono break-all rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink">{state.wallet}</p>
        {state.explorer ? (
          <a className={buttonClass.secondary} href={state.explorer} target="_blank" rel="noreferrer">
            View the payment on Solana Explorer
          </a>
        ) : (
          <p className="text-sm text-slate-500">Simulation mode: this payment was not sent on a blockchain.</p>
        )}
      </div>
    );
  }
  if (state.kind === "wait") {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Almost there</h1>
        <p className="text-sm text-slate-700">{state.message}</p>
        <p className="text-sm text-slate-500">Your payment is sent in {state.seconds} s. Keep this page open.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">No payment</h1>
      <p className="text-sm text-rose-700">{state.message}</p>
      <button type="button" onClick={retry} className={buttonClass.secondary}>
        Try again
      </button>
    </div>
  );
}
