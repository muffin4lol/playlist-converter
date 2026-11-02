import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/security";
import { adapter } from ".";
import type { Role, Token } from "./types";

// Refresh tokens remain encrypted and scoped to an authenticated app session.
export async function connectionToken(
  userId: string,
  sessionId: string,
  platform: string,
  role: Role,
): Promise<Token> {
  const connection = await db.platformConnection.findFirst({
    where: { userId, sessionId, platform, role },
  });
  if (!connection) throw new Error(`Reconnect ${role} account`);
  const token = JSON.parse(decrypt(connection.encryptedToken)) as Token;
  if (token.expiresAt > Date.now() + 60000) return token;
  const provider = adapter(platform);
  if (!provider.refreshToken || !token.refreshToken)
    throw new Error(`Reconnect ${role} account: authorization expired`);
  const claimed = await db.platformConnection.updateMany({
    where: {
      id: connection.id,
      userId,
      sessionId,
      encryptedToken: connection.encryptedToken,
      OR: [
        { refreshLeaseUntil: null },
        { refreshLeaseUntil: { lt: new Date() } },
      ],
    },
    data: { refreshLeaseUntil: new Date(Date.now() + 180000) },
  });
  if (!claimed.count)
    throw new Error("Reconnect request in progress. Try again in a moment.");
  try {
    const renewed = await provider.refreshToken(token);
    // CAS prevents a concurrent refresh from overwriting a rotated refresh token.
    const saved = await db.platformConnection.updateMany({
      where: { id: connection.id, encryptedToken: connection.encryptedToken },
      data: {
        encryptedToken: encrypt(JSON.stringify(renewed)),
        expiresAt: new Date(
          Math.max(connection.expiresAt.getTime(), renewed.expiresAt),
        ),
        refreshLeaseUntil: null,
      },
    });
    if (!saved.count) {
      const latest = await db.platformConnection.findFirst({
        where: { id: connection.id, userId, sessionId },
      });
      if (!latest) throw new Error("Reconnect account");
      return JSON.parse(decrypt(latest.encryptedToken)) as Token;
    }
    return renewed;
  } catch {
    await db.platformConnection.updateMany({
      where: { id: connection.id, userId, sessionId },
      data: { refreshLeaseUntil: null },
    });
    throw new Error(
      `Reconnect ${role} account: authorization expired or was revoked`,
    );
  }
}
