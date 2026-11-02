import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { digest, randomToken } from "./security";
export const COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-pc_session" : "pc_session";
export async function session() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return db.session.findFirst({
    where: { id: digest(token), expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}
export async function requireSession(verified = false) {
  const s = await session();
  if (!s) throw new Error("Unauthorized");
  if (verified && !s.user.emailVerified)
    throw new Error("Verify your email before converting");
  return s;
}
export async function requirePage() {
  const s = await session();
  if (!s) redirect("/login");
  return s;
}
export async function createSession(userId: string) {
  const token = randomToken();
  await db.session.create({
    data: {
      id: digest(token),
      userId,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
}
export const ownerWhere = (userId: string, id?: string) => ({
  userId,
  ...(id ? { id } : {}),
});
