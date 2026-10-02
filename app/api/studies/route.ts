import { requireUser } from "@/lib/auth";
import { handle, readJson } from "@/lib/http";
import { createStudy } from "@/lib/studies";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(request);
    const study = await createStudy(user, {
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      surveyUrl: String(body.surveyUrl ?? ""),
      rewardUsdc: Number(body.rewardUsdc),
      maxParticipants: Number(body.maxParticipants),
      estMinutes: Number(body.estMinutes),
      requireWorldId: body.requireWorldId === true,
    });
    return { id: study.id };
  });
}
