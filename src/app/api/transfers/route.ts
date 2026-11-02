import { requireSession, ownerWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { originCheck } from "@/lib/security";
import { failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const q = new URL(req.url).searchParams;
    const page = Math.max(1, Math.min(100000, Number(q.get("page")) || 1));
    const where = {
      ...ownerWhere(s.userId),
      ...(q.get("search")
        ? {
            sourceName: {
              contains: q.get("search")!.slice(0, 200),
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(q.get("platform")
        ? {
            OR: [
              { source: q.get("platform")! },
              { destination: q.get("platform")! },
            ],
          }
        : {}),
      ...(q.get("status") ? { status: q.get("status")! } : {}),
    };
    const [items, total] = await Promise.all([
      db.transfer.findMany({
        where,
        orderBy: { createdAt: q.get("sort") === "asc" ? "asc" : "desc" },
        skip: (page - 1) * 10,
        take: 10,
      }),
      db.transfer.count({ where }),
    ]);
    return Response.json({ items, total, page });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession();
    await db.transfer.deleteMany({
      where: { userId: s.userId },
    });
    await db.wizardState.deleteMany({ where: { userId: s.userId } });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
