import Link from "next/link";
import { Eyebrow, Icon, buttonClass, type IconName } from "@/components/ui";

const problems = [
  {
    label: "Bots",
    figure: "99.8%",
    text: "of the time, an AI agent built to answer surveys went undetected. A fake response costs about 5 cents.",
  },
  {
    label: "Fees",
    figure: "33–43%",
    text: "is what the leading panel adds on top of every reward: 33.3% for academics, 42.8% for companies.",
  },
  {
    label: "Slow pay",
    figure: "21 days",
    text: "can pass before a submission is approved there. Cash-out is PayPal only, from £6 or $6.",
  },
];

const steps: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: "lock",
    title: "Fund",
    text: "The researcher creates a study and locks the full budget in USDC in a vault owned by the program.",
  },
  {
    icon: "person",
    title: "Verify",
    text: "A participant signs in by email, gets a wallet, and proves once that they are a person.",
  },
  {
    icon: "form",
    title: "Answer",
    text: "They take the survey. A one-time link ties their response to their payout, without their name.",
  },
  {
    icon: "bolt",
    title: "Get paid",
    text: "The program sends one reward to that wallet. The researcher sees results and exports them.",
  },
];

const solana: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: "search",
    title: "The money is visibly there",
    text: "The budget sits in a vault owned by the program. Anyone can look it up before they start.",
  },
  {
    icon: "receipt",
    title: "Nobody is paid twice",
    text: "Each payout creates a receipt for that wallet. A second payout is rejected on-chain.",
  },
  {
    icon: "globe",
    title: "Small rewards travel",
    text: "USDC goes to a wallet created at email sign-in. The platform pays the network fee.",
  },
  {
    icon: "check",
    title: "Every payout can be audited",
    text: "Each one is a public transaction, linked in the export for grant accounting.",
  },
];

const researcherPoints = [
  "Lock the budget once; unspent money comes back when you close the study",
  "Works with the built-in survey or your own survey tool",
  "Results and a CSV export with a transaction link per payout",
];

const participantPoints = [
  "Sign in with an email address; no app, no crypto knowledge",
  "See that the reward is locked before you start",
  "Paid to your own wallet seconds after the last answer",
];

const container = "mx-auto w-full max-w-5xl px-4 sm:px-6";

export default function Home() {
  return (
    <>
      <section className="bg-ink text-white">
        <div className={`${container} grid items-center gap-10 pb-16 pt-12 sm:pb-20 sm:pt-16 lg:grid-cols-[1.3fr_1fr]`}>
          <div>
            <Eyebrow tone="onDark">Research studies on Solana</Eyebrow>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Pay verified humans for research, seconds after they finish.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-mist">
              A researcher locks the study budget on Solana. Each verified participant is paid the moment the survey ends,
              without an approval queue or a minimum cash-out.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/researcher/new" className={buttonClass.light}>
                Run a study
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link href="#how" className={buttonClass.ghost}>
                How it works
              </Link>
            </div>
            <p className="mt-4 text-sm text-mist">Taking part in a study? Open the link the researcher sent you.</p>
          </div>

          {/* A picture of the flow, not live data. */}
          <div className="rounded-3xl border border-ink-line bg-ink-soft p-5 sm:p-6" aria-hidden="true">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-lilac">Example study</span>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">Live</span>
            </div>
            <div className="mt-2 font-display text-xl font-semibold">Trust in AI assistants</div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-ink p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/25 text-lilac">
                  <Icon name="lock" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-mist">Budget locked in the vault</div>
                  <div className="font-display text-lg font-semibold">2.50 USDC</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-ink p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/25 text-lilac">
                  <Icon name="person" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-mist">Participant</div>
                  <div className="font-display text-lg font-semibold">Verified human</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-ink">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Icon name="check" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-600">Paid after the last answer</div>
                  <div className="font-display text-lg font-semibold">+ 0.50 USDC</div>
                </div>
                <span className="text-sm font-medium text-slate-500">in seconds</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${container} py-14 sm:py-20`}>
        <Eyebrow>The problem</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Paid online studies fail researchers and participants
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {problems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-line bg-card p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
              <div className="mt-2 font-display text-5xl font-bold tracking-tight text-indigo-600">{item.figure}</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Sources: Westwood, PNAS (November 2025); Prolific pricing page and help centre, read 2 October 2026.
        </p>
      </section>

      <section id="how" className="border-y border-line bg-card">
        <div className={`${container} py-14 sm:py-20`}>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Four steps, one payment rule</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-line bg-paper p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tint text-indigo-700">
                    <Icon name={step.icon} />
                  </span>
                  <span className="font-display text-sm font-semibold text-slate-400">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-600">
            Checked before every payout: the link is unused, the completion code matches, the minimum time has passed, and a place
            is still free.
          </p>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className={`${container} py-14 sm:py-20`}>
          <Eyebrow tone="onDark">Why Solana</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            What a payment account cannot do
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {solana.map((item) => (
              <div key={item.title} className="flex gap-4 rounded-2xl border border-ink-line bg-ink-soft p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/25 text-lilac">
                  <Icon name={item.icon} />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${container} py-14 sm:py-20`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-card p-6 sm:p-8">
            <Eyebrow>For researchers</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Answers from real people, paid by rule</h2>
            <ul className="mt-5 space-y-3">
              {researcherPoints.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                  <Icon name="check" className="mt-0.5 h-5 w-5 text-indigo-600" />
                  {point}
                </li>
              ))}
            </ul>
            <Link href="/researcher/new" className={`${buttonClass.primary} mt-6`}>
              Run a study
            </Link>
          </div>
          <div className="rounded-2xl border border-tint-line bg-tint p-6 sm:p-8">
            <Eyebrow>For participants</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Finish the survey, see the money</h2>
            <ul className="mt-5 space-y-3">
              {participantPoints.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                  <Icon name="check" className="mt-0.5 h-5 w-5 text-indigo-600" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-600">You take part through the link a researcher sends you.</p>
          </div>
        </div>
      </section>
    </>
  );
}
