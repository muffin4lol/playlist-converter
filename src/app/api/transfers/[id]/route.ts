import { requireSession, ownerWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { originCheck } from "@/lib/security";
import { failure } from "@/lib/http";
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
    if (new URL(req.url).searchParams.has("format"))
      return Response.json(
        {
          error:
            "File reports are no longer available. Open the destination playlist from this report.",
        },
        { status: 410 },
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
    if (t.status === "legacy")
      throw new Error(
        "Start a new direct transfer for this earlier-release entry",
      );
    const data = {
      version: 2,
      step: 1,
      inputMode: "account",
      playlistUrl: "",
      source: t.source,
      destination: t.destination === t.source ? "" : t.destination,
      playlistId: t.sourcePlaylistId || undefined,
      playlistName: t.destinationName,
      sourcePlaylistName: t.sourceName,
      includeExplicit: t.includeExplicit,
      cleanMode: t.cleanMode,
      tracks: t.tracks.map((x) => ({
        id: x.sourceId,
        title: x.title,
        artist: x.artist,
        album: x.album || undefined,
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
