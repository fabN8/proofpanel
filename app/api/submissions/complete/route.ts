import { handle, readJson } from "@/lib/http";
import { completeSubmission } from "@/lib/studies";

// Sending a Solana transaction and waiting for confirmation can take a few seconds.
export const maxDuration = 60;

/** Called by the /done page after the survey redirects back. The token is the proof; no sign-in needed. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    return completeSubmission(String(body.t ?? ""), String(body.cc ?? ""));
  });
}
