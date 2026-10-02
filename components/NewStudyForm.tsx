"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass } from "./ui";

export function NewStudyForm({ worldIdAvailable = false }: { worldIdAvailable?: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [useDemo, setUseDemo] = useState(true);
  const [surveyUrl, setSurveyUrl] = useState("");
  const [reward, setReward] = useState("0.50");
  const [participants, setParticipants] = useState("5");
  const [minutes, setMinutes] = useState("1");
  const [requireWorldId, setRequireWorldId] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budget = (Number(reward) || 0) * (Number(participants) || 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          surveyUrl: useDemo ? "demo" : surveyUrl,
          rewardUsdc: Number(reward),
          maxParticipants: Number(participants),
          estMinutes: Number(minutes),
          requireWorldId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create the study.");
      router.push(`/researcher/study/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the study.");
      setBusy(false);
    }
  }

  const label = "block text-sm font-semibold text-ink";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={label} htmlFor="title">
          Study title
        </label>
        <input id="title" required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trust in AI assistants" className={`${inputClass} mt-1`} />
      </div>

      <div>
        <label className={label} htmlFor="description">
          What participants should know (optional)
        </label>
        <textarea id="description" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short survey about how you use AI tools." className={`${inputClass} mt-1`} />
      </div>

      <fieldset className="space-y-2">
        <legend className={label}>Survey</legend>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="radio" name="survey" checked={useDemo} onChange={() => setUseDemo(true)} className="mt-1" />
          <span>
            Use the built-in demo survey <span className="text-slate-500">(three questions, good for a first test)</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="radio" name="survey" checked={!useDemo} onChange={() => setUseDemo(false)} className="mt-1" />
          <span>
            Link my own survey <span className="text-slate-500">(Qualtrics, SoSci Survey or any tool that can redirect at the end)</span>
          </span>
        </label>
        {!useDemo ? (
          <input type="url" required value={surveyUrl} onChange={(e) => setSurveyUrl(e.target.value)} placeholder="https://…" className={inputClass} />
        ) : null}
      </fieldset>

      {/* Short labels and bottom alignment keep the three boxes on one line even if a label wraps. */}
      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="reward">
            Reward (USDC)
          </label>
          <input id="reward" type="number" required min={0.01} max={100} step={0.01} value={reward} onChange={(e) => setReward(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={label} htmlFor="participants">
            Participants
          </label>
          <input id="participants" type="number" required min={1} max={500} step={1} value={participants} onChange={(e) => setParticipants(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={label} htmlFor="minutes">
            Minutes needed
          </label>
          <input id="minutes" type="number" required min={1} max={120} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${inputClass} mt-1`} />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={requireWorldId}
          disabled={!worldIdAvailable}
          onChange={(e) => setRequireWorldId(e.target.checked)}
        />
        <span>
          Only accept participants verified with World ID{" "}
          <span className="text-slate-500">
            {worldIdAvailable ? "(one person, one answer)" : "(not available: World ID is not set up yet)"}
          </span>
        </span>
      </label>

      <div className="rounded-xl border border-tint-line bg-tint p-4 text-sm text-slate-700">
        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Budget to lock</div>
        <div className="mt-1 font-display text-2xl font-bold text-ink">{budget.toFixed(2)} USDC</div>
        <p className="mt-1">Unused budget comes back when you close the study.</p>
      </div>

      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full sm:w-auto`}>
        {busy ? "Creating…" : "Create study"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
