/**
 * Vault engine: the study budget sits in a USDC account owned by a key that only the
 * platform can derive. Simple and real, but it relies on trusting the platform.
 * The escrow engine replaces this with rules enforced on-chain.
 */
import { createHash } from "node:crypto";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import type { ChainEngine, SignerWallet, StudyOnChain } from "./types";
import {
  ensureTokenAccountIx,
  platformKeypair,
  send,
  signerOf,
  tokenAccountBalance,
  tokenAccountOf,
  transferIx,
} from "./solana";

/** Each study gets its own vault key, derived from the platform key and the study id. */
export function vaultKeypair(platform: Keypair, studyId: string): Keypair {
  const seed = createHash("sha256")
    .update("proofpanel-vault:")
    .update(platform.secretKey)
    .update(":")
    .update(studyId)
    .digest();
  return Keypair.fromSeed(seed);
}

export function buildLockBudget(platform: PublicKey, vaultOwner: PublicKey, researcher: PublicKey, totalBase: number) {
  const instructions: TransactionInstruction[] = [
    ensureTokenAccountIx(platform, vaultOwner),
    transferIx(tokenAccountOf(researcher), tokenAccountOf(vaultOwner), researcher, totalBase),
  ];
  return instructions;
}

export function buildPayout(platform: PublicKey, vaultOwner: PublicKey, participant: PublicKey, rewardBase: number) {
  return [
    ensureTokenAccountIx(platform, participant),
    transferIx(tokenAccountOf(vaultOwner), tokenAccountOf(participant), vaultOwner, rewardBase),
  ];
}

export function buildRefund(platform: PublicKey, vaultOwner: PublicKey, researcher: PublicKey, amountBase: number) {
  return [
    ensureTokenAccountIx(platform, researcher),
    transferIx(tokenAccountOf(vaultOwner), tokenAccountOf(researcher), vaultOwner, amountBase),
  ];
}

export function buildFaucet(platform: PublicKey, to: PublicKey, amountBase: number) {
  return [ensureTokenAccountIx(platform, to), transferIx(tokenAccountOf(platform), tokenAccountOf(to), platform, amountBase)];
}

export function createVaultEngine(): ChainEngine {
  const platform = platformKeypair();
  const vaultFor = (study: StudyOnChain) => vaultKeypair(platform, study.studyId);

  return {
    name: "vault",
    live: true,
    platformAddress: () => platform.publicKey.toBase58(),
    balanceOf: (wallet) => tokenAccountBalance(tokenAccountOf(new PublicKey(wallet))),
    faucet: (toWallet, amountBase) => send(buildFaucet(platform.publicKey, new PublicKey(toWallet), amountBase)),
    async lockBudget(study: StudyOnChain, researcher: SignerWallet) {
      const vault = vaultFor(study);
      const researcherKey = signerOf(researcher);
      const total = study.rewardBase * study.maxParticipants;
      const tx = await send(
        buildLockBudget(platform.publicKey, vault.publicKey, researcherKey.publicKey, total),
        [researcherKey],
      );
      return { chainRef: tokenAccountOf(vault.publicKey).toBase58(), tx };
    },
    async payParticipant(study, participantWallet) {
      const vault = vaultFor(study);
      return send(
        buildPayout(platform.publicKey, vault.publicKey, new PublicKey(participantWallet), study.rewardBase),
        [vault],
      );
    },
    async closeStudy(study, researcher) {
      const vault = vaultFor(study);
      const left = await tokenAccountBalance(tokenAccountOf(vault.publicKey));
      if (left === 0) return { tx: "", refundedBase: 0 };
      const tx = await send(
        buildRefund(platform.publicKey, vault.publicKey, new PublicKey(researcher.address), left),
        [vault],
      );
      return { tx, refundedBase: left };
    },
    vaultBalance: (study) => tokenAccountBalance(tokenAccountOf(vaultFor(study).publicKey)),
  };
}
