import type { EngineName } from "@/lib/config";

/** A wallet the app can sign for (demo wallets). `secret` is base58. */
export interface SignerWallet {
  address: string;
  secret: string | null;
}

/** What the engine needs to find a study's money again. */
export interface StudyOnChain {
  studyId: string;
  chainStudyId: number;
  researcherWallet: string;
  rewardBase: number;
  maxParticipants: number;
  chainRef: string | null;
}

export interface ChainEngine {
  name: EngineName;
  /** True when transactions are real and visible on a Solana explorer. */
  live: boolean;
  /** Address of the platform wallet that pays fees and hands out test USDC. */
  platformAddress(): string;
  /** USDC balance of a wallet, in base units (1 USDC = 1,000,000). */
  balanceOf(wallet: string): Promise<number>;
  /** Demo faucet: sends test USDC from the platform wallet. */
  faucet(toWallet: string, amountBase: number): Promise<string>;
  /** Moves reward x maxParticipants from the researcher into the study's vault. */
  lockBudget(study: StudyOnChain, researcher: SignerWallet): Promise<{ chainRef: string; tx: string }>;
  /** Pays one fixed reward from the vault to the participant. */
  payParticipant(study: StudyOnChain, participantWallet: string): Promise<string>;
  /** Returns what is left in the vault to the researcher. */
  closeStudy(study: StudyOnChain, researcher: SignerWallet): Promise<{ tx: string; refundedBase: number }>;
  vaultBalance(study: StudyOnChain): Promise<number>;
}

export function explorerTx(sig: string): string | null {
  if (!sig || sig.startsWith("mock-")) return null;
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function explorerAddress(address: string): string | null {
  if (!address || address.startsWith("mock:")) return null;
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
