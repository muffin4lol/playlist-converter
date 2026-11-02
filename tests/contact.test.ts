import { beforeEach, expect, it, vi } from "vitest";
const { sendMail, close, rateLimit, originCheck } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
  rateLimit: vi.fn(),
  originCheck: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail, close }) },
}));
vi.mock("@/lib/security", () => ({ rateLimit, originCheck }));
import { POST } from "../src/app/api/contact/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "https://app.test");
  vi.stubEnv("EMAIL_FROM", "Playlist Converter <sender@example.com>");
  vi.stubEnv("SMTP_URL", "smtps://example.invalid");
  vi.stubEnv("PUBLIC_SUPPORT_EMAIL", "");
});
const form = (data: Record<string, string>) =>
  new Request("https://app.test/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://app.test",
    },
    body: new URLSearchParams(data),
  });
it("sends only to the configured operator, with a validated reply address", async () => {
  const response = await POST(
    form({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Please help with my playlist",
      to: "arbitrary@example.com",
    }),
  );
  expect(response.headers.get("location")).toBe(
    "https://app.test/contact?sent=1",
  );
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "sender@example.com",
      replyTo: { name: "Visitor", address: "visitor@example.com" },
    }),
  );
  expect(close).toHaveBeenCalledOnce();
});
it("rejects invalid form fields without sending mail", async () => {
  const response = await POST(
    form({ name: "", email: "invalid", message: "short" }),
  );
  expect(response.headers.get("location")).toContain("error=1");
  expect(sendMail).not.toHaveBeenCalled();
});
it("rejects cross-origin submissions before sending mail", async () => {
  originCheck.mockImplementationOnce(() => {
    throw new Error("Invalid origin");
  });
  await POST(
    form({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Please help with my playlist",
    }),
  );
  expect(sendMail).not.toHaveBeenCalled();
});
