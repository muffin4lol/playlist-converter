import nodemailer from "nodemailer";
import { db } from "./db";
import { randomToken, digest } from "./security";
export async function sendAccountEmail(
  userId: string,
  email: string,
  purpose: "verify" | "reset",
) {
  const token = randomToken();
  await db.verificationToken.create({
    data: {
      id: digest(token),
      userId,
      purpose,
      expiresAt: new Date(
        Date.now() + (purpose === "verify" ? 86400000 : 1800000),
      ),
    },
  });
  const url = `${process.env.APP_URL}/${purpose === "verify" ? "verify-email" : "reset-password"}?token=${token}`;
  const transport = nodemailer.createTransport(
    process.env.SMTP_URL || "smtp://127.0.0.1:1025",
  );
  await transport.sendMail({
    from: process.env.EMAIL_FROM || "Playlist Converter <hello@localhost>",
    to: email,
    subject:
      purpose === "verify"
        ? "Verify your Playlist Converter email"
        : "Reset your password",
    text: `${purpose === "verify" ? "Verify your email" : "Reset your password"}: ${url}
If you did not request this, ignore this email.`,
  });
}
