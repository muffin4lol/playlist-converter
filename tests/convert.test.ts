import { beforeEach, expect, it, vi } from "vitest";
const { create, connectionToken } = vi.hoisted(() => ({
  create: vi.fn(),
  connectionToken: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { transfer: { create } } }));
vi.mock("@/lib/auth", () => ({
  requireSession: vi.fn().mockResolvedValue({ id: "session", userId: "owner" }),
}));
vi.mock("@/lib/security", () => ({ originCheck: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/lib/platforms", () => ({ adapter: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/platforms/availability", () => ({
  platformAvailability: () => ({ youtube: true, spotify: true }),
}));
vi.mock("@/lib/platforms/connection", () => ({ connectionToken }));
import { POST } from "../src/app/api/convert/route";
const data = {
  version: 2,
  step: 3,
  source: "spotify",
  destination: "youtube",
  inputMode: "url",
  playlistId: "id",
  playlistName: "Mix",
  sourcePlaylistName: "Original",
  includeExplicit: true,
  cleanMode: "skip",
  tracks: [
    {
      id: "song",
      title: "Song",
      artist: "Artist",
      duration: 100000,
      explicit: false,
      selected: true,
    },
  ],
};
const request = (body: unknown) =>
  new Request("https://app.test/api/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  connectionToken.mockResolvedValue({ accessToken: "encrypted-at-rest" });
  create.mockResolvedValue({ id: "transfer" });
});
it("rejects a missing destination before creating history", async () => {
  expect((await POST(request({ ...data, destination: "" }))).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
it("rejects same-platform conversions", async () => {
  expect(
    (await POST(request({ ...data, destination: "spotify" }))).status,
  ).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
it("requires a connected destination before creating a transfer", async () => {
  connectionToken.mockRejectedValueOnce(
    new Error("Reconnect destination account"),
  );
  expect((await POST(request(data))).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
it("creates only an authorized direct transfer with source provenance", async () => {
  expect((await POST(request(data))).status).toBe(200);
  expect(connectionToken).toHaveBeenCalledWith(
    "owner",
    "session",
    "youtube",
    "destination",
  );
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        userId: "owner",
        sourceName: "Original",
        destination: "youtube",
      }),
    }),
  );
});
