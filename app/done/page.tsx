import { DoneClient } from "@/components/DoneClient";
import { Card, Page } from "@/components/ui";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Survey tools redirect here when a participant finishes. */
export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const token = first(query.t);
  const code = first(query.cc);
  return (
    <Page width="narrow">
      <Card className="sm:p-8">
        {token && code ? (
          <DoneClient token={token} code={code} />
        ) : (
          <p className="text-sm text-slate-700">This link is incomplete. Please return to the survey and finish it.</p>
        )}
      </Card>
    </Page>
  );
}
