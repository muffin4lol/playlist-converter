import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({
  db: {
    session: { deleteMany: vi.fn() },
    platformConnection: { deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
    oAuthAttempt: { deleteMany: vi.fn() },
    rateLimit: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db }));
import { GET } from "../src/app/api/maintenance/cleanup/route";
import { platformAvailability } from "../src/lib/platforms/availability";
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe("production operations", () => {
  it("rejects public cleanup requests without touching data", async () => {
    vi.stubEnv("CRON_SECRET", "test-cleanup-secret");
    const response = await GET(
      new Request("https://app.test/api/maintenance/cleanup"),
    );
    expect(response.status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.session.deleteMany).not.toHaveBeenCalled();
  });
  it("fails closed if the cron secret is absent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://app.test"))).status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("cleans only expired transient records with valid authorization", async () => {
    vi.stubEnv("CRON_SECRET", "test-cleanup-secret");
    expect(
      (
        await GET(
          new Request("https://app.test", {
            headers: { authorization: "Bearer test-cleanup-secret" },
          }),
        )
      ).status,
    ).toBe(200);
    expect(db.$transaction).toHaveBeenCalledOnce();
    for (const model of [
      db.session,
      db.platformConnection,
      db.verificationToken,
      db.oAuthAttempt,
      db.rateLimit,
    ]) {
      expect(model.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    }
  });
  it("does not advertise an incomplete YouTube configuration or expose credentials", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "example-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(platformAvailability().youtube).toBe(false);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "example-secret");
    expect(platformAvailability().youtube).toBe(true);
    expect(
      Object.values(platformAvailability()).every(
        (value) => typeof value === "boolean",
      ),
    ).toBe(true);
    expect(Object.keys(platformAvailability())).not.toContain("amazon");
  });
});
