import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure } from "@/lib/http";
export async function GET() {
  try {
    const s = await requireSession();
    const transfers = await db.transfer.findMany({
      where: { userId: s.userId },
      include: { tracks: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(
      {
        account: {
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          email: s.user.email,
          createdAt: s.user.createdAt,
        },
        transfers,
        connections: await db.platformConnection.findMany({
          where: { userId: s.userId },
          select: {
            platform: true,
            role: true,
            displayName: true,
            expiresAt: true,
          },
        }),
        wizard:
          (await db.wizardState.findUnique({ where: { userId: s.userId } }))
            ?.data ?? null,
      },
      {
        headers: {
          "Content-Disposition":
            'attachment; filename="playlist-converter-data.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
