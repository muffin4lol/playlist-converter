import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { wizardSchema } from "@/lib/validation";
import { originCheck, rateLimit } from "@/lib/security";
import { failure, json } from "@/lib/http";
import { adapter } from "@/lib/platforms";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession(true);
    await rateLimit(`convert:${s.userId}`, 25);
    const data = wizardSchema.parse(await json(req));
    adapter(data.source);
    adapter(data.destination);
    if (!data.tracks.length) throw new Error("Select a playlist first");
    if (!data.tracks.some((t) => t.selected) && data.cleanMode !== "replace")
      throw new Error("Select at least one track");
    const t = await db.transfer.create({
      data: {
        userId: s.userId,
        source: data.source,
        sourceMode: data.sourceTransport,
        destinationMode: data.destinationTransport,
        destination: data.destination,
        sourcePlaylistId: data.playlistId,
        sourceName: data.sourcePlaylistName || data.playlistName,
        destinationName: data.playlistName,
        includeExplicit: data.includeExplicit,
        cleanMode: data.cleanMode,
        total: data.tracks.length,
        tracks: {
          create: data.tracks.map((x, position) => ({
            position,
            sourceId: x.id,
            title: x.title,
            artist: x.artist,
            duration: x.duration,
            isrc: x.isrc,
            explicit: x.explicit,
            selected: x.selected,
          })),
        },
      },
    });
    return Response.json({ id: t.id });
  } catch (e) {
    return failure(e);
  }
}
