import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { LogoMark } from "@/components/ui";
import { privyAppId, privyEnabled } from "@/lib/config";
import "./globals.css";

// Both typefaces are bundled with the app (see app/fonts/README.txt), so no font service is contacted.
const headingFont = localFont({
  src: "./fonts/SpaceGrotesk-latin.woff2",
  weight: "300 700",
  variable: "--font-heading",
  display: "swap",
});
const textFont = localFont({
  src: "./fonts/PublicSans-latin.woff2",
  weight: "100 900",
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProofPanel: pay verified humans for research, instantly",
  description: "Researchers lock a study budget on Solana. Verified participants are paid in USDC seconds after they finish.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${headingFont.variable} ${textFont.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers privyAppId={privyEnabled() ? privyAppId() : null}>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="bg-ink text-mist">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-2">
                <LogoMark className="h-6 w-6" />
                <span className="font-display text-base font-semibold text-white">ProofPanel</span>
              </div>
              <div className="flex flex-col gap-2 text-sm sm:items-end">
                <p>Hackathon prototype. Test network and test money only.</p>
                <nav className="flex gap-5" aria-label="Legal">
                  <Link href="/impressum" className="text-white underline-offset-2 hover:underline">
                    Impressum
                  </Link>
                  <Link href="/privacy" className="text-white underline-offset-2 hover:underline">
                    Privacy notice
                  </Link>
                </nav>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
