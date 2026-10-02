import { startSession } from "@/lib/auth";
import { handle, readJson } from "@/lib/http";
import { verifyPrivyToken } from "@/lib/privy";
import { UserError } from "@/lib/types";
import { signInWithPrivy } from "@/lib/users";

/** Exchanges a Privy sign-in for this app's session. */
export async function POST(request: Request) {
  return handle(async () => {
    const header = request.headers.get("authorization") ?? "";
    const body = await readJson(request);
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : String(body.token ?? "");
    const identity = await verifyPrivyToken(token);
    if (!identity.wallet) {
      throw new UserError("Your wallet is still being created. One moment…", "wallet_pending", 409);
    }
    const user = await signInWithPrivy({ privyId: identity.privyId, email: identity.email, wallet: identity.wallet });
    await startSession(user.id);
    return { email: user.email, wallet: user.payoutWallet };
  });
}
