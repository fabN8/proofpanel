/**
 * One-time setup: creates the platform wallet and the secrets the app needs,
 * writes them to .env.local, and tells you how to fund the wallet.
 * Safe to run again: it never overwrites existing values.
 */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const file = ".env.local";
const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

function valueOf(name: string): string | null {
  const match = existing.match(new RegExp(`^${name}=(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

const additions: string[] = [];
let secret = valueOf("PLATFORM_SECRET_KEY");
if (!secret) {
  secret = bs58.encode(Keypair.generate().secretKey);
  additions.push(`PLATFORM_SECRET_KEY=${secret}`);
}
if (!valueOf("SESSION_SECRET")) additions.push(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
if (!valueOf("SOLANA_RPC_URL")) additions.push("SOLANA_RPC_URL=https://api.devnet.solana.com");

if (additions.length) {
  const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(file, `${prefix}${additions.join("\n")}\n`);
}

const address = Keypair.fromSecretKey(bs58.decode(secret)).publicKey.toBase58();

console.log(`
${additions.length ? "Wrote new values to .env.local." : ".env.local already had everything."}

Platform wallet address:

  ${address}

This wallet pays the network fees and hands out test USDC. Fund it once:

  1. Test SOL (for fees):   https://faucet.solana.com
     Choose "devnet", paste the address above, request 1 SOL or more.

  2. Test USDC (the money): https://faucet.circle.com
     Choose "USDC" and "Solana Devnet", paste the same address.

Then run:  npm run check
`);
