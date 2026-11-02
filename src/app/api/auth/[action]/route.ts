import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { COOKIE, createSession, requireSession } from "@/lib/auth";
import { originCheck, rateLimit, digest } from "@/lib/security";
import { registerSchema, loginSchema, email, password } from "@/lib/validation";
import { sendAccountEmail } from "@/lib/mail";
import { failure, json } from "@/lib/http";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    originCheck(req);
    const { action } = await params;
    const data = await json(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    await rateLimit(`auth:${action}:${ip}`, 20);
    if (action === "register") {
      const v = registerSchema.parse(data);
      await rateLimit(`register:${v.email}`, 4);
      const existing = await db.user.findUnique({ where: { email: v.email } });
      if (!existing) {
        const user = await db.user.create({
          data: {
            firstName: v.firstName,
            lastName: v.lastName,
            email: v.email,
            passwordHash: await bcrypt.hash(v.password, 12),
          },
        });
        try {
          await sendAccountEmail(user.id, user.email, "verify");
        } catch {
          console.error(
            "Verification email delivery failed; check SMTP configuration.",
          );
        }
      }
      return Response.json({
        message:
          "Check your email to verify your account. If already registered, use login or reset password.",
      });
    }
    if (action === "login") {
      const v = loginSchema.parse(data);
      await rateLimit(`login:${v.email}`, 12);
      const user = await db.user.findUnique({ where: { email: v.email } });
      const valid = await bcrypt.compare(
        v.password,
        user?.passwordHash ||
          "$2b$12$XUljUdM7H9eS9mJpGFPkYuwlETZgqKzAj2QbR7s07MyE1DB6.9Y9K",
      );
      if (
        !user ||
        !valid ||
        (user.lockedUntil && user.lockedUntil > new Date())
      ) {
        if (user) {
          const failed = user.failedLogins + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLogins: { increment: 1 },
              lockedUntil:
                failed >= 5
                  ? new Date(
                      Date.now() +
                        Math.min(3600000, 30000 * 2 ** Math.min(failed - 5, 7)),
                    )
                  : null,
            },
          });
        }
        throw new Error(
          "Invalid email or password. Repeated attempts cause a temporary lock.",
        );
      }
      await db.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
      await createSession(user.id);
      return Response.json({ ok: true });
    }
    if (action === "logout") {
      const s = await requireSession();
      await db.session.delete({ where: { id: s.id } });
      (await cookies()).delete(COOKIE);
      return Response.json({ ok: true });
    }
    if (action === "forgot") {
      const v = email.parse(data.email);
      await rateLimit(`reset:${v}`, 3);
      const u = await db.user.findUnique({ where: { email: v } });
      if (u) {
        try {
          await sendAccountEmail(u.id, u.email, "reset");
        } catch {
          console.error(
            "Password reset email delivery failed; check SMTP configuration.",
          );
        }
      }
      return Response.json({
        message: "If an account exists, a reset link has been sent.",
      });
    }
    if (action === "resend") {
      const s = await requireSession();
      await rateLimit(`verify:${s.userId}`, 3);
      if (!s.user.emailVerified)
        await sendAccountEmail(s.userId, s.user.email, "verify");
      return Response.json({ message: "Verification email sent." });
    }
    if (action === "verify" || action === "reset") {
      const token = z.string().min(30).max(100).parse(data.token);
      const v =
        action === "reset"
          ? z
              .object({ password, confirmPassword: z.string() })
              .refine((x) => x.password === x.confirmPassword, {
                message: "Passwords do not match",
              })
              .parse(data)
          : null;
      const hash = v ? await bcrypt.hash(v.password, 12) : undefined;
      await db.$transaction(async (tx) => {
        const row = await tx.verificationToken.findFirst({
          where: {
            id: digest(token),
            purpose: action === "verify" ? "verify" : "reset",
            expiresAt: { gt: new Date() },
          },
        });
        if (!row) throw new Error("Invalid or expired link");
        await tx.verificationToken.delete({ where: { id: row.id } });
        await tx.user.update({
          where: { id: row.userId },
          data:
            action === "verify"
              ? { emailVerified: new Date() }
              : { passwordHash: hash, failedLogins: 0, lockedUntil: null },
        });
        if (action === "reset") {
          await tx.session.deleteMany({ where: { userId: row.userId } });
          await tx.verificationToken.deleteMany({
            where: { userId: row.userId, purpose: "reset" },
          });
        }
      });
      return Response.json({
        message:
          action === "verify"
            ? "Email verified. You can now convert playlists."
            : "Password reset. Please log in.",
      });
    }
    throw new Error("Invalid action");
  } catch (e) {
    return failure(e);
  }
}
