/** The business rules: who may create, fund, take, complete and close a study. */
import { randomInt } from "node:crypto";
import { getEngine, explorerTx } from "@/lib/chain";
import type { StudyOnChain } from "@/lib/chain";
import { toBase, worldConfig } from "@/lib/config";
import { getDb, newId, num } from "@/lib/db";
import type { Row } from "@/lib/db";
import { DEMO_QUESTIONS, cleanAnswers, parseAnswers, type DemoAnswers } from "@/lib/survey/demo";
import { buildSurveyUrl, checkCompletion, hashToken, newCompletionCode, newToken, reservationMs } from "@/lib/survey/token";
import { UserError } from "@/lib/types";
import type { Study, Submission, User } from "@/lib/types";
import { getUserById, getVerification, payoutAddress } from "@/lib/users";

export const DEMO_SURVEY = "demo";

function toStudy(row: Row): Study {
  return {
    id: String(row.id),
    researcherId: String(row.researcher_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    surveyUrl: String(row.survey_url),
    rewardBase: num(row.reward_base),
    maxParticipants: num(row.max_participants),
    estMinutes: num(row.est_minutes),
    completionCode: String(row.completion_code),
    minCheck: row.min_check === "world-id" ? "world-id" : "basic",
    status: String(row.status) as Study["status"],
    chainEngine: row.chain_engine ? String(row.chain_engine) : null,
    chainStudyId: num(row.chain_study_id),
    chainRef: row.chain_ref ? String(row.chain_ref) : null,
    fundTx: row.fund_tx ? String(row.fund_tx) : null,
    closeTx: row.close_tx ? String(row.close_tx) : null,
    createdAt: num(row.created_at),
  };
}

function toSubmission(row: Row): Submission {
  return {
    id: String(row.id),
    studyId: String(row.study_id),
    participantId: String(row.participant_id),
    tokenHash: String(row.token_hash),
    status: String(row.status) as Submission["status"],
    startedAt: num(row.started_at),
    completedAt: row.completed_at === null || row.completed_at === undefined ? null : num(row.completed_at),
    payoutTx: row.payout_tx ? String(row.payout_tx) : null,
  };
}

async function onChain(study: Study): Promise<StudyOnChain> {
  const researcher = await getUserById(study.researcherId);
  if (!researcher) throw new Error("Study has no researcher.");
  return {
    studyId: study.id,
    chainStudyId: study.chainStudyId,
    researcherWallet: researcher.wallet,
    rewardBase: study.rewardBase,
    maxParticipants: study.maxParticipants,
    chainRef: study.chainRef,
  };
}

export interface NewStudyInput {
  title: string;
  description?: string;
  surveyUrl: string;
  rewardUsdc: number;
  maxParticipants: number;
  estMinutes: number;
  /** Only let participants in who passed the World ID check. */
  requireWorldId?: boolean;
}

export async function createStudy(user: User, input: NewStudyInput): Promise<Study> {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const rawUrl = String(input.surveyUrl ?? "").trim();
  const reward = Number(input.rewardUsdc);
  const max = Number(input.maxParticipants);
  const minutes = Number(input.estMinutes);

  if (title.length < 3 || title.length > 120) throw new UserError("The title needs 3 to 120 characters.", "bad_title");
  if (description.length > 1000) throw new UserError("The description is limited to 1000 characters.", "bad_description");
  if (!Number.isFinite(reward) || reward < 0.01 || reward > 100) {
    throw new UserError("The reward must be between 0.01 and 100 USDC.", "bad_reward");
  }
  if (!Number.isInteger(max) || max < 1 || max > 500) {
    throw new UserError("The number of participants must be a whole number from 1 to 500.", "bad_max");
  }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    throw new UserError("The expected duration must be a whole number of minutes from 1 to 120.", "bad_minutes");
  }

  const minCheck = input.requireWorldId ? "world-id" : "basic";
  if (minCheck === "world-id" && !worldConfig()) {
    throw new UserError("World ID is not set up for this app yet, so it cannot be required.", "world_id_off");
  }

  const id = newId();
  let surveyUrl: string;
  if (rawUrl === DEMO_SURVEY || rawUrl === "") {
    surveyUrl = `/demo-survey?study=${id}`;
  } else {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new UserError("The survey link is not a valid web address.", "bad_url");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new UserError("The survey link must start with https://", "bad_url");
    }
    surveyUrl = rawUrl;
  }

  const db = await getDb();
  await db.query(
    `INSERT INTO studies (id, researcher_id, title, description, survey_url, reward_base, max_participants,
                          est_minutes, completion_code, status, chain_study_id, created_at, min_check)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11, $12)`,
    [id, user.id, title, description, surveyUrl, toBase(reward), max, minutes, newCompletionCode(), randomInt(1, 2 ** 47), Date.now(), minCheck],
  );
  return (await getStudy(id))!;
}

export async function getStudy(id: string): Promise<Study | null> {
  const db = await getDb();
  const rows = await db.query("SELECT * FROM studies WHERE id = $1", [id]);
  return rows.length ? toStudy(rows[0]) : null;
}

export async function listStudiesOf(userId: string): Promise<Study[]> {
  const db = await getDb();
  const rows = await db.query("SELECT * FROM studies WHERE researcher_id = $1 ORDER BY created_at DESC", [userId]);
  return rows.map(toStudy);
}

async function ownStudy(user: User, studyId: string): Promise<Study> {
  const study = await getStudy(studyId);
  if (!study) throw new UserError("Study not found.", "not_found", 404);
  if (study.researcherId !== user.id) throw new UserError("This is not your study.", "forbidden", 403);
  return study;
}

export const budgetBase = (study: Study) => study.rewardBase * study.maxParticipants;

/** Locks the whole budget. After this the study is live and participants can start. */
export async function fundStudy(user: User, studyId: string): Promise<Study> {
  const study = await ownStudy(user, studyId);
  if (study.status !== "draft") throw new UserError("This study is already funded.", "already_funded");
  const engine = await getEngine();
  const balance = await engine.balanceOf(user.wallet);
  if (balance < budgetBase(study)) {
    throw new UserError("Your wallet does not hold enough test USDC for this budget.", "insufficient_funds", 400, {
      balanceBase: balance,
      neededBase: budgetBase(study),
    });
  }
  const db = await getDb();
  // Claim the draft first so two clicks cannot fund twice.
  const claimed = await db.query("UPDATE studies SET status = 'funding' WHERE id = $1 AND status = 'draft' RETURNING id", [
    study.id,
  ]);
  if (!claimed.length) throw new UserError("This study is already being funded.", "already_funded");
  try {
    const { chainRef, tx } = await engine.lockBudget(await onChain(study), { address: user.wallet, secret: user.walletSecret });
    await db.query("UPDATE studies SET status = 'live', chain_engine = $2, chain_ref = $3, fund_tx = $4 WHERE id = $1", [
      study.id,
      engine.name,
      chainRef,
      tx,
    ]);
  } catch (err) {
    await db.query("UPDATE studies SET status = 'draft' WHERE id = $1", [study.id]);
    throw err;
  }
  return (await getStudy(study.id))!;
}

export interface StudyStats {
  paid: number;
  inProgress: number;
  placesLeft: number;
  spentBase: number;
}

export async function studyStats(study: Study): Promise<StudyStats> {
  const db = await getDb();
  const rows = await db.query<{ status: string; started_at: unknown }>(
    "SELECT status, started_at FROM submissions WHERE study_id = $1",
    [study.id],
  );
  const cutoff = Date.now() - reservationMs(study.estMinutes);
  let paid = 0;
  let inProgress = 0;
  for (const row of rows) {
    if (row.status === "paid" || row.status === "paying") paid += 1;
    else if (row.status === "started" && num(row.started_at) > cutoff) inProgress += 1;
  }
  return {
    paid,
    inProgress,
    placesLeft: Math.max(0, study.maxParticipants - paid - inProgress),
    spentBase: paid * study.rewardBase,
  };
}

/** A participant starts: returns the survey link carrying their one-time token. */
export async function startSubmission(user: User, studyId: string): Promise<{ surveyUrl: string; submissionId: string }> {
  const study = await getStudy(studyId);
  if (!study) throw new UserError("Study not found.", "not_found", 404);
  if (study.status !== "live") throw new UserError("This study is not open.", "study_closed");
  if (study.researcherId === user.id) {
    throw new UserError("You cannot take your own study. Sign in with a different email to test it.", "own_study");
  }
  const verification = await getVerification(user.id);
  if (!verification) throw new UserError("Please pass the human check first.", "not_verified", 403);
  if (study.minCheck === "world-id" && verification.provider !== "world-id") {
    throw new UserError("This study only accepts participants verified with World ID.", "needs_world_id", 403);
  }

  const db = await getDb();
  const token = newToken();
  const now = Date.now();
  const existing = await db.query("SELECT * FROM submissions WHERE study_id = $1 AND participant_id = $2", [study.id, user.id]);

  let submissionId: string;
  if (existing.length) {
    const current = toSubmission(existing[0]);
    if (current.status !== "started") throw new UserError("You have already completed this study.", "already_done");
    // Re-opening the survey issues a fresh token and restarts the clock.
    await db.query("UPDATE submissions SET token_hash = $2, started_at = $3 WHERE id = $1", [current.id, hashToken(token), now]);
    submissionId = current.id;
  } else {
    const stats = await studyStats(study);
    if (stats.placesLeft <= 0) throw new UserError("All places in this study are taken.", "study_full");
    submissionId = newId();
    await db.query(
      `INSERT INTO submissions (id, study_id, participant_id, token_hash, status, started_at)
       VALUES ($1, $2, $3, $4, 'started', $5)`,
      [submissionId, study.id, user.id, hashToken(token), now],
    );
  }

  // Surveys hosted by this app (the demo survey) are returned as a relative link,
  // so they work on any address the app is opened from.
  const internal = study.surveyUrl.startsWith("/");
  const url = new URL(buildSurveyUrl(study.surveyUrl, token, "http://internal"));
  // `ref` is not secret: researchers store it in the survey to match answers to payouts.
  url.searchParams.set("ref", submissionId);
  return { surveyUrl: internal ? url.pathname + url.search : url.toString(), submissionId };
}

export interface CompletionResult {
  alreadyPaid: boolean;
  amountBase: number;
  tx: string | null;
  explorer: string | null;
  wallet: string;
  studyTitle: string;
}

/** Called when the survey redirects back. Pays if token, code and time check out. */
export async function completeSubmission(token: string, code: string): Promise<CompletionResult> {
  const db = await getDb();
  const rows = await db.query("SELECT * FROM submissions WHERE token_hash = $1", [hashToken(String(token ?? ""))]);
  if (!rows.length) throw new UserError("This completion link is not valid.", "bad_token", 404);
  const submission = toSubmission(rows[0]);
  const study = (await getStudy(submission.studyId))!;
  const participant = (await getUserById(submission.participantId))!;

  const result = (tx: string | null, alreadyPaid: boolean): CompletionResult => ({
    alreadyPaid,
    amountBase: study.rewardBase,
    tx,
    explorer: tx ? explorerTx(tx) : null,
    wallet: payoutAddress(participant),
    studyTitle: study.title,
  });

  if (submission.status === "paid") return result(submission.payoutTx, true);
  if (submission.status === "paying") throw new UserError("Your payment is being sent. Reload in a few seconds.", "paying", 409);

  const check = checkCompletion({
    studyStatus: study.status,
    expectedCode: study.completionCode,
    givenCode: String(code ?? ""),
    startedAt: submission.startedAt,
    estMinutes: study.estMinutes,
    now: Date.now(),
  });
  if (!check.ok) throw new UserError(check.message, check.code, 400, { waitSeconds: check.waitSeconds ?? 0 });

  // Claim the submission so a double request cannot pay twice.
  const claimed = await db.query("UPDATE submissions SET status = 'paying' WHERE id = $1 AND status = 'started' RETURNING id", [
    submission.id,
  ]);
  if (!claimed.length) throw new UserError("Your payment is being sent. Reload in a few seconds.", "paying", 409);

  try {
    const engine = await getEngine();
    const tx = await engine.payParticipant(await onChain(study), payoutAddress(participant));
    await db.query("UPDATE submissions SET status = 'paid', completed_at = $2, payout_tx = $3 WHERE id = $1", [
      submission.id,
      Date.now(),
      tx,
    ]);
    return result(tx, false);
  } catch (err) {
    if (err instanceof UserError && err.code === "already_paid") {
      // The chain says this wallet was paid for this study (for example after a lost reply).
      // Record it as paid so the participant is not asked to try again forever.
      await db.query("UPDATE submissions SET status = 'paid', completed_at = $2 WHERE id = $1", [submission.id, Date.now()]);
      return result(null, true);
    }
    await db.query("UPDATE submissions SET status = 'started' WHERE id = $1", [submission.id]);
    throw err;
  }
}

/** True when the study uses the survey built into this app (which keeps its answers here). */
export function usesBuiltInSurvey(study: Study): boolean {
  return study.surveyUrl.startsWith("/");
}

/**
 * For the built-in demo survey only: saves the answers and hands out the redirect,
 * once the token proves a started submission.
 */
export async function demoSurveyRedirect(studyId: string, token: string, answers?: unknown): Promise<string> {
  const db = await getDb();
  const rows = await db.query("SELECT * FROM submissions WHERE token_hash = $1 AND study_id = $2", [
    hashToken(String(token ?? "")),
    studyId,
  ]);
  if (!rows.length) throw new UserError("Open this survey from the study page.", "bad_token", 404);
  const study = (await getStudy(studyId))!;
  if (!usesBuiltInSurvey(study)) throw new UserError("This study does not use the built-in survey.", "bad_token", 404);
  // Answers can be saved (or corrected) only until the participant is paid.
  await db.query("UPDATE submissions SET answers = $2 WHERE id = $1 AND status = 'started'", [
    String(rows[0].id),
    JSON.stringify(cleanAnswers(answers)),
  ]);
  return `/done?t=${encodeURIComponent(token)}&cc=${study.completionCode}`;
}

/** Ends the study and returns the unspent budget to the researcher. */
export async function closeStudy(user: User, studyId: string): Promise<{ study: Study; refundedBase: number }> {
  const study = await ownStudy(user, studyId);
  if (study.status !== "live") throw new UserError("Only a live study can be closed.", "not_live");
  const db = await getDb();
  const paying = await db.query("SELECT id FROM submissions WHERE study_id = $1 AND status = 'paying'", [study.id]);
  if (paying.length) throw new UserError("A payment is in progress. Try again in a few seconds.", "paying", 409);
  const claimed = await db.query("UPDATE studies SET status = 'closing' WHERE id = $1 AND status = 'live' RETURNING id", [study.id]);
  if (!claimed.length) throw new UserError("This study is already being closed.", "not_live");
  try {
    const engine = await getEngine();
    const { tx, refundedBase } = await engine.closeStudy(await onChain(study), { address: user.wallet, secret: user.walletSecret });
    await db.query("UPDATE studies SET status = 'closed', close_tx = $2 WHERE id = $1", [study.id, tx || null]);
    return { study: (await getStudy(study.id))!, refundedBase };
  } catch (err) {
    await db.query("UPDATE studies SET status = 'live' WHERE id = $1", [study.id]);
    throw err;
  }
}

export interface SubmissionView {
  id: string;
  wallet: string;
  /** Which human check the participant passed, e.g. "basic" or "world-id". */
  humanCheck: string;
  status: string;
  startedAt: number;
  completedAt: number | null;
  seconds: number | null;
  payoutTx: string | null;
  explorer: string | null;
  /** Answers to the built-in survey; null for studies run in an external survey tool. */
  answers: DemoAnswers | null;
}

export async function listSubmissions(studyId: string): Promise<SubmissionView[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT s.*, COALESCE(u.payout_wallet, u.wallet) AS wallet, v.provider AS check_provider, v.level AS check_level
     FROM submissions s
     JOIN users u ON u.id = s.participant_id
     LEFT JOIN verifications v ON v.user_id = s.participant_id
     WHERE s.study_id = $1 ORDER BY s.started_at DESC`,
    [studyId],
  );
  return rows.map((row) => {
    const s = toSubmission(row);
    return {
      id: s.id,
      wallet: String(row.wallet),
      humanCheck: row.check_provider === "world-id" ? "world-id" : String(row.check_level ?? "none"),
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      seconds: s.completedAt ? Math.round((s.completedAt - s.startedAt) / 1000) : null,
      payoutTx: s.payoutTx,
      explorer: s.payoutTx ? explorerTx(s.payoutTx) : null,
      answers: parseAnswers(row.answers),
    };
  });
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Free text typed by a participant: stop spreadsheet programs from reading it as a formula. */
function freeTextCell(value: string): string {
  return csvCell(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
}

/**
 * Export for analysis and grant accounting. No emails: `ref` matches the value stored in the survey.
 * Studies that use the built-in survey also get one column per question.
 */
export async function exportCsv(user: User, studyId: string): Promise<string> {
  const study = await ownStudy(user, studyId);
  const submissions = await listSubmissions(study.id);
  const withAnswers = usesBuiltInSurvey(study);
  const header = ["ref", "wallet", "human_check", "status", "started_at", "completed_at", "seconds", "reward_usdc", "payout_transaction"];
  if (withAnswers) header.push(DEMO_QUESTIONS.usage.column, DEMO_QUESTIONS.trust.column, DEMO_QUESTIONS.comment.column);
  const lines = submissions.map((s) => {
    const cells = [
      s.id,
      s.wallet,
      s.humanCheck,
      s.status,
      new Date(s.startedAt).toISOString(),
      s.completedAt ? new Date(s.completedAt).toISOString() : "",
      s.seconds ?? "",
      s.status === "paid" ? (study.rewardBase / 1_000_000).toFixed(2) : "",
      s.payoutTx ?? "",
    ].map(csvCell);
    if (withAnswers) cells.push(csvCell(s.answers?.usage), csvCell(s.answers?.trust), freeTextCell(s.answers?.comment ?? ""));
    return cells.join(",");
  });
  return [header.join(","), ...lines].join("\n") + "\n";
}

export async function getOwnStudy(user: User, studyId: string): Promise<Study> {
  return ownStudy(user, studyId);
}
