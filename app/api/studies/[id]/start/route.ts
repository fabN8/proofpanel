import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { startSubmission } from "@/lib/studies";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    return startSubmission(await requireUser(), id);
  });
}
