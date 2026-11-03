import { beforeEach, expect, it, vi } from "vitest";
const { auth, db } = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    wizardState: { deleteMany: vi.fn() },
    transfer: { deleteMany: vi.fn() },
    platformConnection: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ requireSession: auth }));
vi.mock("@/lib/db", () => ({ db }));
import { DELETE } from "../src/app/api/wizard/route";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = "https://app.test";
  auth.mockResolvedValue({ userId: "owner" });
  db.wizardState.deleteMany.mockResolvedValue({ count: 1 });
});
const request = (origin = "https://app.test") =>
  new Request("https://app.test/api/wizard", {
    method: "DELETE",
    headers: { origin },
  });
it("new transfer discards only this user's draft, preserving history and connections", async () => {
  expect((await DELETE(request())).status).toBe(200);
  expect(db.wizardState.deleteMany).toHaveBeenCalledWith({
    where: { userId: "owner" },
  });
  expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  expect(db.platformConnection.deleteMany).not.toHaveBeenCalled();
});
it("reset is safe when there is no existing draft", async () => {
  db.wizardState.deleteMany.mockResolvedValue({ count: 0 });
  expect((await DELETE(request())).status).toBe(200);
});
it("rejects signed-out resets", async () => {
  auth.mockRejectedValue(new Error("Unauthorized"));
  expect((await DELETE(request())).status).toBe(401);
  expect(db.wizardState.deleteMany).not.toHaveBeenCalled();
});
it("rejects cross-origin resets", async () => {
  expect((await DELETE(request("https://evil.test"))).status).toBe(400);
  expect(db.wizardState.deleteMany).not.toHaveBeenCalled();
});
