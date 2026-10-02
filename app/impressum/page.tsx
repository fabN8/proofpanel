import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, OperatorAddress } from "@/components/Legal";
import { Card, Eyebrow, Page, heading } from "@/components/ui";
import { legalUpdated, operator } from "@/lib/legal";

export const metadata: Metadata = { title: "Impressum · ProofPanel" };

export default function ImpressumPage() {
  return (
    <Page width="medium">
      <Eyebrow>Legal</Eyebrow>
      <h1 className={`${heading.page} mt-2`}>Impressum</h1>
      <p className="mt-2 text-sm text-slate-600">Legal notice. Angaben gemäß § 5 DDG.</p>

      <Card className="mt-6 space-y-8 sm:p-8">
        <LegalSection title="Operator of this website">
          <OperatorAddress />
        </LegalSection>

        <LegalSection title="About this website">
          <p>
            ProofPanel is a non-commercial prototype built for a hackathon. It runs on the Solana test network (devnet) with test
            money only. No real payments are made and nothing is sold here.
          </p>
          <p>This is a personal project of {operator.name}. It is not an offering of WHU – Otto Beisheim School of Management.</p>
        </LegalSection>

        <LegalSection title="Liability">
          <p>
            The prototype is provided as it is, without any guarantee that it is available, complete or free of errors. Links to
            other websites were checked when they were added; their operators are responsible for their content.
          </p>
        </LegalSection>

        <LegalSection title="Your data">
          <p>
            How personal data is handled is explained in the{" "}
            <Link className="text-indigo-700 hover:underline" href="/privacy">
              privacy notice
            </Link>
            .
          </p>
        </LegalSection>

        <p className="text-xs text-slate-500">Last updated: {legalUpdated}</p>
      </Card>
    </Page>
  );
}
