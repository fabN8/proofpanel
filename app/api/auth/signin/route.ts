import { startSession } from "@/lib/auth";
import { demoSignInAllowed } from "@/lib/config";
import { handle, readJson } from "@/lib/http";
import { UserError } from "@/lib/types";
import { signInWithEmail } from "@/lib/users";

/** Demo sign-in without an email check. Switched off once Privy is configured. */
export async function POST(request: Request) {
  return handle(async () => {
    if (!demoSignInAllowed()) {
      throw new UserError("Please sign in with the email code.", "demo_signin_off", 403);
    }
    const body = await readJson(request);
    const user = await signInWithEmail(String(body.email ?? ""));
    await startSession(user.id);
    return { email: user.email, wallet: user.wallet };
  });
}
