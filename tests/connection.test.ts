import { beforeEach, it, expect, vi } from "vitest";
const { db, refresh } = vi.hoisted(() => ({
  db: { platformConnection: { findFirst: vi.fn(), updateMany: vi.fn() } },
  refresh: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("../src/lib/platforms", () => ({
  adapter: () => ({ refreshToken: refresh }),
}));
import { connectionToken } from "../src/lib/platforms/connection";
import { encrypt, decrypt } from "../src/lib/security";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  db.platformConnection.updateMany.mockResolvedValue({ count: 1 });
});
it("never reads another session's credentials", async () => {
  db.platformConnection.findFirst.mockResolvedValue(null);
  await expect(
    connectionToken("owner", "session", "spotify", "destination"),
  ).rejects.toThrow("Reconnect");
  expect(db.platformConnection.findFirst).toHaveBeenCalledWith({
    where: {
      userId: "owner",
      sessionId: "session",
      platform: "spotify",
      role: "destination",
    },
  });
});
it("refreshes an expired access token while retaining encrypted session-bound credentials", async () => {
  const old = {
    accessToken: "old",
    refreshToken: "refresh",
    expiresAt: Date.now() - 1000,
    displayName: "Owner",
  };
  const expiry = new Date(Date.now() + 86400000);
  db.platformConnection.findFirst.mockResolvedValue({
    id: "c",
    encryptedToken: encrypt(JSON.stringify(old)),
    expiresAt: expiry,
  });
  refresh.mockResolvedValue({
    ...old,
    accessToken: "new",
    refreshToken: "rotated",
    expiresAt: Date.now() + 3600000,
  });
  expect(
    (await connectionToken("owner", "session", "spotify", "destination"))
      .accessToken,
  ).toBe("new");
  const saved = db.platformConnection.updateMany.mock.calls[1][0];
  expect(saved.data.expiresAt).toEqual(expiry);
  expect(JSON.parse(decrypt(saved.data.encryptedToken)).refreshToken).toBe(
    "rotated",
  );
  expect(saved.data.refreshLeaseUntil).toBeNull();
});
it("does not concurrently rotate the same provider refresh token", async () => {
  db.platformConnection.findFirst.mockResolvedValue({
    id: "c",
    encryptedToken: encrypt(
      JSON.stringify({
        accessToken: "old",
        refreshToken: "refresh",
        expiresAt: 0,
      }),
    ),
    expiresAt: new Date(),
  });
  db.platformConnection.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    connectionToken("owner", "session", "spotify", "source"),
  ).rejects.toThrow("in progress");
  expect(refresh).not.toHaveBeenCalled();
});
it("requests reconnect for an expired non-refreshable token", async () => {
  db.platformConnection.findFirst.mockResolvedValue({
    encryptedToken: encrypt(
      JSON.stringify({ accessToken: "expired", expiresAt: 0 }),
    ),
  });
  await expect(
    connectionToken("owner", "session", "apple", "destination"),
  ).rejects.toThrow("expired");
  expect(refresh).not.toHaveBeenCalled();
});
