import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { engineName, privyEnabled } from "@/lib/config";
import { PrivySignOutButton } from "./PrivySignOutButton";
import { SignOutButton } from "./SignOutButton";
import { LogoMark } from "./ui";

export async function Header() {
  const user = await currentUser();
  const simulated = engineName() === "mock";
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-lg font-bold tracking-tight">ProofPanel</span>
          </Link>
          {/* Says which money is in play: nothing real in either mode. */}
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex ${
              simulated ? "border-amber-300/40 text-amber-200" : "border-emerald-300/40 text-emerald-200"
            }`}
            title={
              simulated
                ? "Simulation mode: no blockchain connected yet. Payments are simulated."
                : "Solana test network (devnet). Test money only, real transactions."
            }
          >
            <span className={`h-1.5 w-1.5 rounded-full ${simulated ? "bg-amber-300" : "bg-emerald-300"}`} />
            {simulated ? "Simulation" : "Solana devnet · test money"}
          </span>
        </div>
        <nav className="flex shrink-0 items-center gap-4 text-sm">
          <Link href="/researcher" className="font-medium text-white hover:text-lilac">
            My studies
          </Link>
          {user ? (
            <>
              <span className="hidden max-w-[14rem] truncate text-mist md:inline">{user.email}</span>
              {privyEnabled() ? <PrivySignOutButton /> : <SignOutButton />}
            </>
          ) : (
            <Link href="/signin" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-ink hover:bg-tint">
              Sign in
            </Link>
          )}
        </nav>
      </div>
      {/* On phones the pill does not fit, so the same note gets its own line. */}
      <div className={`px-4 pb-2 text-xs sm:hidden ${simulated ? "text-amber-200" : "text-emerald-200"}`}>
        {simulated ? "Simulation: payments are not real." : "Solana devnet: test money only."}
      </div>
    </header>
  );
}
