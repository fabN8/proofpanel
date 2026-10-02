import { requireUser } from "@/lib/auth";
import { worldConfig } from "@/lib/config";
import { handle } from "@/lib/http";
import { UserError } from "@/lib/types";
import { buildWorldRequest } from "@/lib/worldid";

/** Step 1 of the World ID check: the server signs a verification request for the browser widget. */
export async function POST() {
  return handle(async () => {
    await requireUser();
    const cfg = worldConfig();
    if (!cfg) throw new UserError("World ID is not set up for this app.", "world_id_off");
    return buildWorldRequest(cfg);
  });
}
