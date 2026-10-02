/** Central place for settings. Everything is read from environment variables. */

export const USDC_DECIMALS = 6;
export const BASE_PER_USDC = 1_000_000;
/** Circle's official test USDC on Solana devnet. */
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export type EngineName = "mock" | "vault" | "escrow";

export function engineName(): EngineName {
  const explicit = (process.env.CHAIN_ENGINE ?? "").trim().toLowerCase();
  if (explicit === "mock" || explicit === "vault" || explicit === "escrow") return explicit;
  if (!process.env.PLATFORM_SECRET_KEY) return "mock";
  return process.env.ESCROW_PROGRAM_ID ? "escrow" : "vault";
}

export function rpcUrl(): string {
  return process.env.SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";
}

export function usdcMint(): string {
  return process.env.USDC_MINT?.trim() || DEVNET_USDC_MINT;
}

export function appUrl(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || "dev-only-session-secret-change-me";
}

/** Share of the expected duration a participant must spend before being paid. */
export function minTimeFactor(): number {
  const raw = Number(process.env.MIN_TIME_FACTOR);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1 / 3;
}

/** Amount the demo faucet hands to a researcher, in USDC. */
export function faucetUsdc(): number {
  const raw = Number(process.env.FAUCET_USDC);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

export function toBase(usdc: number): number {
  return Math.round(usdc * BASE_PER_USDC);
}

export function fromBase(base: number): number {
  return base / BASE_PER_USDC;
}

export function formatUsdc(base: number): string {
  return fromBase(base).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Email login with user-held wallets is on when a Privy app id and secret are set. */
export function privyAppId(): string | null {
  return process.env.PRIVY_APP_ID?.trim() || null;
}

export function privyEnabled(): boolean {
  return Boolean(privyAppId() && process.env.PRIVY_APP_SECRET?.trim());
}

/** The demo sign-in (no email check) stays available only while Privy is off, unless explicitly allowed. */
export function demoSignInAllowed(): boolean {
  return !privyEnabled() || process.env.ALLOW_DEMO_SIGNIN === "1";
}

export interface WorldConfig {
  appId: `app_${string}`;
  rpId: string;
  signingKey: string;
  action: string;
  environment: "production" | "staging";
}

/** The World ID human check is on when app id, relying-party id and signing key are set. */
export function worldConfig(): WorldConfig | null {
  const appId = process.env.WORLD_APP_ID?.trim();
  const rpId = process.env.WORLD_RP_ID?.trim();
  const signingKey = process.env.WORLD_SIGNING_KEY?.trim();
  if (!appId || !rpId || !signingKey || !appId.startsWith("app_")) return null;
  return {
    appId: appId as `app_${string}`,
    rpId,
    signingKey,
    action: process.env.WORLD_ACTION?.trim() || "proofpanel-human-check",
    environment: process.env.WORLD_ENVIRONMENT?.trim() === "production" ? "production" : "staging",
  };
}
