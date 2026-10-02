import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { fundStudy } from "@/lib/studies";

// Sending a Solana transaction and waiting for confirmation can take a few seconds.
export const maxDuration = 60;

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const study = await fundStudy(await requireUser(), id);
    return { id: study.id, status: study.status, tx: study.fundTx };
  });
}
