import { handle, readJson } from "@/lib/http";
import { demoSurveyRedirect } from "@/lib/studies";

/** Stands in for an external survey tool: stores the answers, then returns the end-of-survey redirect. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    return { redirect: await demoSurveyRedirect(String(body.studyId ?? ""), String(body.pid ?? ""), body.answers) };
  });
}
