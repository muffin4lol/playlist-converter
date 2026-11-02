import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { adapter } from "@/lib/platforms";
import {
  randomToken,
  digest,
  encrypt,
  decrypt,
  originCheck,
  rateLimit,
} from "@/lib/security";
import type { Token, Role } from "@/lib/platforms/types";
import { failure, json } from "@/lib/http";
import { z } from "zod";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; action: string }> },
) {
  try {
    const s = await requireSession(true);
    const { platform, action } = await params;
    const a = adapter(platform);
    await rateLimit(`platform:${s.id}`, 200);
    const role: Role =
      req.nextUrl.searchParams.get("role") === "destination"
        ? "destination"
        : "source";
    if (action === "callback") {
      const state = req.nextUrl.searchParams.get("state") || "";
      const attempt = await db.$transaction(async (tx) => {
        const row = await tx.oAuthAttempt.findFirst({
          where: {
            id: digest(state),
            sessionId: s.id,
            platform,
            expiresAt: { gt: new Date() },
          },
        });
        if (!row) throw new Error("Invalid or expired OAuth state");
        await tx.oAuthAttempt.delete({ where: { id: row.id } });
        return row;
      });
      if (req.nextUrl.searchParams.has("error"))
        return NextResponse.redirect(
          new URL("/converter?connection=denied", process.env.APP_URL),
        );
      const code = req.nextUrl.searchParams.get("code");
      if (!code) throw new Error("Invalid authorization code");
      const t = await a.handleCallback(code, decrypt(attempt.verifier));
      await db.platformConnection.upsert({
        where: {
          sessionId_platform_role: {
            sessionId: s.id,
            platform,
            role: attempt.role,
          },
        },
        create: {
          sessionId: s.id,
          userId: s.userId,
          platform,
          role: attempt.role,
          encryptedToken: encrypt(JSON.stringify(t)),
          expiresAt: new Date(t.expiresAt),
          displayName: t.displayName,
          avatar: t.avatar,
        },
        update: {
          encryptedToken: encrypt(JSON.stringify(t)),
          expiresAt: new Date(t.expiresAt),
          displayName: t.displayName,
          avatar: t.avatar,
        },
      });
      return NextResponse.redirect(
        new URL("/converter?connected=" + platform, process.env.APP_URL),
      );
    }
    const c = await db.platformConnection.findFirst({
      where: {
        userId: s.userId,
        sessionId: s.id,
        platform,
        role,
        expiresAt: { gt: new Date() },
      },
    });
    if (!c) throw new Error("Reconnect your platform account");
    const t = JSON.parse(decrypt(c.encryptedToken)) as Token;
    if (action === "playlists")
      return Response.json(await a.fetchUserPlaylists(t));
    if (action === "playlist") {
      let id = req.nextUrl.searchParams.get("id") || "";
      if (id.startsWith("https://")) {
        const url = new URL(id);
        if (platform === "spotify" && url.hostname === "open.spotify.com")
          id = url.pathname.split("/playlist/")[1]?.split("/")[0] || "";
        else if (
          platform === "youtube" &&
          ["music.youtube.com", "www.youtube.com", "youtube.com"].includes(
            url.hostname,
          )
        )
          id = url.searchParams.get("list") || "";
        else if (platform === "apple" && url.hostname === "music.apple.com")
          id = url.pathname.split("/").at(-1) || "";
        else if (
          platform === "tidal" &&
          ["tidal.com", "www.tidal.com", "listen.tidal.com"].includes(
            url.hostname,
          )
        )
          id = url.pathname.split("/").at(-1) || "";
        else if (
          platform === "deezer" &&
          ["deezer.com", "www.deezer.com"].includes(url.hostname)
        )
          id = url.pathname.split("/").at(-1) || "";
        else if (
          platform === "soundcloud" &&
          ["soundcloud.com", "www.soundcloud.com"].includes(url.hostname)
        ) {
          const resolved = await fetch(
            "https://api.soundcloud.com/resolve?" +
              new URLSearchParams({ url: url.href }),
            {
              headers: { Authorization: `OAuth ${t.accessToken}` },
              signal: AbortSignal.timeout(15000),
            },
          );
          if (!resolved.ok) throw new Error("Invalid SoundCloud playlist URL");
          const result = await resolved.json();
          if (result.kind !== "playlist")
            throw new Error("Invalid SoundCloud playlist URL");
          id = String(result.id);
        } else throw new Error("Invalid playlist URL");
      }
      if (!/^[A-Za-z0-9_.-]{1,200}$/.test(id))
        throw new Error("Invalid playlist identifier");
      return Response.json(await a.fetchPlaylist(t, id));
    }
    throw new Error("Invalid action");
  } catch (e) {
    if ((await params).action === "callback")
      return NextResponse.redirect(
        new URL(
          e instanceof Error && e.message === "Unauthorized"
            ? "/login"
            : "/converter?connection=failed",
          process.env.APP_URL || "http://localhost:3000",
        ),
      );
    return failure(e);
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; action: string }> },
) {
  try {
    originCheck(req);
    const { platform, action } = await params;
    const s = await requireSession(action === "connect");
    if (action === "connect") {
      await rateLimit(`connect:${s.id}`, 30);
      const { role } = z
        .object({ role: z.enum(["source", "destination"]) })
        .parse(await json(req));
      const state = randomToken(),
        verifier = randomToken(),
        challenge = createHash("sha256").update(verifier).digest("base64url");
      const url = adapter(platform).getAuthUrl(state, challenge, role);
      await db.oAuthAttempt.create({
        data: {
          id: digest(state),
          sessionId: s.id,
          platform,
          role,
          verifier: encrypt(verifier),
          expiresAt: new Date(Date.now() + 600000),
        },
      });
      return Response.json({ url });
    }
    if (action !== "disconnect") throw new Error("Invalid action");
    const connections = await db.platformConnection.findMany({
      where: { sessionId: s.id, userId: s.userId, platform },
    });
    let revoked = true;
    for (const c of connections) {
      try {
        await adapter(platform).revoke(JSON.parse(decrypt(c.encryptedToken)));
      } catch {
        revoked = false;
      }
    }
    await db.platformConnection.deleteMany({
      where: { sessionId: s.id, userId: s.userId, platform },
    });
    return Response.json({
      message: ["spotify", "tidal", "apple"].includes(platform)
        ? "Disconnected locally. Remove app consent in your streaming provider account settings to fully revoke access."
        : revoked
          ? "Disconnected and revoked."
          : "Disconnected locally. Provider revocation failed; remove access in your provider settings.",
    });
  } catch (e) {
    return failure(e);
  }
}
