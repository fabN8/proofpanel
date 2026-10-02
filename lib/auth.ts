/** Session handling: a signed cookie that carries the user id. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/config";
import { UserError } from "@/lib/types";
import type { User } from "@/lib/types";
import { getUserById } from "@/lib/users";

const COOKIE = "pp_session";

function sign(userId: string): string {
  return createHmac("sha256", sessionSecret()).update(userId).digest("base64url");
}

export function sessionValue(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function readSessionValue(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(userId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

export async function startSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  const userId = readSessionValue(store.get(COOKIE)?.value);
  return userId ? getUserById(userId) : null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new UserError("Please sign in first.", "signed_out", 401);
  return user;
}
