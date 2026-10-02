import { notFound } from "next/navigation";
import { PrivySignIn } from "@/components/PrivySignIn";
import { SignInForm } from "@/components/SignInForm";
import { WorldIdCheck } from "@/components/WorldIdCheck";
import { StartSurvey } from "@/components/StartSurvey";
import { Card, Eyebrow, Icon, Page, heading, shortAddress } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { explorerTx, getEngine } from "@/lib/chain";
import { safeBalance } from "@/lib/chain/safe";
import { formatUsdc, privyEnabled, worldConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getStudy, studyStats } from "@/lib/studies";
import { getVerification, payoutAddress } from "@/lib/users";

export default async function ParticipantStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const study = await getStudy(id);
  if (!study || study.status === "draft") notFound();

  const user = await currentUser();
  const stats = await studyStats(study);
  const open = study.status === "live";

  let own: { status: string; payoutTx: string | null } | null = null;
  let balance: number | null = null;
  let verification = null;
  if (user) {
    const db = await getDb();
    const rows = await db.query<{ status: string; payout_tx: string | null }>(
      "SELECT status, payout_tx FROM submissions WHERE study_id = $1 AND participant_id = $2",
      [study.id, user.id],
    );
    own = rows.length ? { status: rows[0].status, payoutTx: rows[0].payout_tx } : null;
    balance = await safeBalance(await getEngine(), payoutAddress(user));
    verification = await getVerification(user.id);
  }
  const paid = own?.status === "paid";
  const payoutLink = own?.payoutTx ? explorerTx(own.payoutTx) : null;
  const isOwner = user?.id === study.researcherId;
  const worldIdOn = Boolean(worldConfig());
  const hasWorldId = verification?.provider === "world-id";
  const needsWorldId = study.minCheck === "world-id" && !hasWorldId;
  const myWallet = user ? payoutAddress(user) : "";

  // Where this visitor is on the way to being paid. Shown as four steps.
  const humanOk = Boolean(verification) && !needsWorldId;
  const stage = paid ? 4 : !user || isOwner ? 1 : !humanOk ? 2 : 3;
  const stages = ["Sign in", "Human check", "Survey", "Paid"];

  return (
    <Page width="narrow">
      <div className="space-y-5">
      <div>
        <Eyebrow>Paid study</Eyebrow>
        <h1 className={`${heading.page} mt-2`}>{study.title}</h1>
        {study.description ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{study.description}</p> : null}
      </div>

      <div className="rounded-2xl bg-ink p-5 text-white sm:p-6">
        <Eyebrow tone="onDark">You earn</Eyebrow>
        <div className="mt-1 font-display text-4xl font-bold">{formatUsdc(study.rewardBase)} USDC</div>
        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-ink-line pt-4 text-sm">
          <div>
            <dt className="text-mist">Duration</dt>
            <dd className="font-semibold">about {study.estMinutes} min</dd>
          </div>
          <div>
            <dt className="text-mist">Places left</dt>
            <dd className="font-semibold">{open ? stats.placesLeft : 0}</dd>
          </div>
          <div>
            <dt className="text-mist">Payout</dt>
            <dd className="font-semibold">when you finish</dd>
          </div>
        </dl>
      </div>

      {open ? (
        <ol className="grid grid-cols-4 gap-2" aria-label="Your progress">
          {stages.map((name, i) => {
            const number = i + 1;
            const done = number < stage || stage === 4;
            const current = number === stage && stage !== 4;
            return (
              <li key={name} className="text-center">
                <div className={`h-1.5 rounded-full ${done ? "bg-emerald-500" : current ? "bg-indigo-600" : "bg-slate-200"}`} />
                <div className={`mt-2 text-xs font-semibold ${done ? "text-emerald-700" : current ? "text-indigo-700" : "text-slate-500"}`}>
                  {name}
                  <span className="sr-only">{done ? " (done)" : current ? " (current step)" : ""}</span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {!open ? (
        <Card>
          <p className="text-sm text-slate-700">This study is closed.</p>
        </Card>
      ) : !user ? (
        <Card>
          <h2 className={heading.card}>Sign in to take part</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Your reward is paid to a wallet that is created for you when you sign in.</p>
          {privyEnabled() ? <PrivySignIn cta="Sign in and continue" /> : <SignInForm cta="Sign in and continue" />}
        </Card>
      ) : isOwner ? (
        <Card>
          <p className="text-sm text-slate-700">
            This is your own study. To test it as a participant, open this link in a private window and sign in with a different
            email address.
          </p>
        </Card>
      ) : paid ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Icon name="check" />
            </span>
            <h2 className={heading.card}>Paid</h2>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            You completed this study and received {formatUsdc(study.rewardBase)} USDC.{" "}
            {payoutLink ? (
              <a className="text-indigo-700 hover:underline" href={payoutLink} target="_blank" rel="noreferrer">
                View the transaction
              </a>
            ) : null}
          </p>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="space-y-2 text-sm text-slate-700">
            <p className="flex items-start gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span className="min-w-0 break-words">Signed in as {user.email}</span>
            </p>
            <p className="flex items-start gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>
                {user.payoutWallet ? "Your own wallet" : "Demo wallet"}{" "}
                <span className="mono" title={myWallet}>{shortAddress(myWallet)}</span>{" "}
                {balance === null ? "" : `holds ${formatUsdc(balance)} USDC`}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Icon
                name={humanOk ? "check" : "circle"}
                className={`mt-0.5 h-4 w-4 ${humanOk ? "text-emerald-600" : "text-amber-600"}`}
              />
              <span>
                Human check: {hasWorldId ? `World ID, ${verification!.level}` : verification ? `${verification.level}` : "not passed"}
              </span>
            </p>
          </div>
          {needsWorldId ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="mb-3">This study only accepts participants who proved they are a unique human with World ID.</p>
              {worldIdOn ? <WorldIdCheck /> : <p>World ID is not available right now.</p>}
            </div>
          ) : worldIdOn && !hasWorldId ? (
            <div className="text-sm text-slate-600">
              <p className="mb-2">Optional: a stronger check opens studies that require it.</p>
              <WorldIdCheck />
            </div>
          ) : null}
          {needsWorldId ? null : stats.placesLeft > 0 || own ? (
            <>
              <StartSurvey studyId={study.id} />
              <p className="text-xs text-slate-500">
                You are paid automatically when the survey sends you back here. Rushing through does not count: answers faster than a
                real reading time are not paid.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-700">All places are taken right now. Try again later.</p>
          )}
        </Card>
      )}
      </div>
    </Page>
  );
}
