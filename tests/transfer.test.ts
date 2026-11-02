import { describe, it, expect, vi, beforeEach } from "vitest";
const { db, provider } = vi.hoisted(() => ({
  db: {
    transfer: {
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
    },
    transferTrack: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    platformConnection: { findFirst: vi.fn() },
  },
  provider: {
    mode: "oauth",
    createPlaylist: vi.fn(),
    searchTrack: vi.fn(),
    addTracks: vi.fn(),
  },
}));
vi.mock("../src/lib/db", () => ({ db }));
vi.mock("../src/lib/platforms", () => ({ adapter: () => provider }));
vi.mock("../src/lib/security", () => ({
  decrypt: () => JSON.stringify({ accessToken: "test" }),
}));
import { tick } from "../src/lib/transfer";
const track = {
  id: "row",
  sourceId: "song",
  title: "Song",
  artist: "Artist",
  duration: 120000,
  isrc: "CODE",
  explicit: false,
  selected: true,
  result: "pending",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.transfer.updateMany.mockResolvedValue({ count: 1 });
  db.transferTrack.updateMany.mockResolvedValue({ count: 1 });
  db.platformConnection.findFirst.mockResolvedValue({
    encryptedToken: "encrypted",
  });
  db.transfer.findFirstOrThrow.mockResolvedValue({
    id: "t",
    destination: "spotify",
    destinationMode: "direct",
    destinationId: "playlist",
    includeExplicit: true,
    cleanMode: "skip",
    tracks: [track],
  });
  db.transferTrack.findMany.mockResolvedValue([
    { ...track, result: "matched" },
  ]);
  provider.searchTrack.mockResolvedValue([
    {
      id: "dest-song",
      title: "Song",
      artist: "Artist",
      duration: 120000,
      isrc: "CODE",
      explicit: false,
      selected: true,
    },
  ]);
});
describe("persisted transfer jobs", () => {
  it("does not work when another request holds the lease", async () => {
    db.transfer.updateMany.mockResolvedValue({ count: 0 });
    await tick("owner", "session", "t");
    expect(provider.addTracks).not.toHaveBeenCalled();
    expect(db.transfer.findFirstOrThrow).not.toHaveBeenCalled();
  });
  it("records intent before remote writes", async () => {
    await tick("owner", "session", "t");
    expect(db.transferTrack.updateMany.mock.calls[0][0].data.result).toBe(
      "adding",
    );
    expect(provider.addTracks).toHaveBeenCalledWith(
      expect.anything(),
      "playlist",
      ["dest-song"],
    );
    expect(
      db.transferTrack.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(provider.addTracks.mock.invocationCallOrder[0]);
  });
  it("stops after an ambiguous write", async () => {
    provider.addTracks.mockRejectedValue(new Error("network interrupted"));
    await tick("owner", "session", "t");
    expect(db.transfer.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "t", userId: "owner" },
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(provider.addTracks).toHaveBeenCalledTimes(1);
  });
  it("never recreates a playlist after interrupted creation", async () => {
    db.transfer.findFirstOrThrow.mockResolvedValue({
      destination: "spotify",
      destinationId: "__creation_pending__",
      tracks: [track],
    });
    await tick("owner", "session", "t");
    expect(provider.createPlaylist).not.toHaveBeenCalled();
    expect(provider.addTracks).not.toHaveBeenCalled();
  });
  it("exports CSV without provider credentials", async () => {
    db.transfer.findFirstOrThrow.mockResolvedValue({
      destination: "spotify",
      destinationMode: "csv",
      tracks: [track],
    });
    await tick("owner", "session", "t");
    expect(db.platformConnection.findFirst).not.toHaveBeenCalled();
    expect(provider.addTracks).not.toHaveBeenCalled();
    expect(db.transferTrack.update).toHaveBeenCalledWith({
      where: { id: "row" },
      data: { result: "exported", confidence: null },
    });
  });
});
