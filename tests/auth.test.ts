import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { registerSchema } from "../src/lib/validation";
const { mockDb, jar, sendEmail } = vi.hoisted(() => ({
  mockDb: {
    rateLimit: { upsert: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    verificationToken: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  jar: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("@/lib/mail", () => ({ sendAccountEmail: sendEmail }));
import { POST } from "../src/app/api/auth/[action]/route";
import { NextRequest } from "next/server";
import { session, requireSession } from "../src/lib/auth";
import { digest, encrypt, decrypt, originCheck } from "../src/lib/security";
const signup = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "CorrectHorse42!",
  confirmPassword: "CorrectHorse42!",
};
function call(action: string, body: unknown, origin = "http://localhost:3000") {
  return POST(
    new NextRequest("http://localhost:3000/api/auth/" + action, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) },
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_URL = "http://localhost:3000";
  process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  mockDb.rateLimit.upsert.mockResolvedValue({
    count: 1,
    expiresAt: new Date(Date.now() + 100000),
  });
  mockDb.$transaction.mockImplementation(async (fn) => fn(mockDb));
});
describe("account validation", () => {
  it("requires every registration field", () => {
    for (const field of Object.keys(signup))
      expect(registerSchema.safeParse({ ...signup, [field]: "" }).success).toBe(
        false,
      );
  });
  it("checks password confirmation", () =>
    expect(
      registerSchema.safeParse({ ...signup, confirmPassword: "different" })
        .success,
    ).toBe(false));
  it("normalizes email", () =>
    expect(
      registerSchema.parse({ ...signup, email: "ADA@example.com" }).email,
    ).toBe("ada@example.com"));
});
describe("authentication routes", () => {
  it("hashes password and sends verification", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockImplementation(async ({ data }) => {
      expect(data.password).toBeUndefined();
      expect(await bcrypt.compare(signup.password, data.passwordHash)).toBe(
        true,
      );
      return { id: "u", ...data };
    });
    expect((await call("register", signup)).status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith("u", signup.email, "verify");
  });
  it("sets opaque httpOnly cookie after login", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "u",
      passwordHash: await bcrypt.hash(signup.password, 4),
      failedLogins: 0,
    });
    mockDb.session.create.mockResolvedValue({});
    expect(
      (await call("login", { email: signup.email, password: signup.password }))
        .status,
    ).toBe(200);
    expect(jar.set).toHaveBeenCalledWith(
      "pc_session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    const callData = mockDb.session.create.mock.calls[0][0];
    expect(callData.data.id).toHaveLength(64);
  });
  it("backs off after repeated failures", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "u",
      passwordHash: await bcrypt.hash(signup.password, 4),
      failedLogins: 4,
    });
    expect(
      (await call("login", { email: signup.email, password: "wrong" })).status,
    ).toBe(400);
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
      }),
    );
    expect(jar.set).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations", async () => {
    expect(
      (await call("register", signup, "https://evil.example")).status,
    ).toBe(400);
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });
  it("uses generic forgot-password response", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    expect((await call("forgot", { email: signup.email })).status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("rejects expired reset tokens", async () => {
    mockDb.verificationToken.findFirst.mockResolvedValue(null);
    expect(
      (
        await call("reset", {
          token: "x".repeat(43),
          password: signup.password,
          confirmPassword: signup.password,
        })
      ).status,
    ).toBe(400);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
  it("verifies email with a single-use token", async () => {
    mockDb.verificationToken.findFirst.mockResolvedValue({
      id: "hashed-token",
      userId: "u",
    });
    expect((await call("verify", { token: "x".repeat(43) })).status).toBe(200);
    expect(mockDb.verificationToken.delete).toHaveBeenCalledWith({
      where: { id: "hashed-token" },
    });
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u" },
      data: { emailVerified: expect.any(Date) },
    });
  });
  it("blocks expired sessions", async () => {
    jar.get.mockReturnValue({ value: "opaque" });
    mockDb.session.findFirst.mockResolvedValue(null);
    expect(await session()).toBeNull();
    expect(mockDb.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: digest("opaque"),
          expiresAt: { gt: expect.any(Date) },
        }),
      }),
    );
  });
  it("blocks unverified conversions", async () => {
    jar.get.mockReturnValue({ value: "opaque" });
    mockDb.session.findFirst.mockResolvedValue({
      user: { emailVerified: null },
    });
    await expect(requireSession(true)).rejects.toThrow("Verify your email");
  });
});
describe("token encryption", () => {
  it("roundtrips without plaintext and uses unique nonces", () => {
    const a = encrypt("secret"),
      b = encrypt("secret");
    expect(a).not.toBe(b);
    expect(a).not.toContain("secret");
    expect(decrypt(a)).toBe("secret");
  });
  it("detects tampering", () => {
    const data = Buffer.from(encrypt("secret"), "base64");
    data[13] ^= 1;
    expect(() => decrypt(data.toString("base64"))).toThrow();
  });
  it("checks origin", () =>
    expect(() =>
      originCheck(
        new Request("http://localhost:3000", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow());
});
