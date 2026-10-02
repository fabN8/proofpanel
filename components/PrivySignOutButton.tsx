"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

export function PrivySignOutButton() {
  const router = useRouter();
  const { logout } = usePrivy();
  return (
    <button
      type="button"
      className="text-sm text-mist underline-offset-2 hover:text-white hover:underline"
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        await logout().catch(() => undefined);
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
