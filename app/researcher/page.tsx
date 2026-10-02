import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { Card, Eyebrow, Page, Progress, StatusBadge, buttonClass, heading, shortAddress } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { explorerAddress, getEngine } from "@/lib/chain";
import { safeBalance } from "@/lib/chain/safe";
import { faucetUsdc, formatUsdc, toBase } from "@/lib/config";
import { budgetBase, listStudiesOf, studyStats } from "@/lib/studies";

export default async function ResearcherHome() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/researcher");

  const engine = await getEngine();
  const [balance, studies] = await Promise.all([safeBalance(engine, user.wallet), listStudiesOf(user.id)]);
  const stats = await Promise.all(studies.map((s) => studyStats(s)));
  const walletLink = explorerAddress(user.wallet);

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Researcher</Eyebrow>
          <h1 className={`${heading.page} mt-2`}>My studies</h1>
        </div>
        <Link href="/researcher/new" className={buttonClass.primary}>
          New study
        </Link>
      </div>

      <div className="mt-6 rounded-2xl bg-ink p-5 text-white sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Eyebrow tone="onDark">Study account (funds your studies)</Eyebrow>
            <div className="mt-2 font-display text-3xl font-bold">
              {balance === null ? "Balance unavailable" : `${formatUsdc(balance)} USDC`}
            </div>
            <div className="mt-1 text-sm text-mist">
              <span className="mono" title={user.wallet}>
                {shortAddress(user.wallet)}
              </span>
              {walletLink ? (
                <>
                  {" · "}
                  <a className="text-lilac hover:underline" href={walletLink} target="_blank" rel="noreferrer">
                    View on Solana Explorer
                  </a>
                </>
              ) : null}
            </div>
          </div>
          {balance !== null && balance < toBase(faucetUsdc()) ? (
            <ActionButton url="/api/faucet" label={`Get ${faucetUsdc()} test USDC`} busyLabel="Sending…" variant="light" />
          ) : null}
        </div>
      </div>

      {studies.length === 0 ? (
        <Card className="mt-6 text-center sm:py-12">
          <h2 className={heading.card}>No studies yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Create one to see the full loop: fund, share, get answers, pay.
          </p>
          <Link href="/researcher/new" className={`${buttonClass.primary} mt-5`}>
            Create your first study
          </Link>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {studies.map((study, i) => (
            <Link key={study.id} href={`/researcher/study/${study.id}`} className="block">
              <Card className="h-full transition hover:border-indigo-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className={heading.card}>{study.title}</h2>
                  <StatusBadge status={study.status} />
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">Paid participants</span>
                    <span className="font-semibold text-ink">
                      {stats[i].paid} / {study.maxParticipants}
                    </span>
                  </div>
                  <Progress done={stats[i].paid} total={study.maxParticipants} />
                </div>
                <dl className="mt-4 flex gap-6 text-sm">
                  <div>
                    <dt className="text-slate-500">Reward</dt>
                    <dd className="font-semibold text-ink">{formatUsdc(study.rewardBase)} USDC</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Budget</dt>
                    <dd className="font-semibold text-ink">{formatUsdc(budgetBase(study))} USDC</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
