import { beforeAll, describe, expect, it } from "vitest";

process.env.CHAIN_ENGINE = "mock";
process.env.PGLITE_DIR = "memory";
process.env.MIN_TIME_FACTOR = "0";
process.env.WORLD_APP_ID = "app_test1234";
process.env.WORLD_RP_ID = "rp_test1234";
process.env.WORLD_SIGNING_KEY = "0x" + "11".repeat(32);

import { getEngine } from "@/lib/chain";
import { isRateLimited, isTemporary, rpc, submit, waitForConfirmation } from "@/lib/chain/solana";
import { toBase, worldConfig } from "@/lib/config";
import { identityFrom } from "@/lib/privy";
import { completeSubmission, createStudy, fundStudy, listSubmissions, startSubmission } from "@/lib/studies";
import { UserError } from "@/lib/types";
import type { User } from "@/lib/types";
import { getVerification, payoutAddress, recordWorldIdCheck, signInWithEmail, signInWithPrivy } from "@/lib/users";
import { buildWorldRequest, verifyWorldProof } from "@/lib/worldid";

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => err instanceof UserError && err.code === code);
}
const tokenOf = (surveyUrl: string) => new URL(surveyUrl, "http://x").searchParams.get("pid")!;

describe("waiting for a transaction to confirm", () => {
  type Status = object | null | Error;
  const reader = (statuses: Status[], heights: Array<number | Error> = [1]) => {
    let s = 0;
    let h = 0;
    const next = <T,>(list: T[], index: number): T => list[Math.min(index, list.length - 1)];
    return {
      calls: () => s,
      getSignatureStatuses: async () => {
        const status = next(statuses, s++);
        if (status instanceof Error) throw status;
        return { context: { slot: 1 }, value: [status] };
      },
      getBlockHeight: async () => {
        const height = next(heights, h++);
        if (height instanceof Error) throw height;
        return height;
      },
    } as never as Parameters<typeof waitForConfirmation>[0] & { calls: () => number };
  };
  const fast = { intervalMs: 1, maxIntervalMs: 2 };
  const rateLimit = () => new Error('429 Too Many Requests: {"jsonrpc":"2.0","error":{"code": 429, "message":"Too many requests for a specific RPC call"}}');
  const confirmed = { confirmationStatus: "confirmed", err: null };

  it("returns once the status is confirmed", async () => {
    const conn = reader([null, { confirmationStatus: "processed", err: null }, confirmed]);
    await waitForConfirmation(conn, "sig", 100, fast);
    expect(conn.calls()).toBe(3);
  });

  it("throws when the network rejects the transaction", async () => {
    const conn = reader([{ confirmationStatus: "confirmed", err: { InstructionError: [0, "Custom"] } }]);
    await expect(waitForConfirmation(conn, "sig", 100, fast)).rejects.toThrow(/rejected/);
  });

  it("throws when the transaction expires without landing", async () => {
    const conn = reader([null], [101]);
    await expect(waitForConfirmation(conn, "sig", 100, fast)).rejects.toThrow(/expired/);
  });

  it("keeps waiting while the endpoint is rate-limiting, then confirms", async () => {
    const conn = reader([rateLimit(), rateLimit(), null, rateLimit(), confirmed], [rateLimit()]);
    await waitForConfirmation(conn, "sig", 100, fast);
    expect(conn.calls()).toBe(5);
  });

  it("does not mistake a rejection with error number 429 for a rate limit", async () => {
    const conn = reader([{ confirmationStatus: "confirmed", err: { InstructionError: [0, { Custom: 429 }] } }]);
    await expect(waitForConfirmation(conn, "sig", 100, fast)).rejects.toThrow(/rejected/);
    expect(conn.calls()).toBe(1);
  });

  it("gives up with a clear message if the endpoint never answers", async () => {
    const conn = reader([rateLimit()]);
    await expect(waitForConfirmation(conn, "sig", 100, { ...fast, timeoutMs: 30 })).rejects.toThrow(/did not confirm the transaction in time/);
  });
});

describe("requests to the Solana endpoint", () => {
  const rateLimit = () => new Error("429 Too Many Requests: {}");

  it("repeats a rate-limited request until it succeeds", async () => {
    let calls = 0;
    const result = await rpc(async () => {
      calls += 1;
      if (calls < 3) throw rateLimit();
      return "ok";
    }, [1, 1, 1]);
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("stops after the last pause and does not repeat real errors", async () => {
    let calls = 0;
    await expect(rpc(async () => { calls += 1; throw rateLimit(); }, [1, 1])).rejects.toThrow(/429/);
    expect(calls).toBe(3);

    calls = 0;
    await expect(rpc(async () => { calls += 1; throw new Error("custom program error: 0x1"); }, [1, 1])).rejects.toThrow(/0x1/);
    expect(calls).toBe(1);
  });

  it("tells rate limits and network hiccups apart from real failures", () => {
    expect(isRateLimited(rateLimit())).toBe(true);
    expect(isRateLimited(new Error("failed to send transaction: Too many requests for a specific RPC call"))).toBe(true);
    expect(isRateLimited(new Error("Transaction simulation failed: custom program error: 0x1ad (429)"))).toBe(false);
    expect(isTemporary(new TypeError("fetch failed"))).toBe(true);
    expect(isTemporary(new Error("503 Service Unavailable: "))).toBe(true);
    expect(isTemporary(new Error("insufficient funds"))).toBe(false);
  });

  const sender = (outcomes: Array<Error | string>) => {
    let i = 0;
    return {
      calls: () => i,
      sendRawTransaction: async () => {
        const outcome = outcomes[Math.min(i++, outcomes.length - 1)];
        if (outcome instanceof Error) throw outcome;
        return outcome;
      },
    } as never as Parameters<typeof submit>[0] & { calls: () => number };
  };
  const raw = new Uint8Array([1, 2, 3]);

  it("sends again after a rate limit", async () => {
    const conn = sender([rateLimit(), rateLimit(), "sig"]);
    expect(await submit(conn, raw, [1, 1, 1])).toBe("sent");
    expect(conn.calls()).toBe(3);
  });

  it("reports 'refused' only when every attempt hit the rate limit", async () => {
    expect(await submit(sender([rateLimit()]), raw, [1, 1])).toBe("refused");
  });

  it("treats a dropped connection as possibly sent, so the status check decides", async () => {
    expect(await submit(sender([new TypeError("fetch failed"), rateLimit()]), raw, [1, 1])).toBe("sent");
    const processed = new Error("Transaction simulation failed: This transaction has already been processed");
    expect(await submit(sender([new TypeError("fetch failed"), processed]), raw, [1, 1])).toBe("sent");
  });

  it("passes real errors on unchanged", async () => {
    await expect(submit(sender([new Error("Transaction simulation failed: insufficient funds")]), raw, [1])).rejects.toThrow(/insufficient funds/);
  });
});

describe("Privy sign-in", () => {
  it("picks the verified email and the embedded Solana wallet", () => {
    const identity = identityFrom("did:privy:1", [
      { type: "wallet", chain_type: "ethereum", connector_type: "embedded", address: "0xabc" },
      { type: "email", address: "Ada@Example.org" },
      { type: "wallet", chain_type: "solana", connector_type: "embedded", address: "SoLwallet111" },
    ]);
    expect(identity).toEqual({ privyId: "did:privy:1", email: "Ada@Example.org", wallet: "SoLwallet111" });
    expect(identityFrom("did:privy:2", [{ type: "email", address: "a@b.org" }]).wallet).toBeNull();
    expect(() => identityFrom("did:privy:3", [])).toThrow(/no verified email/);
  });

  it("keeps the account of an email, adds the user's own wallet and pays rewards to it", async () => {
    const demo = await signInWithEmail("ada@example.org");
    const privy = await signInWithPrivy({ privyId: "did:privy:1", email: "Ada@example.org", wallet: "OwnWallet1111" });
    expect(privy.id).toBe(demo.id);
    expect(privy.wallet).toBe(demo.wallet);
    expect(payoutAddress(privy)).toBe("OwnWallet1111");
    expect((await getVerification(privy.id))?.level).toBe("verified email");
    // Same Privy user again, even with a changed email, is the same account.
    expect((await signInWithPrivy({ privyId: "did:privy:1", email: "ada@example.org", wallet: "OwnWallet1111" })).id).toBe(demo.id);
    await expectCode(signInWithPrivy({ privyId: "did:privy:other", email: "ada@example.org", wallet: "X" }), "account_mismatch");
  });
});

describe("World ID human check", () => {
  const cfg = worldConfig()!;
  const proof = { protocol_version: "4.0", environment: "staging", action: cfg.action, responses: [{ identifier: "proof_of_human", nullifier: "0xABCDEF" }] };
  const answer = (status: number, body: object) => (async () => new Response(JSON.stringify(body), { status })) as never as typeof fetch;

  it("signs a fresh request without exposing the key", () => {
    const a = buildWorldRequest(cfg);
    const b = buildWorldRequest(cfg);
    expect(a.app_id).toBe("app_test1234");
    expect(a.environment).toBe("staging");
    expect(a.rp_context.rp_id).toBe("rp_test1234");
    expect(a.rp_context.signature).toMatch(/^0x[0-9a-f]+$/i);
    expect(a.rp_context.nonce).not.toBe(b.rp_context.nonce);
    expect(a.rp_context.expires_at).toBeGreaterThan(a.rp_context.created_at);
    expect(JSON.stringify(a)).not.toContain("1111111111");
  });

  it("accepts a proof World confirms and returns its nullifier", async () => {
    const result = await verifyWorldProof(cfg, proof, answer(200, { success: true, environment: "staging" }));
    expect(result).toEqual({ nullifier: "0xabcdef", level: "proof_of_human (test)" });
  });

  it("refuses rejected proofs and proofs for another environment or action", async () => {
    await expectCode(verifyWorldProof(cfg, proof, answer(400, { success: false, code: "invalid_proof" })), "world_id_failed");
    await expectCode(verifyWorldProof(cfg, proof, answer(200, { success: true, environment: "production" })), "world_id_failed");
    await expectCode(verifyWorldProof(cfg, { ...proof, environment: "production" }, answer(200, { success: true })), "world_id_failed");
    await expectCode(verifyWorldProof(cfg, { ...proof, action: "other" }, answer(200, { success: true, environment: "staging" })), "world_id_failed");
    await expectCode(verifyWorldProof(cfg, { ...proof, responses: [] }, answer(200, { success: true, environment: "staging" })), "world_id_failed");
  });

  describe("in studies", () => {
    let researcher: User;
    let human: User;
    let second: User;

    beforeAll(async () => {
      researcher = await signInWithEmail("lab@example.org");
      human = await signInWithEmail("human@example.org");
      second = await signInWithEmail("second-account@example.org");
      await (await getEngine()).faucet(researcher.wallet, toBase(10));
    });

    it("one person cannot verify two accounts", async () => {
      await recordWorldIdCheck(human.id, "0xnull1", "proof_of_human (test)");
      await recordWorldIdCheck(human.id, "0xnull1", "proof_of_human (test)");
      await expectCode(recordWorldIdCheck(second.id, "0xnull1", "proof_of_human (test)"), "duplicate_human");
      expect((await getVerification(human.id))?.provider).toBe("world-id");
      expect((await getVerification(second.id))?.provider).toBe("email");
    });

    it("a study can require World ID", async () => {
      const draft = await createStudy(researcher, { title: "Humans only", surveyUrl: "demo", rewardUsdc: 1, maxParticipants: 2, estMinutes: 1, requireWorldId: true });
      expect(draft.minCheck).toBe("world-id");
      const study = await fundStudy(researcher, draft.id);
      await expectCode(startSubmission(second, study.id), "needs_world_id");
      const { surveyUrl } = await startSubmission(human, study.id);
      await completeSubmission(tokenOf(surveyUrl), study.completionCode);
      const rows = await listSubmissions(study.id);
      expect(rows[0]).toMatchObject({ status: "paid", humanCheck: "world-id" });
    });

    it("records a payment the chain already made instead of failing forever", async () => {
      const study = await fundStudy(researcher, (await createStudy(researcher, { title: "Lost reply", surveyUrl: "demo", rewardUsdc: 1, maxParticipants: 2, estMinutes: 1 })).id);
      const { surveyUrl } = await startSubmission(second, study.id);
      const engine = await getEngine();
      // Simulate a payout that reached the chain although the app never saw the confirmation.
      await engine.payParticipant({ studyId: study.id, chainStudyId: study.chainStudyId, researcherWallet: researcher.wallet, rewardBase: study.rewardBase, maxParticipants: 2, chainRef: study.chainRef }, payoutAddress(second));
      const result = await completeSubmission(tokenOf(surveyUrl), study.completionCode);
      expect(result.alreadyPaid).toBe(true);
      expect(await engine.balanceOf(payoutAddress(second))).toBe(toBase(1));
      expect((await listSubmissions(study.id))[0].status).toBe("paid");
    });
  });
});
