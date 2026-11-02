// Development-only email inbox. Never expose these ports publicly.
import { SMTPServer } from "smtp-server";
import { createServer } from "node:http";
const messages = [];
const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, _session, done) {
    let text = "";
    stream.on("data", (d) => (text += d));
    stream.on("end", () => {
      messages.unshift(text.replace(/=\r?\n/g, "").replaceAll("=3D", "="));
      messages.splice(50);
      done();
    });
  },
});
smtp.listen(1025, "127.0.0.1");
const inbox = createServer((_req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  });
  res.end(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Playlist Converter — Local inbox</title><style>body{background:#0c0f14;color:#eee;font:15px system-ui;max-width:850px;margin:50px auto;padding:20px}a{color:#b5a0ff}article{background:#161a22;padding:22px;border:1px solid #30343d;border-radius:12px;margin:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#bbb;line-height:1.6}</style><h1>Local email inbox</h1><p>Verification and password reset emails from your local Playlist Converter app appear here. Refresh after requesting an email.</p><a href="http://127.0.0.1:3000">Open Playlist Converter →</a>${messages.length ? messages.map((m) => `<article><pre>${escape(m)}</pre>${[...m.matchAll(/http:\/\/127\.0\.0\.1:3000\/(?:verify-email|reset-password)\?token=[A-Za-z0-9_-]+/g)].map(([u]) => `<p><a href="${escape(u)}">${u.includes("verify-email") ? "Verify email" : "Reset password"} →</a></p>`).join("")}</article>`).join("") : "<article>No messages yet. Register in the app to receive a verification email.</article>"}</html>`,
  );
});
inbox.listen(8025, "127.0.0.1", () =>
  console.log("Local email inbox: http://127.0.0.1:8025 (SMTP: 1025)"),
);
function stop() {
  smtp.close();
  inbox.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
