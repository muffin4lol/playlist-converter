import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { originCheck } from "@/lib/security";
import { wizardSchema } from "@/lib/validation";
import { failure, json } from "@/lib/http";
import { adapter } from "@/lib/platforms";
import { platformAvailability } from "@/lib/platforms/availability";
export async function GET() {
  try {
    const s = await requireSession();
    const [state, connections] = await Promise.all([
      db.wizardState.findUnique({ where: { userId: s.userId } }),
      db.platformConnection.findMany({
        where: {
          sessionId: s.id,
          userId: s.userId,
          expiresAt: { gt: new Date() },
        },
        select: { platform: true, role: true, displayName: true, avatar: true },
      }),
    ]);
    return Response.json({
      state: state?.data,
      connections,
      verified: !!s.user.emailVerified,
      availability: platformAvailability(),
      youtubeTesting: process.env.GOOGLE_OAUTH_TESTING === "true",
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(req: NextRequest) {
  try {
    originCheck(req);
    const s = await requireSession(true);
    const data = wizardSchema.parse(await json(req));
    adapter(data.source);
    adapter(data.destination);
    await db.wizardState.upsert({
      where: { userId: s.userId },
      create: { userId: s.userId, data },
      update: { data },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
