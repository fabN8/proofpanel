import { redirect } from "next/navigation";
import { NewStudyForm } from "@/components/NewStudyForm";
import { Card, Eyebrow, Page, heading } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { worldConfig } from "@/lib/config";

export default async function NewStudyPage() {
  if (!(await currentUser())) redirect("/signin?next=/researcher/new");
  return (
    <Page width="medium">
      <Eyebrow>Researcher</Eyebrow>
      <h1 className={`${heading.page} mt-2`}>New study</h1>
      <p className="mt-2 text-sm text-slate-600">Set the reward and the number of places. You lock the budget in the next step.</p>
      <Card className="mt-6">
        <NewStudyForm worldIdAvailable={Boolean(worldConfig())} />
      </Card>
    </Page>
  );
}
