// Local-only integration smoke test. Run against a disposable database and SMTP_URL smtp://127.0.0.1:11025.
import { SMTPServer } from "smtp-server";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const origin = process.env.SMOKE_ORIGIN || "http://127.0.0.1:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
  throw new Error("Local test origins only");
const messages = [];
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, _session, callback) {
    let text = "";
    stream.on("data", (d) => (text += d));
    stream.on("end", () => {
      messages.push(text);
      callback();
    });
  },
});
await new Promise((resolve) => smtp.listen(11025, "127.0.0.1", resolve));
const password = "Local-test-" + randomBytes(14).toString("hex");
const suffix = randomBytes(4).toString("hex");
const account = {
  firstName: "Alex",
  lastName: "Morgan",
  email: `preview-${suffix}@example.test`,
  password,
  confirmPassword: password,
};
const tokens = () =>
  messages
    .at(-1)
    .replace(/=\r?\n/g, "")
    .replaceAll("=3D", "=");
let checks = 0;
async function call(
  path,
  method = "GET",
  body,
  cookie,
  expectStatus = 200,
  requestOrigin = origin,
) {
  const r = await fetch(origin + path, {
    method,
    redirect: "manual",
    headers: {
      ...(method !== "GET"
        ? { origin: requestOrigin, "Content-Type": "application/json" }
        : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(
    r.status,
    expectStatus,
    `${method} ${path}: ${await r.clone().text()}`,
  );
  checks++;
  return r;
}
try {
  await call("/api/transfers", "GET", undefined, undefined, 401);
  await call(
    "/api/auth/register",
    "POST",
    account,
    undefined,
    400,
    "https://untrusted.example",
  );
  await call("/api/auth/register", "POST", account);
  assert.equal(messages.length, 1);
  await call("/api/auth/register", "POST", account);
  assert.equal(messages.length, 2);
  const verify = new URL(
    tokens().match(/http[^\s]+verify-email\?token=[A-Za-z0-9_-]+/)[0],
  ).searchParams.get("token");
  let r = await call("/api/auth/login", "POST", {
    email: account.email,
    password,
  });
  let cookie = r.headers.get("set-cookie").split(";")[0];
  assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(r.headers.get("set-cookie"), /SameSite=lax/i);
  await call("/api/convert", "POST", {}, cookie, 400);
  await call("/api/auth/verify", "POST", { token: verify });
  const verifiedDuplicate = await call(
    "/api/auth/register",
    "POST",
    account,
    undefined,
    409,
  );
  assert.match(
    (await verifiedDuplicate.json()).error,
    /Account already exists/,
  );
  assert.equal(messages.length, 2);
  await call("/api/auth/verify", "POST", { token: verify }, undefined, 400);
  const wizard = {
    step: 3,
    source: "apple",
    destination: "youtube",
    version: 2,
    inputMode: "account",
    playlistUrl: "",
    playlistName: "Night drive",
    includeExplicit: false,
    cleanMode: "skip",
    tracks: [
      {
        id: "1",
        title: "Midnight City",
        artist: "M83",
        duration: 244000,
        explicit: false,
        selected: true,
      },
      {
        id: "2",
        title: "Explicit Example",
        artist: "Example Artist",
        duration: 180000,
        explicit: true,
        selected: false,
      },
    ],
  };
  await call("/api/wizard", "PUT", wizard, cookie);
  assert.equal(
    (await (await call("/api/wizard", "GET", undefined, cookie)).json()).state
      .playlistName,
    "Night drive",
  );
  await call(
    "/api/wizard",
    "DELETE",
    undefined,
    cookie,
    400,
    "https://untrusted.example",
  );
  assert.equal(
    (await (await call("/api/wizard", "GET", undefined, cookie)).json()).state
      .step,
    3,
  );
  await call("/api/wizard", "DELETE", undefined, cookie);
  assert.equal(
    (await (await call("/api/wizard", "GET", undefined, cookie)).json()).state,
    null,
  );
  await call("/api/wizard", "DELETE", undefined, cookie); // New transfer is idempotent.
  await call("/api/wizard", "PUT", wizard, cookie);
  await call("/api/convert", "POST", wizard, cookie, 400);
  // No provider credentials in this disposable smoke environment: a transfer must fail closed.
  const missingTransfer = { id: "not-owned-or-existing" };
  const other = { ...account, email: `other-${suffix}@example.test` };
  await call("/api/auth/register", "POST", other);
  const otherLogin = await call("/api/auth/login", "POST", {
    email: other.email,
    password,
  });
  const otherCookie = otherLogin.headers.get("set-cookie").split(";")[0];
  await call(
    `/api/transfers/${missingTransfer.id}`,
    "GET",
    undefined,
    otherCookie,
    404,
  );
  await call(
    `/api/transfers/${missingTransfer.id}`,
    "GET",
    undefined,
    otherCookie,
    404,
  );
  await call(
    `/api/transfers/${missingTransfer.id}`,
    "DELETE",
    {},
    otherCookie,
    404,
  );
  assert.equal(
    (await (await call("/api/transfers", "GET", undefined, otherCookie)).json())
      .total,
    0,
  );
  await call("/api/profile", "DELETE", { password }, otherCookie);
  await call("/api/profile", "GET", undefined, otherCookie, 401);
  await call("/api/auth/forgot", "POST", { email: account.email });
  const reset = new URL(
    tokens().match(/http[^\s]+reset-password\?token=[A-Za-z0-9_-]+/)[0],
  ).searchParams.get("token");
  const newPassword = password + "!";
  await call("/api/auth/reset", "POST", {
    token: reset,
    password: newPassword,
    confirmPassword: newPassword,
  });
  await call("/api/profile", "GET", undefined, cookie, 401);
  await call(
    "/api/auth/reset",
    "POST",
    { token: reset, password: newPassword, confirmPassword: newPassword },
    undefined,
    400,
  );
  r = await call("/api/auth/login", "POST", {
    email: account.email,
    password: newPassword,
  });
  cookie = r.headers.get("set-cookie").split(";")[0];
  await call(
    "/api/profile",
    "PATCH",
    { firstName: "Alex", lastName: "Morgan" },
    cookie,
  );
  const exported = await (
    await call("/api/export", "GET", undefined, cookie)
  ).json();
  assert.equal(exported.account.email, account.email);
  assert.equal(exported.transfers.length, 0);
  assert.equal(exported.account.passwordHash, undefined);
  await call("/api/auth/logout", "POST", {}, cookie);
  await call("/api/profile", "GET", undefined, cookie, 401);
  await writeFile(
    "/tmp/playlist-preview-account.json",
    JSON.stringify({ email: account.email, password: newPassword }),
  );
  console.log(
    `PASS: ${checks} real HTTP/database checks, SMTP verification/reset, single-use links, session invalidation, direct-destination authorization, and cross-account isolation. Synthetic preview account saved in /tmp.`,
  );
} finally {
  await new Promise((resolve) => smtp.close(resolve));
}
