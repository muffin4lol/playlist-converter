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
  const copy =
    purpose === "verify"
      ? {
          subject: "Verify your Playlist Converter email",
          heading: "Let’s get your playlists moving.",
          description:
            "Confirm your email to start moving your favorite playlists between music services.",
          button: "Verify my email",
          expiry: "This link expires in 24 hours.",
          safety:
            "If you didn’t create a Playlist Converter account, you can ignore this email.",
        }
      : {
          subject: "Reset your Playlist Converter password",
          heading: "Back to the music.",
          description:
            "Use the button below to choose a new password for your Playlist Converter account.",
          button: "Reset my password",
          expiry: "This link expires in 30 minutes.",
          safety:
            "If you didn’t request a password reset, you can ignore this email. Your password will stay the same.",
        };
  const link = url
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || "Playlist Converter <hello@localhost>",
      to: email,
      subject: copy.subject,
      text: `${copy.heading}

${copy.description}

${copy.button}: ${url}

${copy.expiry} ${copy.safety}

Playlist Converter`,
      html: `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f2ff;color:#1d1533;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2ff">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;background:#ffffff;border:1px solid #e5ddf8;border-radius:18px">
<tr><td style="padding:24px 28px;background:#22143e;color:#ffffff;border-radius:18px 18px 0 0;font-size:16px;font-weight:bold">
<span aria-hidden="true" style="color:#c9b2ff">♫</span>&nbsp; Playlist Converter
</td></tr>
<tr><td style="padding:32px 28px">
<h1 style="margin:0 0 14px;font-size:30px;line-height:1.2;color:#22143e">${copy.heading}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#463b5c">${copy.description}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td bgcolor="#5932b4" style="border-radius:8px"><a href="${link}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">${copy.button}</a></td>
</tr></table>
<p style="margin:18px 0 0;color:#5e536f;font-size:14px;line-height:1.5">${copy.expiry}</p>
<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #ebe5f8;color:#5e536f;font-size:13px;line-height:1.6">If the button doesn’t work, copy this link into your browser:<br>
<a href="${link}" style="color:#5932b4;overflow-wrap:anywhere;word-break:break-all">${link}</a></p>
<p style="margin:18px 0 0;color:#5e536f;font-size:13px;line-height:1.6">${copy.safety}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  } finally {
    transport.close();
  }
}
