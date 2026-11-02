import { spawnSync } from "node:child_process";
import nodemailer from "nodemailer";
import addressparser from "nodemailer/lib/addressparser/index.js";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Explicit release check: send only to the configured sender's own mailbox.
if (process.env.CHECK_SMTP === "1") {
  const sender = addressparser(process.env.EMAIL_FROM || "")[0]?.address;
  if (!sender || !process.env.SMTP_URL)
    throw new Error("Production email settings are required");
  const transport = nodemailer.createTransport(process.env.SMTP_URL, {
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    await transport.verify();
    const result = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: sender,
      subject: "Playlist Converter — deployment email test",
      text: "Your Playlist Converter deployment successfully connected to the email service. This is a sender-mailbox delivery test. Registration verification and password reset still need an end-to-end check in the app.",
    });
    if (!result.accepted?.length) throw new Error("No recipient accepted");
    console.log(
      "SMTP authentication and sender-mailbox test accepted by mail provider.",
    );
  } catch (error) {
    console.error("SMTP release check failed:", error.code || "MAIL_ERROR");
    process.exit(1);
  } finally {
    transport.close();
  }
}

// Explicit one-release opt-in: ordinary previews and builds never migrate data.
if (process.env.APPLY_DB_MIGRATIONS === "1") {
  if (process.env.VERCEL_ENV !== "production") {
    throw new Error(
      "Database release migrations require the production environment",
    );
  }
  run("npx", ["prisma", "migrate", "deploy"]);
}
run("npm", ["run", "build"]);
