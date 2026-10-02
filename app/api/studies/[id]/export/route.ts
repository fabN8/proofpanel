import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { exportCsv } from "@/lib/studies";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const csv = await exportCsv(await requireUser(), id);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="study-${id.slice(0, 8)}.csv"`,
      },
    });
  });
}
