"use client";

import { useState } from "react";
import { buttonClass } from "./ui";

export function StartSurvey({ studyId }: { studyId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/studies/${studyId}/start`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not start the survey.");
      window.location.assign(data.surveyUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the survey.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={start} disabled={busy} className={`${buttonClass.primary} w-full sm:w-auto`}>
        {busy ? "Opening survey…" : "Start survey"}
      </button>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
