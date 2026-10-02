import type { Metadata } from "next";
import { LegalSection, OperatorAddress } from "@/components/Legal";
import { Card, Eyebrow, Page, heading } from "@/components/ui";
import { engineName, privyEnabled, rpcUrl, worldConfig } from "@/lib/config";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy notice · ProofPanel" };

/** The host name of the Solana endpoint in use, without any key that may be part of its address. */
function endpointHost(): string {
  try {
    return new URL(rpcUrl()).host;
  } catch {
    return "a Solana network endpoint";
  }
}

/**
 * The privacy notice (Art. 13 GDPR). The parts about outside services are shown only
 * when that service is switched on, so the page describes this installation as it runs.
 */
export default function PrivacyPage() {
  const usesPrivy = privyEnabled();
  const usesWorldId = Boolean(worldConfig());
  const onChain = engineName() !== "mock";
  const hostedOnVercel = Boolean(process.env.VERCEL);
  const usesNeon = Boolean(process.env.DATABASE_URL);

  return (
    <Page width="medium">
      <Eyebrow>Legal</Eyebrow>
      <h1 className={`${heading.page} mt-2`}>Privacy notice</h1>
      <p className="mt-2 text-sm text-slate-600">
        What this prototype does with personal data, in plain words. Information under Art. 13 of the General Data Protection
        Regulation (GDPR).
      </p>

      <Card className="mt-6 space-y-8 sm:p-8">
        <LegalSection title="Who is responsible">
          <OperatorAddress />
          <p>
            ProofPanel is a hackathon prototype. It runs on a test network with test money. Please do not enter sensitive personal
            information, for example in free-text survey answers.
          </p>
        </LegalSection>

        <LegalSection title="What is processed, and why">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Sign-in:</b> your email address, so that you have one account.{" "}
              {usesPrivy
                ? "Sign-in is handled by Privy, which sends you a one-time code and creates a Solana wallet that only you control. We store your email address, your Privy user number and the public address of that wallet."
                : "We store your email address and create a test wallet for you that the app controls."}
            </li>
            <li>
              <b>Wallet address:</b> the public address your rewards are paid to. Researchers get a second test wallet that the app
              controls, to fund their studies with test money.
            </li>
            <li>
              <b>Human check:</b> that you passed a check, and at which level.{" "}
              {usesWorldId
                ? "If you verify with World ID, we receive a proof and a pseudonymous code that is unique to you for this site. It shows that one person has only one verified account here. We receive no image, name or document."
                : ""}
            </li>
            <li>
              <b>Taking part in a study:</b> which study you started and finished, when, and the payout transaction. If the study
              uses the built-in survey, your answers are stored too.
            </li>
            <li>
              <b>Running a study:</b> the title, description, reward and settings you enter.
            </li>
            <li>
              <b>Technical data:</b> when you open a page, the hosting provider processes your IP address, the time and the page
              requested, to deliver the site and keep it secure.
            </li>
          </ul>
          <p>
            Legal bases: providing the service you ask for when you sign in, take part or run a study (Art. 6(1)(b) GDPR), and our
            legitimate interest in a secure site and in stopping one person from taking part several times (Art. 6(1)(f) GDPR).
          </p>
          <p>You are not obliged to provide any data. Without an email address you cannot sign in or take part.</p>
        </LegalSection>

        <LegalSection title="What researchers see">
          <p>
            The researcher who runs a study sees, for each participant: the wallet address, the level of the human check, start
            and finish time, the payout transaction and, for the built-in survey, the answers. Researchers do not see your email
            address.
          </p>
        </LegalSection>

        {onChain ? (
          <LegalSection title="Payments on a public blockchain">
            <p>
              Funding, payouts and refunds are transactions on the Solana test network (devnet). Each one publicly shows the
              wallet addresses involved, the amount and the time. A blockchain is a permanent public record: these entries cannot
              be changed or deleted by us. They contain no name and no email address.
            </p>
          </LegalSection>
        ) : null}

        <LegalSection title="Services that process data for this site">
          <ul className="list-disc space-y-2 pl-5">
            {hostedOnVercel ? (
              <li>
                <b>Vercel</b> (hosting, USA): serves the website and processes the technical data named above.
              </li>
            ) : null}
            {usesNeon ? (
              <li>
                <b>Neon</b> (database hosting): stores the account, study and participation data.
              </li>
            ) : null}
            {usesPrivy ? (
              <li>
                <b>Privy</b> (sign-in and wallets, USA): receives your email address to send the one-time code, and manages your
                wallet.
              </li>
            ) : null}
            {usesWorldId ? (
              <li>
                <b>World ID</b> (human check): checks the proof you create in the World App. This only happens if you start that
                check.
              </li>
            ) : null}
            {onChain ? (
              <li>
                <b>Solana network endpoint</b> ({endpointHost()}): receives the transactions, which contain wallet addresses and
                amounts.
              </li>
            ) : null}
          </ul>
          <p>
            Some of these providers are based in the USA or process data there. They do so under the data protection terms they
            offer their customers.
          </p>
        </LegalSection>

        <LegalSection title="Cookies and browser storage">
          <p>
            The site sets one cookie, <code>pp_session</code>, that keeps you signed in for up to 30 days.{" "}
            {usesPrivy ? "Privy stores its own sign-in state in your browser for the same purpose. " : ""}
            These are needed for the site to work. There are no advertising or analytics cookies and no tracking.
          </p>
        </LegalSection>

        <LegalSection title="How long data is kept">
          <p>
            The data stays in the database for as long as the prototype is online and is deleted when it is taken offline. You can
            ask for your account and its data to be deleted earlier at any time by email. Entries on the blockchain cannot be
            deleted.
          </p>
        </LegalSection>

        <LegalSection title="Your rights">
          <p>
            You have the right to be told which data about you is stored, to have it corrected or deleted, to have its use
            restricted, to receive it in a common format, and to object to its use. To use any of these rights, write to the email
            address above.
          </p>
          <p>
            You can also complain to a data protection authority. The one responsible for this site is the State Commissioner for
            Data Protection and Freedom of Information of Rhineland-Palatinate (Der Landesbeauftragte für den Datenschutz und die
            Informationsfreiheit Rheinland-Pfalz).
          </p>
          <p>No decisions are made about you by profiling.</p>
        </LegalSection>

        <p className="text-xs text-slate-500">Last updated: {legalUpdated}</p>
      </Card>
    </Page>
  );
}
