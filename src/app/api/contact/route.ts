import nodemailer from "nodemailer";
import addressparser from "nodemailer/lib/addressparser";
import { z } from "zod";
import { originCheck, rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  const origin = process.env.APP_URL || "http://localhost:3000";
  try {
    originCheck(req);
    await rateLimit(
      `contact:${req.headers.get("x-forwarded-for")?.split(",")[0] || "local"}`,
      3,
    );
    if (Number(req.headers.get("content-length") || 0) > 12000)
      throw new Error("Invalid request size");
    if (
      !req.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      throw new Error("Invalid form");
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Invalid form");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12000) {
        await reader.cancel();
        throw new Error("Invalid request size");
      }
      chunks.push(value);
    }
    const data = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    const value = z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.email().max(254),
        message: z.string().trim().min(10).max(3000),
      })
      .parse(Object.fromEntries(data));
    const sender = addressparser(process.env.EMAIL_FROM || "")[0];
    const recipient =
      process.env.PUBLIC_SUPPORT_EMAIL ||
      (sender && "address" in sender ? sender.address : undefined);
    if (!recipient || !process.env.SMTP_URL)
      throw new Error("Email not configured");
    const transport = nodemailer.createTransport(process.env.SMTP_URL);
    try {
      await transport.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipient,
        replyTo: { name: value.name, address: value.email },
        subject: "Playlist Converter — support/privacy request",
        text: `From: ${value.name} <${value.email}>\n\n${value.message}`,
      });
    } finally {
      transport.close();
    }
    return Response.redirect(new URL("/contact?sent=1", origin), 303);
  } catch {
    return Response.redirect(new URL("/contact?error=1", origin), 303);
  }
}
