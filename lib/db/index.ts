/**
 * Tiny database layer with two drivers and one SQL dialect (Postgres):
 *  - local: PGlite, a Postgres that runs inside Node and stores data in ./.data (no install, no account)
 *  - hosted: Neon serverless Postgres, used when DATABASE_URL is set (needed on Vercel)
 */

export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     wallet TEXT NOT NULL,
     wallet_secret TEXT,
     created_at BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS verifications (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
     provider TEXT NOT NULL,
     level TEXT NOT NULL,
     nullifier TEXT UNIQUE,
     attestation TEXT,
     created_at BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS studies (
     id TEXT PRIMARY KEY,
     researcher_id TEXT NOT NULL REFERENCES users(id),
     title TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     survey_url TEXT NOT NULL,
     reward_base BIGINT NOT NULL,
     max_participants INTEGER NOT NULL,
     est_minutes INTEGER NOT NULL,
     completion_code TEXT NOT NULL,
     status TEXT NOT NULL,
     chain_engine TEXT,
     chain_study_id BIGINT NOT NULL,
     chain_ref TEXT,
     fund_tx TEXT,
     close_tx TEXT,
     created_at BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS submissions (
     id TEXT PRIMARY KEY,
     study_id TEXT NOT NULL REFERENCES studies(id),
     participant_id TEXT NOT NULL REFERENCES users(id),
     token_hash TEXT NOT NULL UNIQUE,
     status TEXT NOT NULL,
     started_at BIGINT NOT NULL,
     completed_at BIGINT,
     payout_tx TEXT,
     UNIQUE (study_id, participant_id)
   )`,
  // Added after the first version; safe to run on an existing database.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS privy_id TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_wallet TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_privy_id_key ON users (privy_id)`,
  `ALTER TABLE studies ADD COLUMN IF NOT EXISTS min_check TEXT NOT NULL DEFAULT 'basic'`,
  // Answers to the built-in survey, as JSON text. External survey tools keep their own answers.
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS answers TEXT`,
  `CREATE TABLE IF NOT EXISTS mock_balances (
     account TEXT PRIMARY KEY,
     amount BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS mock_receipts (
     study_ref TEXT NOT NULL,
     wallet TEXT NOT NULL,
     PRIMARY KEY (study_ref, wallet)
   )`,
];

async function openPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR?.trim() || "./.data/pglite";
  let pg;
  if (dir === "memory") {
    pg = new PGlite();
  } else {
    const fs = await import("node:fs");
    fs.mkdirSync(dir, { recursive: true });
    pg = new PGlite(dir);
  }
  return {
    async query<T = Row>(sql: string, params: unknown[] = []) {
      const res = await pg.query(sql, params);
      return res.rows as T[];
    },
  };
}

async function openNeon(url: string): Promise<Db> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  return {
    async query<T = Row>(text: string, params: unknown[] = []) {
      const rows = await sql.query(text, params);
      return rows as T[];
    },
  };
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url && process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. On Vercel the app needs a hosted Postgres database (see README, Deploy).");
  }
  const db = url ? await openNeon(url) : await openPglite();
  for (const statement of SCHEMA) await db.query(statement);
  return db;
}

// One connection per process, also across hot reloads in development.
const holder = globalThis as unknown as { __proofpanelDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!holder.__proofpanelDb) {
    holder.__proofpanelDb = open().catch((err) => {
      holder.__proofpanelDb = undefined;
      throw err;
    });
  }
  return holder.__proofpanelDb;
}

/** Only for tests: forget the connection so the next call opens a fresh database. */
export function resetDbForTests(): void {
  holder.__proofpanelDb = undefined;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function num(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}
