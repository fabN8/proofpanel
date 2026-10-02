/** Shared helpers for the two real engines (vault and escrow). Server-side only. */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  AccountLayout,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import { rpcUrl, usdcMint, USDC_DECIMALS } from "@/lib/config";
import { UserError } from "@/lib/types";
import { explorerTx, type SignerWallet } from "./types";

export function parseSecretKey(raw: string): Keypair {
  const text = raw.trim();
  try {
    if (text.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(text)));
    return Keypair.fromSecretKey(bs58.decode(text));
  } catch {
    throw new Error("A secret key could not be read. Expected base58 text or a JSON array of 64 numbers.");
  }
}

export function platformKeypair(): Keypair {
  const raw = process.env.PLATFORM_SECRET_KEY;
  if (!raw) throw new Error("PLATFORM_SECRET_KEY is not set. Run `npm run setup` first.");
  return parseSecretKey(raw);
}

export function signerOf(wallet: SignerWallet): Keypair {
  if (!wallet.secret) {
    throw new UserError("This wallet cannot be signed for by the app.", "no_signer");
  }
  const keypair = parseSecretKey(wallet.secret);
  if (keypair.publicKey.toBase58() !== wallet.address) {
    throw new Error("Wallet address and stored key do not match.");
  }
  return keypair;
}

let cachedConnection: Connection | null = null;
export function connection(): Connection {
  if (!cachedConnection) {
    // The library's own retry on "429 Too Many Requests" gives up after 7.5 seconds.
    // It is switched off here because `rpc()` below waits longer and in one place.
    cachedConnection = new Connection(rpcUrl(), { commitment: "confirmed", disableRetryOnRateLimit: true });
  }
  return cachedConnection;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The network processed the transaction and rejected it, or it can no longer land. Never retried. */
export class TransactionFailed extends Error {}

/** True when the endpoint refused the request because of its rate limit (HTTP 429). */
export function isRateLimited(err: unknown): boolean {
  if (err instanceof TransactionFailed) return false;
  const message = messageOf(err);
  return /^429\b/.test(message) || /too many requests/i.test(message);
}

/** True for problems that usually go away by themselves: rate limits and short network hiccups. */
export function isTemporary(err: unknown): boolean {
  if (err instanceof TransactionFailed) return false;
  if (isRateLimited(err)) return true;
  const cause = (err as { cause?: unknown })?.cause;
  const text = `${messageOf(err)} ${cause ? messageOf(cause) : ""}`;
  return /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|^50[234]\b|bad gateway|service unavailable|gateway time-?out/i.test(text);
}

/** How long to wait before asking again after a temporary failure: 31 seconds in total. */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 6_000, 8_000, 10_000];

/**
 * Runs one request to the Solana endpoint and patiently repeats it when the endpoint
 * is rate-limiting or briefly unreachable. Every request in this app goes through here.
 */
export async function rpc<T>(call: () => Promise<T>, delaysMs: number[] = RETRY_DELAYS_MS): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (err) {
      if (!isTemporary(err) || attempt >= delaysMs.length) throw err;
      if (attempt === 0 && isRateLimited(err)) {
        console.warn("  (the Solana endpoint is rate-limiting requests; waiting and trying again)");
      }
      await sleep(delaysMs[attempt]);
    }
  }
}

export const mint = () => new PublicKey(usdcMint());

/** The standard USDC account address of a wallet. `offCurve` must be true for program-owned wallets. */
export function tokenAccountOf(owner: PublicKey, offCurve = false): PublicKey {
  return getAssociatedTokenAddressSync(mint(), owner, offCurve);
}

/** Instruction that creates a wallet's USDC account if it does not exist yet (the platform pays). */
export function ensureTokenAccountIx(payer: PublicKey, owner: PublicKey): TransactionInstruction {
  return createAssociatedTokenAccountIdempotentInstruction(payer, tokenAccountOf(owner), owner, mint());
}

export function transferIx(from: PublicKey, to: PublicKey, authority: PublicKey, amountBase: number) {
  return createTransferCheckedInstruction(from, mint(), to, authority, BigInt(amountBase), USDC_DECIMALS);
}

/** Balance of a token account in base units; 0 when the account does not exist. */
export async function tokenAccountBalance(account: PublicKey): Promise<number> {
  const info = await rpc(() => connection().getAccountInfo(account, "confirmed"));
  if (!info || info.data.length < AccountLayout.span) return 0;
  return Number(AccountLayout.decode(info.data).amount);
}

/**
 * Builds, signs and sends a transaction, then waits until the network confirms it.
 * The platform wallet always pays the network fee.
 *
 * Confirmation is checked by asking for the transaction's status every second or two.
 * This needs no websocket connection, so it also works on serverless hosting.
 *
 * Rate limits (HTTP 429) never turn a sent transaction into a reported failure:
 * before sending, requests are repeated with growing pauses; after sending, the
 * status check simply keeps waiting.
 */
export async function send(instructions: TransactionInstruction[], extraSigners: Keypair[] = []): Promise<string> {
  const platform = platformKeypair();
  const conn = connection();
  const tx = new Transaction().add(...instructions);
  tx.feePayer = platform.publicKey;
  const signers = uniqueSigners([platform, ...extraSigners]);
  try {
    const { blockhash, lastValidBlockHeight } = await rpc(() => conn.getLatestBlockhash("confirmed"));
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.sign(...signers);
    // The signature is known as soon as the transaction is signed, so it can be
    // tracked even if the reply to the send request gets lost.
    const signature = bs58.encode(tx.signature!);
    const delivery = await submit(conn, tx.serialize());
    if (delivery === "refused") throw new RateLimited();
    await waitForConfirmation(conn, signature, lastValidBlockHeight);
    return signature;
  } catch (err) {
    throw describeChainError(err);
  }
}

class RateLimited extends Error {
  constructor() {
    super("429 Too Many Requests");
  }
}

type Sender = Pick<Connection, "sendRawTransaction">;

/**
 * Hands the signed transaction to the network. Sending the same signed transaction
 * again is harmless (the network accepts a signature only once), so it is safe to repeat.
 *
 * Returns "refused" only when every attempt was turned away by the rate limit, which
 * means the transaction certainly did not go out. If an attempt failed in a way that
 * leaves this open (a dropped connection), the result is "sent" and the confirmation
 * check that follows gives the definite answer.
 */
export async function submit(conn: Sender, raw: Buffer | Uint8Array, delaysMs?: number[]): Promise<"sent" | "refused"> {
  let mayHaveGoneOut = false;
  try {
    await rpc(async () => {
      try {
        await conn.sendRawTransaction(raw, { preflightCommitment: "confirmed", maxRetries: 3 });
      } catch (err) {
        // An earlier attempt got through although its reply was lost.
        if (mayHaveGoneOut && /already been processed/i.test(messageOf(err))) return;
        if (isTemporary(err) && !isRateLimited(err)) mayHaveGoneOut = true;
        throw err;
      }
    }, delaysMs);
    return "sent";
  } catch (err) {
    if (!isTemporary(err)) throw err;
    return mayHaveGoneOut ? "sent" : "refused";
  }
}

type StatusReader = Pick<Connection, "getSignatureStatuses" | "getBlockHeight">;

/**
 * Resolves when the transaction is confirmed; throws if it failed or can no longer land.
 * A rate-limited or failed status request is not an answer, so the loop waits longer and asks again.
 */
export async function waitForConfirmation(
  conn: StatusReader,
  signature: string,
  lastValidBlockHeight: number,
  options: { intervalMs?: number; maxIntervalMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const firstDelay = options.intervalMs ?? 1_000;
  const normalMax = options.maxIntervalMs ?? 3_000;
  const backoffMax = normalMax * 3;
  const deadline = Date.now() + (options.timeoutMs ?? 90_000);

  const confirmed = async (): Promise<boolean> => {
    const status = (await conn.getSignatureStatuses([signature])).value[0];
    if (status?.err) {
      throw new TransactionFailed(`The transaction was rejected by the network: ${JSON.stringify(status.err)}`);
    }
    return status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized";
  };

  let delay = firstDelay;
  for (let attempt = 1; ; attempt += 1) {
    await sleep(delay);
    try {
      if (await confirmed()) return;
      // Every few checks, see whether the transaction has expired without landing.
      if (attempt % 4 === 0 && (await conn.getBlockHeight("confirmed")) > lastValidBlockHeight) {
        if (await confirmed()) return;
        throw new TransactionFailed("The transaction expired before the network confirmed it. Nothing was paid; please try again.");
      }
      delay = Math.min(Math.ceil(delay * 1.5), normalMax);
    } catch (err) {
      if (!isTemporary(err)) throw err;
      delay = Math.min(delay * 2, backoffMax);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `The network did not confirm the transaction in time, so the outcome is unknown. Check it before retrying: ${explorerTx(signature) ?? signature}`,
      );
    }
  }
}

export function uniqueSigners(signers: Keypair[]): Keypair[] {
  const seen = new Set<string>();
  return signers.filter((s) => {
    const key = s.publicKey.toBase58();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function describeChainError(err: unknown): Error {
  const anyErr = err as { message?: string; logs?: string[]; transactionLogs?: string[] };
  const logs = anyErr?.logs ?? anyErr?.transactionLogs ?? [];
  const message = anyErr?.message ?? String(err);
  if (err instanceof TransactionFailed) return err;
  if (isRateLimited(err)) {
    return new UserError(
      "The Solana endpoint is refusing requests because of its rate limit. Nothing was sent. Wait a minute and try again, or set SOLANA_RPC_URL to your own free endpoint (see README, Troubleshooting).",
      "rate_limited",
      503,
    );
  }
  if (/insufficient funds/i.test(message) || logs.some((l) => /insufficient funds/i.test(l))) {
    return new UserError("Not enough test USDC (or the platform wallet is out of SOL for fees).", "insufficient_funds");
  }
  if (logs.some((l) => /already in use/i.test(l))) {
    return new UserError("This wallet was already paid for this study.", "already_paid");
  }
  const tail = logs.slice(-6).join(" | ");
  return new Error(`Solana transaction failed: ${message}${tail ? ` | logs: ${tail}` : ""}`);
}
