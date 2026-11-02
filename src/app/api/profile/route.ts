import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireSession, COOKIE } from "@/lib/auth";
import { originCheck, rateLimit } from "@/lib/security";
import { failure, json } from "@/lib/http";
import { names, password } from "@/lib/validation";
export async function GET() {
  try {
    const s = await requireSession();
    return Response.json({
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      email: s.user.email,
      verified: !!s.user.emailVerified,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession();
    await rateLimit(`profile:${s.userId}`, 15);
    const data = await json(req);
    if (data.newPassword) {
      const v = z
        .object({
          currentPassword: z.string().max(128),
          newPassword: password,
          confirmPassword: z.string(),
        })
        .refine((x) => x.newPassword === x.confirmPassword, {
          message: "Passwords do not match",
        })
        .parse(data);
      if (!(await bcrypt.compare(v.currentPassword, s.user.passwordHash)))
        throw new Error("Invalid current password");
      const hash = await bcrypt.hash(v.newPassword, 12);
      await db.$transaction([
        db.user.update({
          where: { id: s.userId },
          data: { passwordHash: hash },
        }),
        db.session.deleteMany({
          where: { userId: s.userId, id: { not: s.id } },
        }),
      ]);
    } else
      await db.user.update({
        where: { id: s.userId },
        data: names.parse(data),
      });
    return Response.json({ message: "Profile updated." });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    originCheck(req);
    const s = await requireSession();
    await rateLimit(`delete:${s.userId}`, 5);
    const v = z
      .object({ password: z.string().max(128) })
      .parse(await json(req));
    if (!(await bcrypt.compare(v.password, s.user.passwordHash)))
      throw new Error("Invalid password");
    await db.user.delete({ where: { id: s.userId } });
    (await cookies()).delete(COOKIE);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
