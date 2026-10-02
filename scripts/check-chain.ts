/**
 * Milestone 1, "money moves": checks the platform wallet and sends 1 test USDC
 * to a brand-new wallet on Solana devnet. Run this before starting the app in live mode.
 */
import "./load-env";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { explorerAddress, explorerTx } from "@/lib/chain/types";
import { connection, platformKeypair, rpc, send, tokenAccountBalance, tokenAccountOf } from "@/lib/chain/solana";
import { buildFaucet } from "@/lib/chain/vault";
import { formatUsdc, rpcUrl, toBase, usdcMint } from "@/lib/config";

async function main() {
  if (!process.env.PLATFORM_SECRET_KEY) {
    console.log("No platform wallet yet. Run `npm run setup` first.");
    process.exit(1);
  }
  const platform = platformKeypair();
  const address = platform.publicKey.toBase58();
  // Only the host is shown: a private endpoint address contains its key.
  console.log(`Network endpoint: ${new URL(rpcUrl()).host}`);
  console.log(`USDC token:       ${usdcMint()}`);
  console.log(`Platform wallet:  ${address}`);

  const lamports = await rpc(() => connection().getBalance(platform.publicKey));
  const usdc = await tokenAccountBalance(tokenAccountOf(platform.publicKey));
  console.log(`  SOL balance:    ${(lamports / LAMPORTS_PER_SOL).toFixed(4)}`);
  console.log(`  USDC balance:   ${formatUsdc(usdc)}`);

  const problems: string[] = [];
  if (lamports < 0.05 * LAMPORTS_PER_SOL) problems.push("Not enough test SOL. Get some at https://faucet.solana.com (devnet).");
  if (usdc < toBase(1)) problems.push('Not enough test USDC. Get some at https://faucet.circle.com (USDC, "Solana Devnet").');
  if (problems.length) {
    console.log(`\nFund this address first: ${address}`);
    problems.forEach((p) => console.log(`  - ${p}`));
    process.exit(1);
  }

  const recipient = Keypair.generate().publicKey;
  console.log(`\nSending 1.00 test USDC to a new wallet ${recipient.toBase58()} ...`);
  const started = Date.now();
  const signature = await send(buildFaucet(platform.publicKey, recipient, toBase(1)));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const received = await tokenAccountBalance(tokenAccountOf(recipient));

  console.log(`Done in ${seconds} s. The new wallet now holds ${formatUsdc(received)} USDC.`);
  console.log(`Transaction: ${explorerTx(signature)}`);
  console.log(`Wallet:      ${explorerAddress(recipient.toBase58())}`);
  console.log("\nMoney moves. You can now start the app with `npm run dev`; it will use the live engine.");
}

main().catch((err) => {
  console.error("\nThe check failed:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
