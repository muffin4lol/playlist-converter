import { requireSession } from "@/lib/auth";
import { originCheck, rateLimit } from "@/lib/security";
import { tick } from "@/lib/transfer";
import { failure } from "@/lib/http";
export const maxDuration = 60;
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    originCheck(req);
    const s = await requireSession(true);
    await rateLimit(`tick:${s.id}`, 3000);
    await tick(s.userId, s.id, (await params).id);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
