import { requireUser } from "@/lib/auth";
import { worldConfig } from "@/lib/config";
import { handle, readJson } from "@/lib/http";
import { UserError } from "@/lib/types";
import { recordWorldIdCheck } from "@/lib/users";
import { verifyWorldProof } from "@/lib/worldid";

/** Step 2 of the World ID check: verify the proof with World and remember that this user is a unique human. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const cfg = worldConfig();
    if (!cfg) throw new UserError("World ID is not set up for this app.", "world_id_off");
    const body = await readJson(request);
    const { nullifier, level } = await verifyWorldProof(cfg, body.result);
    await recordWorldIdCheck(user.id, nullifier, level);
    return { ok: true, level };
  });
}
