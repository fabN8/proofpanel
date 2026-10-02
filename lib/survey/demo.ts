/**
 * The built-in three-question survey. It stands in for an external survey tool,
 * and unlike one it keeps its answers in this app so the researcher can see results.
 */
import { UserError } from "@/lib/types";

export const USAGE_OPTIONS = ["Never", "Rarely", "Sometimes", "Often", "Daily"] as const;
export const TRUST_OPTIONS = ["1", "2", "3", "4", "5"] as const;
export const COMMENT_MAX = 1000;

export const DEMO_QUESTIONS = {
  usage: { column: "q1_ai_usage", text: "How often do you use AI assistants?" },
  trust: { column: "q2_trust_1_to_5", text: "How much do you trust their answers? (1 = not at all, 5 = fully)" },
  comment: { column: "q3_comment", text: "What would make you trust them more?" },
} as const;

export interface DemoAnswers {
  usage: string;
  trust: string;
  comment: string;
}

/** Checks answers sent by the browser. Only known options and a length-limited comment get through. */
export function cleanAnswers(raw: unknown): DemoAnswers {
  const input = (raw ?? {}) as Record<string, unknown>;
  const usage = String(input.usage ?? "");
  const trust = String(input.trust ?? "");
  if (!(USAGE_OPTIONS as readonly string[]).includes(usage) || !(TRUST_OPTIONS as readonly string[]).includes(trust)) {
    throw new UserError("Please answer questions 1 and 2.", "answers_missing");
  }
  const comment = String(input.comment ?? "").trim().slice(0, COMMENT_MAX);
  return { usage, trust, comment };
}

/** Reads answers back from the database; null when there are none or they are unreadable. */
export function parseAnswers(stored: unknown): DemoAnswers | null {
  if (typeof stored !== "string" || !stored) return null;
  try {
    return cleanAnswers(JSON.parse(stored));
  } catch {
    return null;
  }
}

export interface DemoSummary {
  count: number;
  usage: Array<{ option: string; count: number }>;
  trust: Array<{ option: string; count: number }>;
  trustAverage: number | null;
  comments: string[];
}

export function summarise(answers: DemoAnswers[]): DemoSummary {
  const tally = (options: readonly string[], pick: (a: DemoAnswers) => string) =>
    options.map((option) => ({ option, count: answers.filter((a) => pick(a) === option).length }));
  const trustSum = answers.reduce((sum, a) => sum + Number(a.trust), 0);
  return {
    count: answers.length,
    usage: tally(USAGE_OPTIONS, (a) => a.usage),
    trust: tally(TRUST_OPTIONS, (a) => a.trust),
    trustAverage: answers.length ? trustSum / answers.length : null,
    comments: answers.map((a) => a.comment).filter(Boolean),
  };
}
