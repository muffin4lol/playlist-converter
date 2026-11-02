import { z } from "zod";
import { requireSession } from "@/lib/auth";

import { originCheck, rateLimit } from "@/lib/security";
import { trackSchema } from "@/lib/validation";
import { failure, json } from "@/lib/http";
import { adapter } from "@/lib/platforms";
import { connectionToken } from "@/lib/platforms/connection";
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
    const token = await connectionToken(
      s.userId,
      s.id,
      v.destination,
      "destination",
    );
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
