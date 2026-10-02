/** Token and completion-code logic for the survey round trip. Pure functions, easy to test. */
import { createHash, randomBytes } from "node:crypto";
import { minTimeFactor } from "@/lib/config";

/** A random, single-use token that travels through the survey as the `pid` parameter. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Only the hash is stored, so a database leak does not reveal usable tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A short code that only the survey's end page knows. */
export function newCompletionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

/** Seconds a participant must spend before a completion counts. */
export function minSeconds(estMinutes: number): number {
  return Math.ceil(estMinutes * 60 * minTimeFactor());
}

/** How long a started submission keeps its place before someone else may take it. */
export function reservationMs(estMinutes: number): number {
  return (estMinutes * 3 + 15) * 60_000;
}

/**
 * Adds the participant token to the researcher's survey link.
 * If the link contains `{pid}`, that placeholder is replaced; otherwise `pid=<token>` is appended.
 */
export function buildSurveyUrl(surveyUrl: string, token: string, base: string): string {
  if (surveyUrl.includes("{pid}")) return absolute(surveyUrl.replaceAll("{pid}", encodeURIComponent(token)), base);
  const url = new URL(surveyUrl, base);
  url.searchParams.set("pid", token);
  return url.toString();
}

function absolute(link: string, base: string): string {
  return new URL(link, base).toString();
}

/** The link the researcher pastes into the survey tool's end-of-survey redirect. */
export function redirectTemplate(appUrl: string, completionCode: string, pidPlaceholder: string): string {
  return `${appUrl}/done?t=${pidPlaceholder}&cc=${completionCode}`;
}

export type CompletionCheck =
  | { ok: true }
  | { ok: false; code: "wrong_code" | "too_fast" | "study_closed"; message: string; waitSeconds?: number };

export function checkCompletion(input: {
  studyStatus: string;
  expectedCode: string;
  givenCode: string;
  startedAt: number;
  estMinutes: number;
  now: number;
}): CompletionCheck {
  if (input.studyStatus !== "live") {
    return { ok: false, code: "study_closed", message: "This study is no longer open." };
  }
  if (input.givenCode.trim().toUpperCase() !== input.expectedCode.toUpperCase()) {
    return { ok: false, code: "wrong_code", message: "The completion code is not correct." };
  }
  const needed = minSeconds(input.estMinutes);
  const spent = Math.floor((input.now - input.startedAt) / 1000);
  if (spent < needed) {
    return {
      ok: false,
      code: "too_fast",
      message: "Payments are released after a minimum time on the survey, to keep rushed answers out.",
      waitSeconds: needed - spent,
    };
  }
  return { ok: true };
}
