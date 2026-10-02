import type { ReactNode } from "react";
import { operator } from "@/lib/legal";

/** One titled block of a legal page. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

/** Name, postal address and email of the person who runs the site. */
export function OperatorAddress() {
  return (
    <address className="not-italic">
      {operator.name}
      <br />
      {operator.street}
      <br />
      {operator.city}
      <br />
      {operator.country}
      <br />
      Email:{" "}
      <a className="text-indigo-700 hover:underline" href={`mailto:${operator.email}`}>
        {operator.email}
      </a>
    </address>
  );
}
