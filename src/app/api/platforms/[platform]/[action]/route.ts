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
import type { Role } from "@/lib/platforms/types";
import { failure, json } from "@/lib/http";
import { z } from "zod";
import { connectionToken } from "@/lib/platforms/connection";
import { playlistReference } from "@/lib/platforms/playlist-url";
import { trackSchema } from "@/lib/validation";
import { api } from "@/lib/platforms/request";
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
          expiresAt: new Date(
            t.refreshToken ? s.expiresAt.getTime() : t.expiresAt,
          ),
          displayName: t.displayName,
          avatar: t.avatar,
        },
        update: {
          encryptedToken: encrypt(JSON.stringify(t)),
          expiresAt: new Date(
            t.refreshToken ? s.expiresAt.getTime() : t.expiresAt,
          ),
          displayName: t.displayName,
          avatar: t.avatar,
        },
      });
      return NextResponse.redirect(
        new URL("/converter?connected=" + platform, process.env.APP_URL),
      );
    }
    const checked = (playlist: { name: string; tracks: unknown[] }) => {
      if (!playlist.tracks.length)
        throw new Error("Playlist is empty, private, or unavailable");
      if (playlist.tracks.length > 1000)
        throw new Error("Playlist exceeds the supported 1,000-track limit");
      return Response.json({
        name: playlist.name,
        tracks: playlist.tracks.map((track) => trackSchema.parse(track)),
      });
    };
    if (action === "public") {
      const ref = playlistReference(
        platform,
        req.nextUrl.searchParams.get("url") || "",
      );
      if (a.fetchPublicPlaylist)
        return checked(await a.fetchPublicPlaylist(ref.id, ref.storefront));
      throw new Error(
        `${a.name} requires a source account connection to read playlist links through its official API. Choose Load from my account.`,
      );
    }
    const token = await connectionToken(s.userId, s.id, platform, role);
    if (action === "playlists")
      return Response.json(await a.fetchUserPlaylists(token));
    if (action === "playlist") {
      let id = req.nextUrl.searchParams.get("id") || "";
      if (id.startsWith("https://")) id = playlistReference(platform, id).id;
      if (platform === "soundcloud" && id.startsWith("https://")) {
        const resolved = await api<{ kind: string; id: number }>(
          "https://api.soundcloud.com/resolve?" +
            new URLSearchParams({ url: id }),
          { headers: { Authorization: `OAuth ${token.accessToken}` } },
        );
        if (resolved.kind !== "playlist")
          throw new Error("Invalid SoundCloud playlist URL");
        id = String(resolved.id);
      }
      if (!/^[A-Za-z0-9_.-]{1,200}$/.test(id))
        throw new Error("Invalid playlist identifier");
      return checked(await a.fetchPlaylist(token, id));
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
