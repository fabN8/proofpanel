import { requireUser } from "@/lib/auth";
import { getEngine, explorerTx } from "@/lib/chain";
import { faucetUsdc, toBase } from "@/lib/config";
import { handle } from "@/lib/http";
import { UserError } from "@/lib/types";

// Sending a Solana transaction and waiting for confirmation can take a few seconds.
export const maxDuration = 60;

/** Demo only: hands a researcher test USDC so they can fund a study. */
export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const engine = await getEngine();
    const before = await engine.balanceOf(user.wallet);
    if (before >= toBase(faucetUsdc())) {
      throw new UserError("Your wallet already holds test USDC. Spend it first.", "faucet_limit");
    }
    const tx = await engine.faucet(user.wallet, toBase(faucetUsdc()));
    return { tx, explorer: explorerTx(tx), balanceBase: await engine.balanceOf(user.wallet) };
  });
}
