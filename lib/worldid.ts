/** Server side of the World ID human check. Only used when World ID is configured. */
import { signRequest } from "@worldcoin/idkit/signing";
import type { WorldConfig } from "@/lib/config";
import { UserError } from "@/lib/types";

export interface WorldRequest {
  app_id: `app_${string}`;
  action: string;
  environment: "production" | "staging";
  rp_context: { rp_id: string; nonce: string; created_at: number; expires_at: number; signature: string };
}

/** Signs a fresh verification request. The signing key never leaves the server. */
export function buildWorldRequest(cfg: WorldConfig): WorldRequest {
  const signed = signRequest({ signingKeyHex: cfg.signingKey, action: cfg.action });
  return {
    app_id: cfg.appId,
    action: cfg.action,
    environment: cfg.environment,
    rp_context: {
      rp_id: cfg.rpId,
      nonce: signed.nonce,
      created_at: signed.createdAt,
      expires_at: signed.expiresAt,
      signature: signed.sig,
    },
  };
}

interface ProofLike {
  environment?: unknown;
  action?: unknown;
  responses?: Array<{ identifier?: unknown; nullifier?: unknown }>;
}

/**
 * Sends the proof from the browser to World's servers for verification.
 * Returns the nullifier: an id that is the same for every account one person creates in this app.
 */
export async function verifyWorldProof(
  cfg: WorldConfig,
  proof: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<{ nullifier: string; level: string }> {
  const failed = (why: string) => new UserError(`World ID verification failed: ${why}`, "world_id_failed");
  const p = (proof ?? {}) as ProofLike;
  if (p.environment !== cfg.environment) throw failed("the proof was made for a different environment.");
  if (p.action !== undefined && p.action !== cfg.action) throw failed("the proof was made for a different action.");
  const item = p.responses?.find((r) => typeof r?.nullifier === "string" && r.nullifier);
  if (!item) throw failed("the proof contains no nullifier.");

  let response: Response;
  try {
    response = await fetchImpl(`https://developer.world.org/api/v4/verify/${cfg.rpId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(proof as object), environment: cfg.environment }),
    });
  } catch {
    throw new UserError("World's verification service could not be reached. Please try again.", "world_id_unreachable", 502);
  }
  const verdict = (await response.json().catch(() => null)) as { success?: unknown; environment?: unknown; detail?: unknown; code?: unknown } | null;
  if (!response.ok || verdict?.success !== true || verdict?.environment !== cfg.environment) {
    const reason = typeof verdict?.detail === "string" ? verdict.detail : typeof verdict?.code === "string" ? verdict.code : "the proof was not accepted.";
    throw failed(reason);
  }

  const level = typeof item.identifier === "string" && item.identifier ? item.identifier : "proof_of_human";
  return { nullifier: String(item.nullifier).toLowerCase(), level: cfg.environment === "staging" ? `${level} (test)` : level };
}
