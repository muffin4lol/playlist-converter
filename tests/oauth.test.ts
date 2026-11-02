import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
const { db, auth, provider } = vi.hoisted(() => ({
  db: {
    oAuthAttempt: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    platformConnection: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    rateLimit: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  auth: vi.fn(),
  provider: { getAuthUrl: vi.fn(), handleCallback: vi.fn(), revoke: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/auth", () => ({ requireSession: auth }));
vi.mock("@/lib/platforms", () => ({ adapter: () => provider }));
import { GET, POST } from "../src/app/api/platforms/[platform]/[action]/route";
import { encrypt, decrypt, digest } from "../src/lib/security";
const params = (action: string) => ({
  params: Promise.resolve({ platform: "spotify", action }),
});
beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_URL = "http://localhost:3000";
  process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  auth.mockResolvedValue({ id: "session-a", userId: "user-a" });
  db.rateLimit.upsert.mockResolvedValue({
    count: 1,
    expiresAt: new Date(Date.now() + 100000),
  });
  db.$transaction.mockImplementation((fn) => fn(db));
  provider.getAuthUrl.mockReturnValue("https://accounts.spotify.com/authorize");
});
describe("OAuth state and session boundaries", () => {
  it("binds attempts to the initiating session and encrypts PKCE verifier", async () => {
    const r = await POST(
      new NextRequest("http://localhost:3000/api/platforms/spotify/connect", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ role: "destination" }),
      }),
      params("connect"),
    );
    expect(r.status).toBe(200);
    expect(auth).toHaveBeenCalledWith(true);
    const data = db.oAuthAttempt.create.mock.calls[0][0].data;
    expect(data.sessionId).toBe("session-a");
    expect(data.role).toBe("destination");
    expect(data.id).toHaveLength(64);
    expect(decrypt(data.verifier)).toHaveLength(43);
  });
  it("rejects cross-origin connect before writing state", async () => {
    const r = await POST(
      new NextRequest("http://localhost:3000/api/platforms/spotify/connect", {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: '{"role":"source"}',
      }),
      params("connect"),
    );
    expect(r.status).toBe(400);
    expect(db.oAuthAttempt.create).not.toHaveBeenCalled();
  });
  it("cannot consume another session’s OAuth attempt", async () => {
    db.oAuthAttempt.findFirst.mockResolvedValue(null);
    const r = await GET(
      new NextRequest(
        "http://localhost:3000/api/platforms/spotify/callback?state=opaque&code=code",
      ),
      params("callback"),
    );
    expect(r.headers.get("location")).toContain("connection=failed");
    expect(db.oAuthAttempt.findFirst).toHaveBeenCalledWith({
      where: {
        id: digest("opaque"),
        sessionId: "session-a",
        platform: "spotify",
        expiresAt: { gt: expect.any(Date) },
      },
    });
    expect(provider.handleCallback).not.toHaveBeenCalled();
  });
  it("consumes state once and stores only encrypted credentials", async () => {
    db.oAuthAttempt.findFirst
      .mockResolvedValueOnce({
        id: "state-hash",
        role: "source",
        verifier: encrypt("verifier"),
      })
      .mockResolvedValueOnce(null);
    const token = {
      accessToken: "secret-access",
      expiresAt: Date.now() + 100000,
      displayName: "Provider User",
    };
    provider.handleCallback.mockResolvedValue(token);
    const req = () =>
      new NextRequest(
        "http://localhost:3000/api/platforms/spotify/callback?state=opaque&code=code",
      );
    expect(
      (await GET(req(), params("callback"))).headers.get("location"),
    ).toContain("connected=spotify");
    const stored = db.platformConnection.upsert.mock.calls[0][0].create;
    expect(stored.userId).toBe("user-a");
    expect(stored.encryptedToken).not.toContain("secret-access");
    expect(JSON.parse(decrypt(stored.encryptedToken))).toEqual(token);
    await GET(req(), params("callback"));
    expect(provider.handleCallback).toHaveBeenCalledTimes(1);
    expect(db.oAuthAttempt.delete).toHaveBeenCalledWith({
      where: { id: "state-hash" },
    });
  });
  it("disconnects only connections owned by this user and session", async () => {
    db.platformConnection.findMany.mockResolvedValue([]);
    const r = await POST(
      new NextRequest(
        "http://localhost:3000/api/platforms/spotify/disconnect",
        {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
          body: "{}",
        },
      ),
      params("disconnect"),
    );
    expect(r.status).toBe(200);
    expect(db.platformConnection.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "session-a", userId: "user-a", platform: "spotify" },
    });
  });
});
