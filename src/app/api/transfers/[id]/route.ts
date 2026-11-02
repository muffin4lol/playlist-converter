import { requireSession, ownerWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { originCheck } from "@/lib/security";
import { failure } from "@/lib/http";
import { exportCsv } from "@/lib/csv";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const transfer = await db.transfer.findFirst({
      where: ownerWhere(s.userId, id),
      include: { tracks: { orderBy: { position: "asc" } } },
    });
    if (!transfer)
      return Response.json({ error: "Transfer not found" }, { status: 404 });
    const format = new URL(req.url).searchParams.get("format");
    if (format === "csv" || format === "playlist")
      return new Response(
        exportCsv(
          transfer.tracks
            .filter(
              (t) =>
                format !== "playlist" ||
                ["exported", "matched", "review", "clean_replaced"].includes(
                  t.result,
                ),
            )
            .map((t) => ({
              title: t.title,
              artist: t.artist,
              duration: t.duration,
              isrc: t.isrc,
              explicit: t.explicit,
              selected: t.selected,
              result: t.result,
              confidence: t.confidence,
              destinationId: t.destinationId,
            })),
        ),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="transfer-report.csv"',
          },
        },
      );
    return Response.json(transfer);
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    originCheck(req);
    const s = await requireSession();
    const { id } = await params;
    const result = await db.transfer.deleteMany({
      where: ownerWhere(s.userId, id),
    });
    if (!result.count)
      return Response.json({ error: "Transfer not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    originCheck(req);
    const s = await requireSession(true);
    const { id } = await params;
    const t = await db.transfer.findFirst({
      where: ownerWhere(s.userId, id),
      include: { tracks: { orderBy: { position: "asc" } } },
    });
    if (!t) throw new Error("Transfer not found");
    const data = {
      step: 3,
      source: t.source,
      sourceTransport: t.sourceMode,
      destinationTransport: t.destinationMode,
      destination: t.destination,
      playlistId: t.sourcePlaylistId || undefined,
      playlistName: t.destinationName,
      sourcePlaylistName: t.sourceName,
      includeExplicit: t.includeExplicit,
      cleanMode: t.cleanMode,
      tracks: t.tracks.map((x) => ({
        id: x.sourceId,
        title: x.title,
        artist: x.artist,
        duration: x.duration,
        isrc: x.isrc || undefined,
        explicit: x.explicit,
        selected: x.selected,
      })),
    };
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
