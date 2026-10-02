import { redirect } from "next/navigation";
import { PrivySignIn } from "@/components/PrivySignIn";
import { SignInForm } from "@/components/SignInForm";
import { Card, LogoMark, Page, heading } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { privyEnabled } from "@/lib/config";

function safeNext(raw: string | string[] | undefined): string {
  const next = Array.isArray(raw) ? raw[0] : raw;
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/researcher";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return (
    <Page width="slim">
      <Card className="sm:p-8">
        <LogoMark className="h-10 w-10" />
        <h1 className={`${heading.page} mt-4 sm:text-3xl`}>Sign in</h1>
        <p className="mb-6 mt-2 text-sm text-slate-600">One email, one account, one wallet.</p>
        {privyEnabled() ? <PrivySignIn next={next} /> : <SignInForm next={next} />}
      </Card>
    </Page>
  );
}
