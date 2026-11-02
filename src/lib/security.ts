import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
export const randomToken = () => randomBytes(32).toString("base64url");
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function encrypt(value: string) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "hex");
  if (key.length !== 32)
    throw new Error("Set TOKEN_ENCRYPTION_KEY to 32 random bytes in hex");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([
    iv,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(value: string) {
  const data = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "hex"),
      data.subarray(0, 12),
    );
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    decipher.update(data.subarray(12, -16)),
    decipher.final(),
  ]).toString();
}
export function same(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function originCheck(req: Request) {
  const appUrl = new URL(process.env.APP_URL || "http://localhost:3000");
  if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:")
    throw new Error("HTTPS required for APP_URL");
  const origin = appUrl.origin;
  if (req.headers.get("origin") !== origin)
    throw new Error("Invalid request origin");
  if (
    process.env.NODE_ENV === "production" &&
    new URL(req.url).protocol !== "https:"
  )
    throw new Error("HTTPS required");
}
export async function rateLimit(key: string, limit = 8) {
  const k = digest(key),
    now = new Date();
  const row = await db.rateLimit.upsert({
    where: { key: k },
    create: { key: k, count: 1, expiresAt: new Date(Date.now() + 900000) },
    update: { count: { increment: 1 } },
  });
  if (row.expiresAt < now) {
    await db.rateLimit.updateMany({
      where: { key: k, expiresAt: { lt: now } },
      data: { count: 1, expiresAt: new Date(Date.now() + 900000) },
    });
    return;
  }
  if (row.count > limit)
    throw new Error("Too many attempts. Try again in 15 minutes.");
}
