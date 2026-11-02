import { db } from "@/lib/db";
import { same } from "@/lib/security";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !same(req.headers.get("authorization") || "", `Bearer ${secret}`)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.platformConnection.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.oAuthAttempt.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return Response.json({ ok: true });
}
