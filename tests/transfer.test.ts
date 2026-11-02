import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, provider, token, rows } = vi.hoisted(() => ({
  db: {
    transfer: {
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
    },
    transferTrack: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  provider: {
    id: "spotify",
    createPlaylist: vi.fn(),
    searchTrack: vi.fn(),
    addTracks: vi.fn(),
  },
  token: vi.fn(),
  rows: [] as {
    id: string;
    sourceId: string;
    title: string;
    artist: string;
    duration: number;
    isrc: string;
    explicit: boolean;
    selected: boolean;
    result: string;
    destinationId?: string;
    confidence?: number;
  }[],
}));
vi.mock("../src/lib/db", () => ({ db }));
vi.mock("../src/lib/platforms", () => ({ adapter: () => provider }));
vi.mock("../src/lib/platforms/connection", () => ({ connectionToken: token }));
import { tick } from "../src/lib/transfer";
beforeEach(() => {
  vi.resetAllMocks();
  rows.length = 0;
  rows.push({
    id: "row",
    sourceId: "song",
    title: "Song",
    artist: "Artist",
    duration: 120000,
    isrc: "CODE",
    explicit: false,
    selected: true,
    result: "pending",
  });
  db.transfer.updateMany.mockResolvedValue({ count: 1 });
  token.mockResolvedValue({ accessToken: "test" });
  db.transfer.findFirstOrThrow.mockImplementation(async () => ({
    id: "t",
    source: "youtube",
    sourceName: "Original mix",
    destination: "spotify",
    destinationName: "New mix",
    destinationId: "playlist",
    includeExplicit: true,
    cleanMode: "skip",
    tracks: rows.map((x) => ({ ...x })),
  }));
  db.transferTrack.findMany.mockImplementation(async () =>
    rows.map((x) => ({ ...x })),
  );
  db.transferTrack.update.mockImplementation(async ({ where, data }) =>
    Object.assign(
      rows.find((x) => x.id === where.id)!,
      data,
    ),
  );
  db.transferTrack.updateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const row of rows) {
      if (
        where.id.in.includes(row.id) &&
        where.result.in.includes(row.result)
      ) {
        Object.assign(row, data);
        count++;
      }
    }
    return { count };
  });
  provider.searchTrack.mockResolvedValue([{ ...rows[0], id: "dest-song" }]);
  provider.createPlaylist.mockResolvedValue({
    id: "new-playlist",
    url: "https://destination.test/playlist",
  });
});
describe("direct destination transfer jobs", () => {
  it("does not work while another request holds the lease", async () => {
    db.transfer.updateMany.mockResolvedValue({ count: 0 });
    await tick("owner", "session", "t");
    expect(provider.addTracks).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
  });
  it("requires a destination account and never reports a file-only success", async () => {
    token.mockRejectedValue(new Error("Reconnect destination account"));
    await tick("owner", "session", "t");
    expect(provider.createPlaylist).not.toHaveBeenCalled();
    expect(provider.addTracks).not.toHaveBeenCalled();
    expect(db.transfer.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending",
          error: expect.stringContaining("Reconnect"),
        }),
      }),
    );
  });
  it("records write intent before adding matched tracks", async () => {
    await tick("owner", "session", "t");
    expect(provider.addTracks).toHaveBeenCalledWith(
      { accessToken: "test" },
      "playlist",
      ["dest-song"],
    );
    expect(
      db.transferTrack.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(provider.addTracks.mock.invocationCallOrder[0]);
    expect(rows[0].result).toBe("matched");
  });
  it("creates the playlist with source provenance", async () => {
    const original = db.transfer.findFirstOrThrow.getMockImplementation()!;
    db.transfer.findFirstOrThrow.mockImplementation(async () => ({
      ...(await original()),
      destinationId: null,
    }));
    await tick("owner", "session", "t");
    expect(provider.createPlaylist).toHaveBeenCalledWith(
      { accessToken: "test" },
      "New mix",
      "Created with Playlist Converter • Imported from YouTube Music: Original mix",
    );
    expect(provider.addTracks).toHaveBeenCalledWith(
      expect.anything(),
      "new-playlist",
      ["dest-song"],
    );
  });
  it("stops ambiguous writes instead of retrying or duplicating", async () => {
    provider.addTracks.mockRejectedValue(new Error("network interrupted"));
    await tick("owner", "session", "t");
    expect(rows[0].result).toBe("adding");
    expect(db.transfer.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
    await tick("owner", "session", "t");
    expect(provider.addTracks).toHaveBeenCalledTimes(1);
  });
  it("never recreates an interrupted destination playlist", async () => {
    db.transfer.findFirstOrThrow.mockResolvedValue({
      source: "youtube",
      destination: "spotify",
      destinationId: "__creation_pending__",
      tracks: rows,
    });
    await tick("owner", "session", "t");
    expect(provider.createPlaylist).not.toHaveBeenCalled();
    expect(provider.addTracks).not.toHaveBeenCalled();
  });
  it("adds multiple prepared songs as one ordered batch", async () => {
    rows.length = 0;
    for (let i = 0; i < 4; i++)
      rows.push({
        id: String(i),
        sourceId: String(i),
        title: "Song",
        artist: "Artist",
        duration: 120000,
        isrc: "CODE",
        explicit: false,
        selected: true,
        result: "ready",
        destinationId: `destination-${i}`,
        confidence: 1,
      });
    await tick("owner", "session", "t");
    expect(provider.addTracks).toHaveBeenCalledWith(
      expect.anything(),
      "playlist",
      ["destination-0", "destination-1", "destination-2", "destination-3"],
    );
    expect(rows.every((x) => x.result === "matched")).toBe(true);
  });
});
