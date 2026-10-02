export type StudyStatus = "draft" | "live" | "closed";
export type SubmissionStatus = "started" | "paying" | "paid";

export interface User {
  id: string;
  email: string;
  wallet: string;
  /** Key of the app-held wallet. Used when the user acts as a researcher (funding, refunds). */
  walletSecret: string | null;
  /** The user's own wallet from email login (Privy). Payouts go here when it exists. */
  payoutWallet: string | null;
  privyId: string | null;
  createdAt: number;
}

export type CheckLevel = "basic" | "world-id";

export interface Verification {
  userId: string;
  /** "email" (basic) or "world-id". */
  provider: string;
  level: string;
  attestation: string | null;
  createdAt: number;
}

export interface Study {
  id: string;
  researcherId: string;
  title: string;
  description: string;
  surveyUrl: string;
  rewardBase: number;
  maxParticipants: number;
  estMinutes: number;
  completionCode: string;
  /** Minimum human check a participant needs: "basic" or "world-id". */
  minCheck: CheckLevel;
  status: StudyStatus;
  chainEngine: string | null;
  chainStudyId: number;
  chainRef: string | null;
  fundTx: string | null;
  closeTx: string | null;
  createdAt: number;
}

export interface Submission {
  id: string;
  studyId: string;
  participantId: string;
  tokenHash: string;
  status: SubmissionStatus;
  startedAt: number;
  completedAt: number | null;
  payoutTx: string | null;
}

/** An error whose message is safe and useful to show to the user. */
export class UserError extends Error {
  constructor(
    message: string,
    public code: string = "bad_request",
    public status: number = 400,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "UserError";
  }
}
