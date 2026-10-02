import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { CopyField } from "@/components/CopyField";
import { Badge, Card, Page, Progress, Stat, StatusBadge, buttonClass, heading, shortAddress } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { explorerAddress, explorerTx, getEngine } from "@/lib/chain";
import { safeBalance } from "@/lib/chain/safe";
import { faucetUsdc, formatUsdc, toBase } from "@/lib/config";
import { requestOrigin } from "@/lib/origin";
import { budgetBase, getStudy, listSubmissions, studyStats, usesBuiltInSurvey } from "@/lib/studies";
import { DEMO_QUESTIONS, summarise, type DemoAnswers } from "@/lib/survey/demo";
import { redirectTemplate } from "@/lib/survey/token";

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/researcher/study/${id}`);
  const study = await getStudy(id);
  if (!study || study.researcherId !== user.id) notFound();

  const engine = await getEngine();
  const origin = await requestOrigin();
  const [stats, submissions, walletBalance] = await Promise.all([
    studyStats(study),
    listSubmissions(study.id),
    safeBalance(engine, user.wallet),
  ]);
  const budget = budgetBase(study);
  const usesDemoSurvey = usesBuiltInSurvey(study);
  // Results count paid submissions only: those passed the human check, the code and the time rule.
  const results = summarise(submissions.filter((s) => s.status === "paid" && s.answers).map((s) => s.answers as DemoAnswers));
  const fundLink = study.fundTx ? explorerTx(study.fundTx) : null;
  const vaultLink = study.chainRef ? explorerAddress(study.chainRef) : null;
  const closeLink = study.closeTx ? explorerTx(study.closeTx) : null;
  const short = walletBalance === null ? 0 : budget - walletBalance;
  const canUseFaucet = walletBalance !== null && walletBalance < toBase(faucetUsdc());

  return (
    <Page>
      <div className="space-y-6">
      <div>
        <Link href="/researcher" className="text-sm font-medium text-indigo-700 hover:underline">
          ← My studies
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className={heading.page}>{study.title}</h1>
          <StatusBadge status={study.status} />
        </div>
        {study.description ? <p className="mt-2 max-w-2xl text-sm text-slate-600">{study.description}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Paid"
          value={`${stats.paid} / ${study.maxParticipants}`}
          hint={
            <div className="mt-1.5 space-y-1.5">
              <Progress done={stats.paid} total={study.maxParticipants} />
              <div>{stats.inProgress} in progress</div>
            </div>
          }
        />
        <Stat
          label="Reward"
          value={`${formatUsdc(study.rewardBase)} USDC`}
          hint={`about ${study.estMinutes} min · ${study.minCheck === "world-id" ? "World ID required" : "basic human check"}`}
        />
        <Stat label="Budget" value={`${formatUsdc(budget)} USDC`} />
        <Stat label="Paid out" value={`${formatUsdc(stats.spentBase)} USDC`} />
      </div>

      {study.status === "draft" ? (
        <Card className="border-tint-line bg-tint">
          <h2 className={heading.card}>Step 1: lock the budget</h2>
          <p className="mt-1 text-sm text-slate-600">
            Funding moves {formatUsdc(budget)} USDC from your study account into the study&apos;s vault.{" "}
            {walletBalance === null
              ? "Your balance could not be read right now."
              : `Your study account holds ${formatUsdc(walletBalance)} USDC.`}
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            {short > 0 ? (
              <>
                {canUseFaucet ? (
                  <ActionButton url="/api/faucet" label={`Get ${faucetUsdc()} test USDC`} busyLabel="Sending…" variant="secondary" />
                ) : null}
                <p className="basis-full text-sm text-amber-700">
                  You need {formatUsdc(short)} USDC more before you can fund.{" "}
                  {canUseFaucet ? "" : `The demo faucet gives ${faucetUsdc()} USDC per researcher, so create a study with a smaller budget.`}
                </p>
              </>
            ) : (
              <ActionButton url={`/api/studies/${study.id}/fund`} label={`Fund study with ${formatUsdc(budget)} USDC`} busyLabel="Locking budget…" />
            )}
          </div>
        </Card>
      ) : null}

      {study.status === "live" ? (
        <Card className="space-y-4">
          <div>
            <h2 className={heading.card}>Share with participants</h2>
            <p className="mt-1 text-sm text-slate-600">Anyone with this link can sign in, pass the human check and take the study.</p>
          </div>
          <CopyField label="Participant link" value={`${origin}/s/${study.id}`} />
          {!usesDemoSurvey ? (
            <div className="space-y-3 rounded-xl border border-line bg-paper p-4">
              <h3 className="font-display text-base font-semibold text-ink">Set up your survey tool (once)</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                <li>
                  Participants arrive with <code>?pid=…&amp;ref=…</code> added to your survey link. Save both as hidden fields.
                  <code> ref</code> also appears in your CSV export, so you can match answers to payouts.
                </li>
                <li>At the end of the survey, redirect to the link below and put the saved <code>pid</code> in it.</li>
              </ol>
              <CopyField label="End-of-survey redirect (generic)" value={redirectTemplate(origin, study.completionCode, "<pid>")} />
              <CopyField label="Same link for Qualtrics" value={redirectTemplate(origin, study.completionCode, "${e://Field/pid}")} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">This study uses the built-in demo survey, so nothing else needs setting up.</p>
          )}
        </Card>
      ) : null}

      {study.status !== "draft" ? (
        <Card>
          <h2 className={heading.card}>Where the money is</h2>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              Engine: <Badge tone={engine.live ? "green" : "amber"}>{study.chainEngine ?? engine.name}</Badge>
            </p>
            {vaultLink ? (
              <p>
                Vault:{" "}
                <a className="text-indigo-700 hover:underline" href={vaultLink} target="_blank" rel="noreferrer">
                  {shortAddress(study.chainRef!)} on Solana Explorer
                </a>
              </p>
            ) : null}
            {fundLink ? (
              <p>
                Funding transaction:{" "}
                <a className="text-indigo-700 hover:underline" href={fundLink} target="_blank" rel="noreferrer">
                  view
                </a>
              </p>
            ) : null}
            {closeLink ? (
              <p>
                Refund transaction:{" "}
                <a className="text-indigo-700 hover:underline" href={closeLink} target="_blank" rel="noreferrer">
                  view
                </a>
              </p>
            ) : null}
            {!engine.live ? <p className="text-slate-500">Simulation mode: there is nothing to look up on a blockchain yet.</p> : null}
          </div>
        </Card>
      ) : null}

      {study.status !== "draft" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={heading.card}>Completions</h2>
            <a href={`/api/studies/${study.id}/export`} className={buttonClass.secondary}>
              Export CSV
            </a>
          </div>
          {submissions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nobody has started yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Wallet</th>
                    <th className="py-2 pr-3 font-medium">Human check</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Time taken</th>
                    <th className="py-2 font-medium">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((s) => (
                    <tr key={s.id}>
                      <td className="mono py-2 pr-3" title={s.wallet}>
                        {shortAddress(s.wallet)}
                      </td>
                      <td className="py-2 pr-3">{s.humanCheck}</td>
                      <td className="py-2 pr-3">
                        {s.status === "paid" ? <Badge tone="green">Paid</Badge> : <Badge tone="blue">In progress</Badge>}
                      </td>
                      <td className="py-2 pr-3">{s.seconds !== null ? `${s.seconds} s` : "–"}</td>
                      <td className="py-2">
                        {s.explorer ? (
                          <a className="text-indigo-700 hover:underline" href={s.explorer} target="_blank" rel="noreferrer">
                            view transaction
                          </a>
                        ) : s.status === "paid" ? (
                          <span className="text-slate-500">simulated</span>
                        ) : (
                          "–"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {study.status !== "draft" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={heading.card}>Survey results</h2>
            {usesDemoSurvey && results.count > 0 ? (
              <a href={`/api/studies/${study.id}/export`} className={buttonClass.secondary}>
                Export answers (CSV)
              </a>
            ) : null}
          </div>
          {!usesDemoSurvey ? (
            <p className="mt-2 text-sm text-slate-600">
              The answers are in your survey tool. Each response there carries a <code>ref</code> value; the same value is in the
              <code> ref</code> column of the CSV export above. Keep the responses whose <code>ref</code> is marked <code>paid</code>:
              those came from verified people who finished.
            </p>
          ) : results.count === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No answers yet. They appear here as soon as the first participant is paid.</p>
          ) : (
            <div className="mt-1 space-y-6">
              <p className="text-sm text-slate-600">
                {results.count} {results.count === 1 ? "response" : "responses"} from paid, verified participants.
              </p>
              <ResultBars title={`1. ${DEMO_QUESTIONS.usage.text}`} rows={results.usage} total={results.count} />
              <ResultBars
                title={`2. ${DEMO_QUESTIONS.trust.text}`}
                rows={results.trust}
                total={results.count}
                note={results.trustAverage !== null ? `Average: ${results.trustAverage.toFixed(1)} out of 5` : undefined}
              />
              <div>
                <h3 className="font-display text-base font-semibold text-ink">3. {DEMO_QUESTIONS.comment.text}</h3>
                {results.comments.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No comments.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {results.comments.map((comment, index) => (
                      <li key={index} className="whitespace-pre-wrap break-words rounded-xl border border-line bg-paper px-4 py-3 text-sm text-slate-700">
                        {comment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {study.status === "live" ? (
        <Card>
          <h2 className={heading.card}>Close the study</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Closing stops new completions and returns the unspent {formatUsdc(budget - stats.spentBase)} USDC to your study account.
          </p>
          <ActionButton
            url={`/api/studies/${study.id}/close`}
            label="Close study and refund"
            busyLabel="Closing…"
            variant="danger"
            confirmText="Close this study? Participants who are still answering will not be paid."
          />
        </Card>
      ) : null}
      </div>
    </Page>
  );
}

/** One row per answer option: label, a bar as wide as its share, and the count. */
function ResultBars({
  title,
  rows,
  total,
  note,
}: {
  title: string;
  rows: Array<{ option: string; count: number }>;
  total: number;
  note?: string;
}) {
  return (
    <div>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {note ? <p className="mt-0.5 text-sm text-slate-600">{note}</p> : null}
      <dl className="mt-2 space-y-1.5">
        {rows.map((row) => {
          const share = total ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.option} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-sm">
              <dt className="text-slate-700">{row.option}</dt>
              <dd className="h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                <div className="h-full rounded-full bg-indigo-600" style={{ width: `${share}%` }} />
              </dd>
              <dd className="text-right tabular-nums text-slate-600">
                {row.count} · {share}%
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
