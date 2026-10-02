import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getDb, newId, num } from "@/lib/db";
import type { Row } from "@/lib/db";
import { UserError } from "@/lib/types";
import type { User, Verification } from "@/lib/types";

function toUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    wallet: String(row.wallet),
    walletSecret: row.wallet_secret ? String(row.wallet_secret) : null,
    payoutWallet: row.payout_wallet ? String(row.payout_wallet) : null,
    privyId: row.privy_id ? String(row.privy_id) : null,
    createdAt: num(row.created_at),
  };
}

export function normaliseEmail(raw: string): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    throw new UserError("Please enter a valid email address.", "bad_email");
  }
  return email;
}

/** Where a participant's reward is sent: their own wallet if they have one, otherwise the app-held one. */
export function payoutAddress(user: User): string {
  return user.payoutWallet ?? user.wallet;
}

/** Finds the account for an email or creates it, with an app-held wallet and the basic human check. */
async function findOrCreateByEmail(email: string, level: string): Promise<User> {
  const db = await getDb();
  const existing = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  let user: User;
  if (existing.length) {
    user = toUser(existing[0]);
  } else {
    const keypair = Keypair.generate();
    await db.query(
      `INSERT INTO users (id, email, wallet, wallet_secret, created_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [newId(), email, keypair.publicKey.toBase58(), bs58.encode(keypair.secretKey), Date.now()],
    );
    user = toUser((await db.query("SELECT * FROM users WHERE email = $1", [email]))[0]);
  }
  await db.query(
    `INSERT INTO verifications (id, user_id, provider, level, created_at) VALUES ($1, $2, 'email', $3, $4)
     ON CONFLICT (user_id) DO NOTHING`,
    [newId(), user.id, level, Date.now()],
  );
  return user;
}

/**
 * Demo sign-in: one account and one wallet per email address, with no check that the
 * email is real. Used while Privy is not configured, and by the test scripts.
 */
export async function signInWithEmail(rawEmail: string): Promise<User> {
  return findOrCreateByEmail(normaliseEmail(rawEmail), "basic");
}

/**
 * Sign-in through Privy: the email is verified by a one-time code, and the user holds
 * their own Solana wallet. Rewards are paid to that wallet.
 */
export async function signInWithPrivy(input: { privyId: string; email: string; wallet: string }): Promise<User> {
  const email = normaliseEmail(input.email);
  const db = await getDb();
  const byPrivy = await db.query("SELECT * FROM users WHERE privy_id = $1", [input.privyId]);
  const user = byPrivy.length ? toUser(byPrivy[0]) : await findOrCreateByEmail(email, "verified email");
  if (user.privyId && user.privyId !== input.privyId) {
    throw new UserError("This email belongs to a different sign-in.", "account_mismatch", 409);
  }
  await db.query("UPDATE users SET privy_id = $2, payout_wallet = $3 WHERE id = $1", [user.id, input.privyId, input.wallet]);
  // A verified email is stronger than the demo sign-in's unchecked one.
  await db.query("UPDATE verifications SET level = 'verified email' WHERE user_id = $1 AND provider = 'email'", [user.id]);
  return (await getUserById(user.id))!;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDb();
  const rows = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows.length ? toUser(rows[0]) : null;
}

export async function getVerification(userId: string): Promise<Verification | null> {
  const db = await getDb();
  const rows = await db.query("SELECT * FROM verifications WHERE user_id = $1", [userId]);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    userId: String(row.user_id),
    provider: String(row.provider),
    level: String(row.level),
    attestation: row.attestation ? String(row.attestation) : null,
    createdAt: num(row.created_at),
  };
}

/**
 * Records a passed World ID check. The nullifier is the same for every account one
 * person creates in this app, so a second account with the same nullifier is refused.
 */
export async function recordWorldIdCheck(userId: string, nullifier: string, level: string): Promise<void> {
  const db = await getDb();
  const taken = await db.query("SELECT user_id FROM verifications WHERE nullifier = $1", [nullifier]);
  if (taken.length && String(taken[0].user_id) !== userId) {
    throw new UserError("This World ID has already verified another account here.", "duplicate_human", 409);
  }
  await db.query(
    `INSERT INTO verifications (id, user_id, provider, level, nullifier, created_at) VALUES ($1, $2, 'world-id', $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET provider = 'world-id', level = $3, nullifier = $4, created_at = $5`,
    [newId(), userId, level, nullifier, Date.now()],
  );
}
