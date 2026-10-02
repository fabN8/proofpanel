"use client";

import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 flex items-stretch gap-2">
        <code className="block min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink">
          {value}
        </code>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
