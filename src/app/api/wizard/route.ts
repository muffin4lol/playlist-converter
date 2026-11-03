import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { originCheck } from "@/lib/security";
import { wizardSchema } from "@/lib/validation";
import { failure, json } from "@/lib/http";
import { adapter } from "@/lib/platforms";
import {
  platformAvailability,
  publicPlaylistAvailability,
} from "@/lib/platforms/availability";
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
      state: normalizeWizard(state?.data),
      connections,
      verified: !!s.user.emailVerified,
      availability: platformAvailability(),
      publicAvailability: publicPlaylistAvailability(),
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
    if (data.transferId) {
      const transfer = await db.transfer.findFirst({
        where: { id: data.transferId, userId: s.userId },
      });
      if (!transfer) throw new Error("Transfer not found");
    }
    if (data.source) adapter(data.source);
    if (data.destination) adapter(data.destination);
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

// Discard the current draft only. Completed transfer reports and provider grants remain.
export async function DELETE(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession();
    await db.wizardState.deleteMany({ where: { userId: s.userId } });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}

function normalizeWizard(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.version === 2) return wizardSchema.safeParse(data).data || null;
  const allowed = [
    "spotify",
    "youtube",
    "apple",
    "deezer",
    "tidal",
    "soundcloud",
  ];
  const source = allowed.includes(String(data.source)) ? data.source : "";
  const destination =
    allowed.includes(String(data.destination)) && data.destination !== source
      ? data.destination
      : "";
  return (
    wizardSchema.safeParse({
      ...data,
      version: 2,
      step: 0,
      source,
      destination,
      inputMode: "account",
      playlistUrl: "",
    }).data || null
  );
}
