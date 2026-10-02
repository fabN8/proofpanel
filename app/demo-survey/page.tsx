import { DemoSurvey } from "@/components/DemoSurvey";
import { Card, Eyebrow, Page, heading } from "@/components/ui";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** A stand-in for an external survey tool, so the whole loop can be shown without one. */
export default async function DemoSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const studyId = first(query.study);
  const pid = first(query.pid);
  return (
    <Page width="narrow">
      <div>
        <Eyebrow>Demo survey</Eyebrow>
        <h1 className={`${heading.page} mt-2`}>Trust in AI assistants</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page plays the role of Qualtrics or another survey tool. The researcher sees your answers next to your
          wallet address, never your email.
        </p>
      </div>
      <Card className="mt-6">
        {studyId && pid ? (
          <DemoSurvey studyId={studyId} pid={pid} />
        ) : (
          <p className="text-sm text-slate-700">Open this survey from a study page so your participation can be counted.</p>
        )}
      </Card>
    </Page>
  );
}
