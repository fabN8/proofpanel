import { endSession } from "@/lib/auth";
import { handle } from "@/lib/http";

export async function POST() {
  return handle(async () => {
    await endSession();
    return { ok: true };
  });
}
