/** Server-side check of a Privy sign-in. Only loaded when Privy is configured. */
import { privyAppId } from "@/lib/config";
import { UserError } from "@/lib/types";

export interface PrivyIdentity {
  privyId: string;
  /** Verified by Privy with a one-time code. */
  email: string;
  /** The user's own Solana wallet created by Privy; null while it is still being created. */
  wallet: string | null;
}

type LinkedAccount = { type: string } & Record<string, unknown>;

/** Picks the verified email and the embedded Solana wallet out of a Privy user's linked accounts. */
export function identityFrom(privyId: string, accounts: LinkedAccount[]): PrivyIdentity {
  const email = accounts.find((a) => a.type === "email" && typeof a.address === "string");
  if (!email) throw new UserError("This sign-in has no verified email address.", "no_email");
  const wallet = accounts.find(
    (a) => a.type === "wallet" && a.chain_type === "solana" && a.connector_type === "embedded" && typeof a.address === "string",
  );
  return { privyId, email: String(email.address), wallet: wallet ? String(wallet.address) : null };
}

/** Verifies the access token the browser received from Privy and loads the user's details. */
export async function verifyPrivyToken(accessToken: string): Promise<PrivyIdentity> {
  const appId = privyAppId();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new UserError("Email login is not set up on this server.", "privy_off");
  if (!accessToken) throw new UserError("Please sign in again.", "bad_token", 401);

  const { PrivyClient } = await import("@privy-io/node");
  const client = new PrivyClient({ appId, appSecret });

  let userId: string;
  try {
    userId = (await client.utils().auth().verifyAccessToken(accessToken)).user_id;
  } catch {
    throw new UserError("Your sign-in could not be verified. Please sign in again.", "bad_token", 401);
  }
  const user = await client.users()._get(userId);
  return identityFrom(userId, user.linked_accounts as unknown as LinkedAccount[]);
}
