import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { originCheck, rateLimit, decrypt } from "@/lib/security";
import { trackSchema } from "@/lib/validation";
import { failure, json } from "@/lib/http";
import { adapter } from "@/lib/platforms";
import type { Token } from "@/lib/platforms/types";
import { match } from "@/lib/matching";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession(true);
    await rateLimit(`match:${s.userId}`, 1500);
    const v = z
      .object({
        destination: z.string().max(30),
        track: trackSchema,
        clean: z.boolean(),
      })
      .parse(await json(req));
    const a = adapter(v.destination);
    if (a.mode === "csv")
      return Response.json({
        confidence: null,
        title: v.track.title,
        artist: v.track.artist,
        result: "CSV export",
      });
    const c = await db.platformConnection.findFirst({
      where: {
        userId: s.userId,
        sessionId: s.id,
        platform: v.destination,
        role: "destination",
        expiresAt: { gt: new Date() },
      },
    });
    if (!c) throw new Error("Connect destination to preview matches");
    const token = JSON.parse(decrypt(c.encryptedToken)) as Token;
    let candidates = await a.searchTrack(token, v.track, v.clean);
    if (!v.clean && v.track.isrc && !candidates.length)
      candidates = await a.searchTrack(token, { ...v.track, isrc: undefined });
    const best = match(v.track, candidates, v.clean);
    return Response.json({
      confidence: best?.confidence ?? null,
      title: best?.track.title ?? "",
      artist: best?.track.artist ?? "",
      result:
        !best || best.confidence < 0.65
          ? "Not found"
          : best.confidence < 0.85
            ? "Review match"
            : v.clean
              ? "Clean replacement"
              : "Matched",
    });
  } catch (e) {
    return failure(e);
  }
}
