import type { ReactNode } from "react";

/** The standard page frame: centred, with side gutters. Every page except the landing page uses it. */
export function Page({ children, width = "wide" }: { children: ReactNode; width?: "wide" | "medium" | "narrow" | "slim" }) {
  const max = { wide: "max-w-5xl", medium: "max-w-2xl", narrow: "max-w-xl", slim: "max-w-md" }[width];
  return <div className={`mx-auto w-full ${max} px-4 py-8 sm:px-6 sm:py-12`}>{children}</div>;
}

export function Eyebrow({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "muted" | "onDark" }) {
  const color = { accent: "text-indigo-600", muted: "text-slate-500", onDark: "text-lilac" }[tone];
  return <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${color}`}>{children}</div>;
}

/** Class names for headings, so every page uses the same sizes. */
export const heading = {
  page: "font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl",
  card: "font-display text-lg font-semibold text-ink",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(20,22,43,0.05)] sm:p-6 ${className}`}>{children}</div>
  );
}

const tones: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  blue: "bg-tint text-indigo-800",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge tone="green">Live</Badge>;
  if (status === "closed") return <Badge>Closed</Badge>;
  if (status === "draft") return <Badge tone="amber">Draft: not funded</Badge>;
  return <Badge tone="blue">Working…</Badge>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white/70 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

/** A thin bar that shows how much of something is done, with the numbers next to it in text. */
export function Progress({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${share}%` }} />
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const buttonClass = {
  primary: `${buttonBase} bg-indigo-600 text-white shadow-sm hover:bg-indigo-500`,
  secondary: `${buttonBase} border border-slate-300 bg-white text-ink hover:bg-slate-50`,
  danger: `${buttonBase} border border-rose-300 bg-white text-rose-700 hover:bg-rose-50`,
  /** For dark backgrounds. */
  light: `${buttonBase} bg-white text-ink shadow-sm hover:bg-tint`,
  ghost: `${buttonBase} border border-ink-line text-white hover:bg-ink-soft`,
};

export const inputClass =
  "block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** The ProofPanel mark: a panel with a tick. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#4f46e5" />
      <path d="M9.5 16.5l4.2 4.2 8.8-9.2" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const iconPaths: Record<string, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.5 3.5-5.5 7-5.5s6.2 2 7 5.5" />
    </>
  ),
  form: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  circle: <circle cx="12" cy="12" r="7" />,
};

export type IconName = "check" | "lock" | "person" | "form" | "bolt" | "receipt" | "globe" | "search" | "arrow" | "circle";

/** Small line icons, drawn inline so nothing has to be downloaded. Always decorative: the text next to them says the same. */
export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}
