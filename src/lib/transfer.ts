import { db } from "./db";
import { adapter } from "./platforms";
import { connectionToken } from "./platforms/connection";
import { match } from "./matching";
import { platformLabel } from "@/components/platforms";
import type { Track } from "./platforms/types";

// Matching and writes are bounded per tick. The lease serializes playlist order.
export async function tick(userId: string, sessionId: string, id: string) {
  const lease = await db.transfer.updateMany({
    where: {
      id,
      userId,
      OR: [
        { status: "pending" },
        {
          status: "processing",
          updatedAt: { lt: new Date(Date.now() - 120000) },
        },
      ],
    },
    data: { status: "processing", error: null },
  });
  if (!lease.count) return;
  try {
    const t = await db.transfer.findFirstOrThrow({
      where: { id, userId },
      include: { tracks: { orderBy: { position: "asc" } } },
    });
    const a = adapter(t.destination);
    const token = await connectionToken(
      userId,
      sessionId,
      t.destination,
      "destination",
    );
    let destinationId = t.destinationId;
    if (destinationId === "__creation_pending__")
      throw new Error(
        "Playlist creation interrupted. Inspect destination before rerunning.",
      );
    if (t.tracks.some((x) => x.result === "adding"))
      throw new Error(
        "Track addition interrupted. Inspect destination before rerunning.",
      );
    if (!destinationId) {
      await db.transfer.update({
        where: { id },
        data: { destinationId: "__creation_pending__" },
      });
      const description = `Created with Playlist Converter • Imported from ${platformLabel(t.source)}: ${t.sourceName}`;
      const playlist = await a.createPlaylist(
        token,
        t.destinationName,
        description,
      );
      destinationId = playlist.id;
      await db.transfer.update({
        where: { id },
        data: { destinationId: playlist.id, destinationUrl: playlist.url },
      });
    }
    // Match at most three per tick, then drain up to 50 prepared tracks in order.
    // YouTube's official API accepts only one playlist item per write; its adapter serializes that batch.
    const pending = t.tracks.filter((x) => x.result === "pending").slice(0, 3);
    for (const row of pending) {
      const source: Track = {
        id: row.sourceId,
        title: row.title,
        artist: row.artist,
        album: row.album || undefined,
        duration: row.duration,
        isrc: row.isrc || undefined,
        explicit: row.explicit,
        selected: row.selected,
      };
      const replace =
        !t.includeExplicit &&
        row.explicit === true &&
        t.cleanMode === "replace" &&
        !row.selected;
      if (!row.selected && !replace) {
        await db.transferTrack.update({
          where: { id: row.id },
          data: {
            result:
              row.explicit === true && !t.includeExplicit
                ? "explicit_excluded"
                : "skipped",
          },
        });
        continue;
      }
      let candidates = await a.searchTrack(token, source, replace);
      let best = match(source, candidates, replace);
      if (!replace && source.isrc && (!best || best.confidence < 0.65)) {
        candidates = await a.searchTrack(token, { ...source, isrc: undefined });
        best = match(source, candidates, false);
      }
      await db.transferTrack.update({
        where: { id: row.id },
        data:
          !best || best.confidence < 0.65
            ? { result: "not_found", confidence: best?.confidence }
            : {
                result: replace ? "ready_clean" : "ready",
                destinationId: best.track.id,
                confidence: best.confidence,
              },
      });
    }
    let tracks = await db.transferTrack.findMany({
      where: { transferId: id },
      orderBy: { position: "asc" },
    });
    const batchSize = a.id === "youtube" ? 5 : 50;
    const ready = tracks
      .filter((x) => ["ready", "ready_clean"].includes(x.result))
      .slice(0, batchSize);
    // Accumulate a batch across ticks; flush when no unmatched tracks remain.
    if (
      ready.length &&
      (ready.length >= batchSize || !tracks.some((x) => x.result === "pending"))
    ) {
      const claimed = await db.transferTrack.updateMany({
        where: {
          id: { in: ready.map((x) => x.id) },
          result: { in: ["ready", "ready_clean"] },
        },
        data: { result: "adding" },
      });
      if (claimed.count !== ready.length)
        throw new Error("Transfer changed while preparing a batch");
      await a.addTracks(
        token,
        destinationId!,
        ready.map((x) => x.destinationId!),
      );
      for (const row of ready)
        await db.transferTrack.update({
          where: { id: row.id },
          data: {
            result:
              row.result === "ready_clean"
                ? "clean_replaced"
                : (row.confidence || 0) < 0.85
                  ? "review"
                  : "matched",
          },
        });
      tracks = await db.transferTrack.findMany({
        where: { transferId: id },
        orderBy: { position: "asc" },
      });
    }
    const remaining = tracks.some((x) =>
      ["pending", "ready", "ready_clean"].includes(x.result),
    );
    const notFound = tracks.filter((x) => x.result === "not_found").length;
    await db.transfer.update({
      where: { id },
      data: {
        status: remaining ? "pending" : notFound ? "partial" : "completed",
        matched: tracks.filter((x) =>
          ["matched", "review", "clean_replaced"].includes(x.result),
        ).length,
        notFound,
        excluded: tracks.filter((x) => x.result === "explicit_excluded").length,
        cleanReplaced: tracks.filter((x) => x.result === "clean_replaced")
          .length,
      },
    });
  } catch (error) {
    const reconnect =
      error instanceof Error && error.message.startsWith("Reconnect");
    await db.transfer.updateMany({
      where: { id, userId },
      data: {
        status: reconnect ? "pending" : "failed",
        error: reconnect
          ? "Reconnect your destination account, then resume this transfer."
          : "Transfer stopped. Check provider permissions or rate limits. Inspect your destination playlist before rerunning an interrupted write to avoid duplicates.",
      },
    });
  }
}
