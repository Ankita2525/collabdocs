import { cookies } from "next/headers";
import { repo, type User } from "@/lib/repo";
import { errors } from "@/lib/errors";

export const SESSION_COOKIE = "collabdocs_session";
const TTL_HOURS = 24 * 7;

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await repo().createSession(userId, TTL_HOURS);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await repo().deleteSession(token);
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return repo().getUserBySession(token);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthenticated();
  return user;
}
