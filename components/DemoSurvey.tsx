"use client";

import { useState } from "react";
import { COMMENT_MAX, DEMO_QUESTIONS, TRUST_OPTIONS, USAGE_OPTIONS } from "@/lib/survey/demo";
import { buttonClass, inputClass } from "./ui";

export function DemoSurvey({ studyId, pid }: { studyId: string; pid: string }) {
  const [usage, setUsage] = useState("");
  const [trust, setTrust] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo-survey/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyId, pid, answers: { usage, trust, comment } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not submit.");
      window.location.assign(data.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
      setBusy(false);
    }
  }

  const legend = "font-display text-base font-semibold text-ink";
  // One answer option: a full-width row that is easy to hit on a phone and shows clearly when chosen.
  const optionRow =
    "flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 hover:border-indigo-300 has-checked:border-indigo-500 has-checked:bg-tint";

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset className="space-y-2">
        <legend className={legend}>1. {DEMO_QUESTIONS.usage.text}</legend>
        {USAGE_OPTIONS.map((option) => (
          <label key={option} className={optionRow}>
            <input type="radio" name="usage" required value={option} checked={usage === option} onChange={() => setUsage(option)} className="accent-indigo-600" />
            {option}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={legend}>2. {DEMO_QUESTIONS.trust.text}</legend>
        <div className="grid grid-cols-5 gap-2">
          {TRUST_OPTIONS.map((option) => (
            <label key={option} className={`${optionRow} justify-center px-2`}>
              <input type="radio" name="trust" required value={option} checked={trust === option} onChange={() => setTrust(option)} className="accent-indigo-600" />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className={legend} htmlFor="comment">
          3. {DEMO_QUESTIONS.comment.text} (optional)
        </label>
        <textarea id="comment" rows={3} maxLength={COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} className={`${inputClass} mt-2`} />
      </div>

      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full sm:w-auto`}>
        {busy ? "Submitting…" : "Submit answers"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
