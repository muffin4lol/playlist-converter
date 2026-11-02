import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { wizardSchema } from "@/lib/validation";
import { originCheck, rateLimit } from "@/lib/security";
import { failure, json } from "@/lib/http";
import { adapter } from "@/lib/platforms";
import { connectionToken } from "@/lib/platforms/connection";
import { platformAvailability } from "@/lib/platforms/availability";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession(true);
    await rateLimit(`convert:${s.userId}`, 25);
    const data = wizardSchema.parse(await json(req));
    if (!data.source || !data.destination || data.source === data.destination)
      throw new Error("Select different source and destination platforms");
    if (!platformAvailability()[data.destination])
      throw new Error(
        "Destination is not configured for direct playlist creation",
      );
    adapter(data.source);
    adapter(data.destination);
    await connectionToken(s.userId, s.id, data.destination, "destination");
    if (!data.tracks.length) throw new Error("Select a playlist first");
    if (!data.tracks.some((t) => t.selected) && data.cleanMode !== "replace")
      throw new Error("Select at least one track");
    const t = await db.transfer.create({
      data: {
        userId: s.userId,
        source: data.source,
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
            album: x.album,
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
