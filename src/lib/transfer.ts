import { db } from "./db";
import { adapter } from "./platforms";
import { decrypt } from "./security";
import { match } from "./matching";
import type { Track, Token } from "./platforms/types";
// One track per request keeps jobs inside serverless limits. A database lease prevents concurrent ticks.
export async function tick(userId: string, sessionId: string, id: string) {
  const cutoff = new Date(Date.now() - 120000);
  const lease = await db.transfer.updateMany({
    where: {
      id,
      userId,
      OR: [
        { status: "pending" },
        { status: "processing", updatedAt: { lt: cutoff } },
      ],
    },
    data: { status: "processing" },
  });
  if (!lease.count) return;
  try {
    const t = await db.transfer.findFirstOrThrow({
      where: { id, userId },
      include: { tracks: { orderBy: { position: "asc" } } },
    });
    const a = adapter(t.destination);
    const csv = a.mode === "csv" || t.destinationMode === "csv";
    const c = csv
      ? null
      : await db.platformConnection.findFirst({
          where: {
            userId,
            sessionId,
            platform: t.destination,
            role: "destination",
            expiresAt: { gt: new Date() },
          },
        });
    if (!csv && !c) throw new Error("Reconnect destination account");
    const token = c ? (JSON.parse(decrypt(c.encryptedToken)) as Token) : null;
    let destinationId = t.destinationId;
    if (!csv && !destinationId) {
      // Record the intent first. A crash after remote creation must never silently create a second playlist.
      await db.transfer.update({
        where: { id },
        data: { destinationId: "__creation_pending__" },
      });
      const p = await a.createPlaylist(token!, t.destinationName);
      destinationId = p.id;
      await db.transfer.update({
        where: { id },
        data: { destinationId: p.id, destinationUrl: p.url },
      });
    }
    if (destinationId === "__creation_pending__")
      throw new Error(
        "Playlist creation interrupted; inspect destination before rerunning",
      );
    const row = t.tracks.find((x) => x.result === "pending");
    if (row) {
      const source: Track = {
        id: row.sourceId,
        title: row.title,
        artist: row.artist,
        duration: row.duration,
        isrc: row.isrc ?? undefined,
        explicit: row.explicit,
        selected: row.selected,
      };
      const replace =
        !t.includeExplicit &&
        row.explicit === true &&
        t.cleanMode === "replace" &&
        !row.selected;
      if (!row.selected && !replace)
        await db.transferTrack.update({
          where: { id: row.id },
          data: {
            result:
              row.explicit === true && !t.includeExplicit
                ? "explicit_excluded"
                : "skipped",
          },
        });
      else if (csv)
        await db.transferTrack.update({
          where: { id: row.id },
          data: {
            result: replace ? "explicit_excluded" : "exported",
            confidence: null,
          },
        });
      else {
        let candidates = await a.searchTrack(token!, source, replace);
        if (!replace && source.isrc && !candidates.length)
          candidates = await a.searchTrack(token!, {
            ...source,
            isrc: undefined,
          });
        const best = match(source, candidates, replace);
        if (!best || best.confidence < 0.65)
          await db.transferTrack.update({
            where: { id: row.id },
            data: { result: "not_found", confidence: best?.confidence },
          });
        else {
          // Persist "adding" before external writes; ambiguous failures require manual inspection, never automatic duplicate writes.
          const claimed = await db.transferTrack.updateMany({
            where: { id: row.id, result: "pending" },
            data: {
              result: "adding",
              destinationId: best.track.id,
              confidence: best.confidence,
            },
          });
          if (claimed.count) {
            await a.addTracks(token!, destinationId!, [best.track.id]);
            await db.transferTrack.update({
              where: { id: row.id },
              data: {
                result: replace
                  ? "clean_replaced"
                  : best.confidence < 0.85
                    ? "review"
                    : "matched",
              },
            });
          }
        }
      }
    }
    const tracks = await db.transferTrack.findMany({
      where: { transferId: id },
    });
    const remaining = tracks.some((x) => x.result === "pending");
    const notFound = tracks.filter((x) => x.result === "not_found").length,
      excluded = tracks.filter((x) => x.result === "explicit_excluded").length,
      matched = tracks.filter((x) =>
        ["matched", "review", "clean_replaced", "exported"].includes(x.result),
      ).length;
    await db.transfer.update({
      where: { id },
      data: {
        status: remaining
          ? "pending"
          : notFound || tracks.some((x) => x.result === "adding")
            ? "partial"
            : "completed",
        matched,
        notFound,
        excluded,
        cleanReplaced: tracks.filter((x) => x.result === "clean_replaced")
          .length,
      },
    });
  } catch {
    await db.transfer.updateMany({
      where: { id, userId },
      data: {
        status: "failed",
        error:
          "Transfer stopped. Check your connection and provider permissions. If a write was interrupted, inspect the destination before rerunning to avoid duplicates.",
      },
    });
  }
}
