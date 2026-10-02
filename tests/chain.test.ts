import { describe, expect, it } from "vitest";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { closeStudyIx, createStudyIx, discriminator, payoutIx, receiptAddress, studyAddress, vaultAddress } from "@/lib/chain/escrow";
import { uniqueSigners } from "@/lib/chain/solana";
import { buildFaucet, buildLockBudget, buildPayout, buildRefund, vaultKeypair } from "@/lib/chain/vault";

/** Signs offline with a dummy blockhash. Passing proves every required signer was supplied. */
function signsCompletely(instructions: Parameters<Transaction["add"]>, feePayer: Keypair, signers: Keypair[]): boolean {
  const tx = new Transaction().add(...instructions);
  tx.feePayer = feePayer.publicKey;
  tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
  tx.sign(...uniqueSigners([feePayer, ...signers]));
  return tx.verifySignatures(true);
}

describe("vault engine transactions", () => {
  const platform = Keypair.generate();
  const researcher = Keypair.generate();
  const participant = Keypair.generate();
  const vault = vaultKeypair(platform, "study-1");

  it("derives one stable vault key per study", () => {
    expect(vaultKeypair(platform, "study-1").publicKey.equals(vault.publicKey)).toBe(true);
    expect(vaultKeypair(platform, "study-2").publicKey.equals(vault.publicKey)).toBe(false);
    expect(vaultKeypair(Keypair.generate(), "study-1").publicKey.equals(vault.publicKey)).toBe(false);
  });

  it("needs exactly the expected signers", () => {
    expect(signsCompletely(buildLockBudget(platform.publicKey, vault.publicKey, researcher.publicKey, 3_000_000), platform, [researcher])).toBe(true);
    expect(signsCompletely(buildPayout(platform.publicKey, vault.publicKey, participant.publicKey, 1_000_000), platform, [vault])).toBe(true);
    expect(signsCompletely(buildRefund(platform.publicKey, vault.publicKey, researcher.publicKey, 2_000_000), platform, [vault])).toBe(true);
    expect(signsCompletely(buildFaucet(platform.publicKey, researcher.publicKey, 20_000_000), platform, [])).toBe(true);
    // A payout without the vault key must not be complete.
    expect(signsCompletely(buildPayout(platform.publicKey, vault.publicKey, participant.publicKey, 1), platform, [])).toBe(false);
  });
});

describe("escrow engine instructions", () => {
  const programId = Keypair.generate().publicKey;
  const platform = Keypair.generate();
  const researcher = Keypair.generate();
  const participant = Keypair.generate().publicKey;
  const study = studyAddress(programId, researcher.publicKey, 42);

  it("uses 8-byte Anchor discriminators that differ per instruction", () => {
    const names = ["create_study", "payout", "close_study"].map((n) => discriminator(n).toString("hex"));
    expect(new Set(names).size).toBe(3);
    names.forEach((hex) => expect(hex).toHaveLength(16));
  });

  it("derives program addresses off the curve and per study", () => {
    expect(PublicKey.isOnCurve(study.toBytes())).toBe(false);
    expect(studyAddress(programId, researcher.publicKey, 43).equals(study)).toBe(false);
    expect(PublicKey.isOnCurve(vaultAddress(programId, study).toBytes())).toBe(false);
    expect(receiptAddress(programId, study, participant).equals(receiptAddress(programId, study, researcher.publicKey))).toBe(false);
  });

  it("encodes create_study as discriminator + u64 + u64 + u32", () => {
    const ix = createStudyIx({ programId, researcher: researcher.publicKey, feePayer: platform.publicKey, payoutAuthority: platform.publicKey, chainStudyId: 42, rewardBase: 1_500_000, maxParticipants: 30 });
    expect(ix.data).toHaveLength(8 + 8 + 8 + 4);
    expect(ix.data.readBigUInt64LE(8)).toBe(42n);
    expect(ix.data.readBigUInt64LE(16)).toBe(1_500_000n);
    expect(ix.data.readUInt32LE(24)).toBe(30);
    expect(ix.keys).toHaveLength(10);
    expect(signsCompletely([ix], platform, [researcher])).toBe(true);
  });

  it("payout needs only the platform key; close needs the researcher", () => {
    const pay = payoutIx({ programId, study, payoutAuthority: platform.publicKey, feePayer: platform.publicKey, participant });
    expect(pay.keys).toHaveLength(9);
    expect(signsCompletely([pay], platform, [])).toBe(true);
    const close = closeStudyIx({ programId, study, researcher: researcher.publicKey });
    expect(close.keys).toHaveLength(5);
    expect(signsCompletely([close], platform, [researcher])).toBe(true);
    expect(signsCompletely([close], platform, [])).toBe(false);
  });
});
