import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { originCheck, rateLimit, encrypt } from "@/lib/security";
import { failure, json } from "@/lib/http";
import { appleHeaders } from "@/lib/platforms/apple";
import { api } from "@/lib/platforms/request";
export async function GET() {
  try {
    const s = await requireSession(true);
    await rateLimit(`musickit:${s.id}`, 30);
    if (!process.env.APPLE_MUSIC_DEVELOPER_TOKEN)
      throw new Error("Apple Music is not configured");
    return Response.json(
      { developerToken: process.env.APPLE_MUSIC_DEVELOPER_TOKEN },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession(true);
    await rateLimit(`musickit:${s.id}`, 30);
    const v = z
      .object({
        token: z.string().min(20).max(10000),
        role: z.enum(["source", "destination"]),
      })
      .parse(await json(req));
    const token = {
      accessToken: v.token,
      expiresAt: Math.min(s.expiresAt.getTime(), Date.now() + 3600000),
      displayName: "Apple Music subscriber",
    };
    await api("https://api.music.apple.com/v1/me/storefront", {
      headers: appleHeaders(token),
    });
    await db.platformConnection.upsert({
      where: {
        sessionId_platform_role: {
          sessionId: s.id,
          platform: "apple",
          role: v.role,
        },
      },
      create: {
        sessionId: s.id,
        userId: s.userId,
        platform: "apple",
        role: v.role,
        displayName: token.displayName,
        encryptedToken: encrypt(JSON.stringify(token)),
        expiresAt: new Date(token.expiresAt),
      },
      update: {
        encryptedToken: encrypt(JSON.stringify(token)),
        expiresAt: new Date(token.expiresAt),
      },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
