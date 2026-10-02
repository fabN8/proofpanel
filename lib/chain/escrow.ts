/**
 * Saturday version: the budget is locked in the `study_escrow` program (see program/src/lib.rs).
 * The program enforces: fixed reward, one payout per participant, remainder only to the researcher.
 *
 * The instructions are encoded by hand (8-byte Anchor discriminator + arguments) so this file
 * does not depend on which Anchor version built the program.
 */
import { createHash } from "node:crypto";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { ChainEngine, SignerWallet, StudyOnChain } from "./types";
import { ensureTokenAccountIx, mint, platformKeypair, send, signerOf, tokenAccountBalance, tokenAccountOf } from "./solana";

export function discriminator(instructionName: string): Buffer {
  return createHash("sha256").update(`global:${instructionName}`).digest().subarray(0, 8);
}

function u64(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function u32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf;
}

export function studyAddress(programId: PublicKey, researcher: PublicKey, chainStudyId: number): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("study"), researcher.toBuffer(), u64(chainStudyId)], programId)[0];
}

export function vaultAddress(programId: PublicKey, study: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), study.toBuffer()], programId)[0];
}

export function receiptAddress(programId: PublicKey, study: PublicKey, participant: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), study.toBuffer(), participant.toBuffer()],
    programId,
  )[0];
}

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({ pubkey, isSigner, isWritable });

/** Account order must match `CreateStudy` in program/src/lib.rs. */
export function createStudyIx(args: {
  programId: PublicKey;
  researcher: PublicKey;
  feePayer: PublicKey;
  payoutAuthority: PublicKey;
  chainStudyId: number;
  rewardBase: number;
  maxParticipants: number;
}): TransactionInstruction {
  const study = studyAddress(args.programId, args.researcher, args.chainStudyId);
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      meta(args.researcher, true, false),
      meta(args.feePayer, true, true),
      meta(args.payoutAuthority, false, false),
      meta(mint(), false, false),
      meta(study, false, true),
      meta(vaultAddress(args.programId, study), false, true),
      meta(tokenAccountOf(args.researcher), false, true),
      meta(TOKEN_PROGRAM_ID, false, false),
      meta(SystemProgram.programId, false, false),
      meta(SYSVAR_RENT_PUBKEY, false, false),
    ],
    data: Buffer.concat([
      discriminator("create_study"),
      u64(args.chainStudyId),
      u64(args.rewardBase),
      u32(args.maxParticipants),
    ]),
  });
}

/** Account order must match `Payout` in program/src/lib.rs. */
export function payoutIx(args: {
  programId: PublicKey;
  study: PublicKey;
  payoutAuthority: PublicKey;
  feePayer: PublicKey;
  participant: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      meta(args.payoutAuthority, true, false),
      meta(args.feePayer, true, true),
      meta(args.study, false, true),
      meta(vaultAddress(args.programId, args.study), false, true),
      meta(args.participant, false, false),
      meta(tokenAccountOf(args.participant), false, true),
      meta(receiptAddress(args.programId, args.study, args.participant), false, true),
      meta(TOKEN_PROGRAM_ID, false, false),
      meta(SystemProgram.programId, false, false),
    ],
    data: discriminator("payout"),
  });
}

/** Account order must match `CloseStudy` in program/src/lib.rs. */
export function closeStudyIx(args: { programId: PublicKey; study: PublicKey; researcher: PublicKey }) {
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      meta(args.researcher, true, false),
      meta(args.study, false, true),
      meta(vaultAddress(args.programId, args.study), false, true),
      meta(tokenAccountOf(args.researcher), false, true),
      meta(TOKEN_PROGRAM_ID, false, false),
    ],
    data: discriminator("close_study"),
  });
}

export function createEscrowEngine(): ChainEngine {
  const platform = platformKeypair();
  const rawProgramId = process.env.ESCROW_PROGRAM_ID?.trim();
  if (!rawProgramId) throw new Error("ESCROW_PROGRAM_ID is not set. Deploy the program first (see README).");
  const programId = new PublicKey(rawProgramId);

  const studyOf = (study: StudyOnChain) =>
    studyAddress(programId, new PublicKey(study.researcherWallet), study.chainStudyId);

  return {
    name: "escrow",
    live: true,
    platformAddress: () => platform.publicKey.toBase58(),
    balanceOf: (wallet) => tokenAccountBalance(tokenAccountOf(new PublicKey(wallet))),
    async faucet(toWallet, amountBase) {
      const { buildFaucet } = await import("./vault");
      return send(buildFaucet(platform.publicKey, new PublicKey(toWallet), amountBase));
    },
    async lockBudget(study: StudyOnChain, researcher: SignerWallet) {
      const researcherKey = signerOf(researcher);
      const tx = await send(
        [
          createStudyIx({
            programId,
            researcher: researcherKey.publicKey,
            feePayer: platform.publicKey,
            payoutAuthority: platform.publicKey,
            chainStudyId: study.chainStudyId,
            rewardBase: study.rewardBase,
            maxParticipants: study.maxParticipants,
          }),
        ],
        [researcherKey],
      );
      return { chainRef: studyOf(study).toBase58(), tx };
    },
    async payParticipant(study, participantWallet) {
      const participant = new PublicKey(participantWallet);
      return send([
        ensureTokenAccountIx(platform.publicKey, participant),
        payoutIx({
          programId,
          study: studyOf(study),
          payoutAuthority: platform.publicKey,
          feePayer: platform.publicKey,
          participant,
        }),
      ]);
    },
    async closeStudy(study, researcher) {
      const researcherKey = signerOf(researcher);
      const studyKey = studyOf(study);
      const left = await tokenAccountBalance(vaultAddress(programId, studyKey));
      const tx = await send([closeStudyIx({ programId, study: studyKey, researcher: researcherKey.publicKey })], [researcherKey]);
      return { tx, refundedBase: left };
    },
    vaultBalance: (study) => tokenAccountBalance(vaultAddress(programId, studyOf(study))),
  };
}
