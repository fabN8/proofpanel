import { beforeAll, describe, expect, it } from "vitest";

// Simulation engine and an in-memory database: no network, no files.
process.env.CHAIN_ENGINE = "mock";
process.env.PGLITE_DIR = "memory";
process.env.MIN_TIME_FACTOR = "0";

import { getEngine } from "@/lib/chain";
import { toBase } from "@/lib/config";
import { getDb } from "@/lib/db";
import {
  closeStudy,
  completeSubmission,
  createStudy,
  demoSurveyRedirect,
  exportCsv,
  fundStudy,
  listSubmissions,
  startSubmission,
  studyStats,
} from "@/lib/studies";
import { summarise, type DemoAnswers } from "@/lib/survey/demo";
import { UserError } from "@/lib/types";
import type { Study, User } from "@/lib/types";
import { signInWithEmail } from "@/lib/users";

const tokenOf = (surveyUrl: string) => new URL(surveyUrl, "http://x").searchParams.get("pid")!;

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => err instanceof UserError && err.code === code);
}

describe("the full study loop on the simulation engine", () => {
  let researcher: User;
  let alice: User;
  let bob: User;
  let carol: User;
  let study: Study;

  beforeAll(async () => {
    researcher = await signInWithEmail("Researcher@Example.org ");
    alice = await signInWithEmail("alice@example.org");
    bob = await signInWithEmail("bob@example.org");
    carol = await signInWithEmail("carol@example.org");
  });

  it("signs the same email into the same account", async () => {
    const again = await signInWithEmail("researcher@example.org");
    expect(again.id).toBe(researcher.id);
    expect(again.wallet).toBe(researcher.wallet);
  });

  it("refuses to fund without enough test USDC", async () => {
    study = await createStudy(researcher, {
      title: "Trust in AI assistants",
      surveyUrl: "demo",
      rewardUsdc: 1.5,
      maxParticipants: 2,
      estMinutes: 3,
    });
    expect(study.status).toBe("draft");
    await expectCode(fundStudy(researcher, study.id), "insufficient_funds");
  });

  it("locks the budget when funded", async () => {
    const engine = await getEngine();
    await engine.faucet(researcher.wallet, toBase(20));
    study = await fundStudy(researcher, study.id);
    expect(study.status).toBe("live");
    expect(await engine.balanceOf(researcher.wallet)).toBe(toBase(17));
    await expectCode(fundStudy(researcher, study.id), "already_funded");
  });

  it("does not let the researcher take the study", async () => {
    await expectCode(startSubmission(researcher, study.id), "own_study");
  });

  it("pays a participant once, on a correct completion", async () => {
    const engine = await getEngine();
    const { surveyUrl } = await startSubmission(alice, study.id);
    const token = tokenOf(surveyUrl);

    await expectCode(completeSubmission(token, "WRONGCODE"), "wrong_code");
    await expectCode(completeSubmission("not-a-token", study.completionCode), "bad_token");

    const paid = await completeSubmission(token, study.completionCode);
    expect(paid.alreadyPaid).toBe(false);
    expect(paid.amountBase).toBe(toBase(1.5));
    expect(await engine.balanceOf(alice.wallet)).toBe(toBase(1.5));

    // The same link again does not pay again.
    const again = await completeSubmission(token, study.completionCode);
    expect(again.alreadyPaid).toBe(true);
    expect(await engine.balanceOf(alice.wallet)).toBe(toBase(1.5));
    await expectCode(startSubmission(alice, study.id), "already_done");
  });

  it("refuses a completion that is too fast", async () => {
    process.env.MIN_TIME_FACTOR = "0.5";
    const { surveyUrl } = await startSubmission(bob, study.id);
    await expectCode(completeSubmission(tokenOf(surveyUrl), study.completionCode), "too_fast");
    process.env.MIN_TIME_FACTOR = "0";
  });

  it("keeps places for people who started and refuses when full", async () => {
    const stats = await studyStats(study);
    expect(stats).toMatchObject({ paid: 1, inProgress: 1, placesLeft: 0 });
    await expectCode(startSubmission(carol, study.id), "study_full");
  });

  it("re-opening the survey gives a fresh token and retires the old one", async () => {
    const first = tokenOf((await startSubmission(bob, study.id)).surveyUrl);
    const second = tokenOf((await startSubmission(bob, study.id)).surveyUrl);
    expect(first).not.toBe(second);
    await expectCode(completeSubmission(first, study.completionCode), "bad_token");
  });

  it("returns exactly the unspent budget on close and stops new completions", async () => {
    const engine = await getEngine();
    const bobToken = tokenOf((await startSubmission(bob, study.id)).surveyUrl);
    const closed = await closeStudy(researcher, study.id);
    expect(closed.refundedBase).toBe(toBase(1.5));
    expect(closed.study.status).toBe("closed");
    expect(await engine.balanceOf(researcher.wallet)).toBe(toBase(18.5));
    await expectCode(completeSubmission(bobToken, study.completionCode), "study_closed");
    await expectCode(closeStudy(researcher, study.id), "not_live");
  });

  it("exports a CSV without emails", async () => {
    const csv = await exportCsv(researcher, study.id);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "ref,wallet,human_check,status,started_at,completed_at,seconds,reward_usdc,payout_transaction,q1_ai_usage,q2_trust_1_to_5,q3_comment",
    );
    expect(lines).toHaveLength(3);
    expect(csv).not.toContain("@");
    expect(csv).toContain("1.50");
    await expectCode(exportCsv(alice, study.id), "forbidden");
  });

  it("the simulation engine itself refuses a second payout to the same wallet", async () => {
    const engine = await getEngine();
    const second = await createStudy(researcher, { title: "Second study", surveyUrl: "demo", rewardUsdc: 1, maxParticipants: 3, estMinutes: 1 });
    const live = await fundStudy(researcher, second.id);
    const ref = { studyId: live.id, chainStudyId: live.chainStudyId, researcherWallet: researcher.wallet, rewardBase: live.rewardBase, maxParticipants: 3, chainRef: live.chainRef };
    await engine.payParticipant(ref, carol.wallet);
    await expectCode(engine.payParticipant(ref, carol.wallet), "already_paid");
    expect(await engine.vaultBalance(ref)).toBe(toBase(2));
    const db = await getDb();
    expect((await db.query("SELECT 1 FROM studies")).length).toBe(2);
  });
});

describe("answers to the built-in survey", () => {
  let researcher: User;
  let dana: User;
  let erik: User;
  let study: Study;

  beforeAll(async () => {
    researcher = await signInWithEmail("results@example.org");
    dana = await signInWithEmail("dana@example.org");
    erik = await signInWithEmail("erik@example.org");
    const engine = await getEngine();
    await engine.faucet(researcher.wallet, toBase(5));
    const draft = await createStudy(researcher, { title: "Results", surveyUrl: "demo", rewardUsdc: 0.5, maxParticipants: 3, estMinutes: 1 });
    study = await fundStudy(researcher, draft.id);
  });

  it("are saved when the survey is submitted and survive the payout", async () => {
    const token = tokenOf((await startSubmission(dana, study.id)).surveyUrl);
    await expectCode(demoSurveyRedirect(study.id, token, { usage: "Hourly", trust: "3" }), "answers_missing");
    await expectCode(demoSurveyRedirect(study.id, "not-a-token", { usage: "Often", trust: "3" }), "bad_token");

    const redirect = await demoSurveyRedirect(study.id, token, { usage: "Often", trust: "4", comment: "  Sources, please.  " });
    expect(redirect).toContain(`cc=${study.completionCode}`);
    await completeSubmission(token, study.completionCode);

    // After the payout the answers can no longer be changed.
    await demoSurveyRedirect(study.id, token, { usage: "Never", trust: "1", comment: "changed" });
    const [submission] = await listSubmissions(study.id);
    expect(submission.status).toBe("paid");
    expect(submission.answers).toEqual({ usage: "Often", trust: "4", comment: "Sources, please." });
  });

  it("are summarised from paid submissions and exported next to the payout", async () => {
    const token = tokenOf((await startSubmission(erik, study.id)).surveyUrl);
    await demoSurveyRedirect(study.id, token, { usage: "Daily", trust: "2", comment: '=HYPERLINK("http://x","click"), really' });
    await completeSubmission(token, study.completionCode);

    const paid = (await listSubmissions(study.id)).filter((s) => s.status === "paid").map((s) => s.answers as DemoAnswers);
    const summary = summarise(paid);
    expect(summary.count).toBe(2);
    expect(summary.trustAverage).toBe(3);
    expect(summary.usage.find((row) => row.option === "Daily")?.count).toBe(1);
    expect(summary.usage.find((row) => row.option === "Never")?.count).toBe(0);
    expect(summary.comments).toHaveLength(2);

    const csv = await exportCsv(researcher, study.id);
    expect(csv).toContain(",Often,4,\"Sources, please.\"");
    // A comment that looks like a spreadsheet formula is neutralised with a leading apostrophe.
    expect(csv).toContain(`,Daily,2,"'=HYPERLINK(""http://x"",""click""), really"`);
    expect(csv).not.toContain("@");
  });
});
