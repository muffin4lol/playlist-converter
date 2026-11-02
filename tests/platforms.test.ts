import { describe, it, expect, vi, afterEach } from "vitest";
import { spotify } from "../src/lib/platforms/spotify";
import { youtube } from "../src/lib/platforms/youtube";
import { soundcloud, mapSoundCloud } from "../src/lib/platforms/soundcloud";
import { deezer, mapDeezer } from "../src/lib/platforms/deezer";
import { tidal } from "../src/lib/platforms/tidal";
import { apple, mapApple } from "../src/lib/platforms/apple";
import { api } from "../src/lib/platforms/request";
const token = {
  accessToken: "test-access",
  expiresAt: Date.now() + 3600000,
  displayName: "Test",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("provider contracts", () => {
  it("Spotify uses PKCE and role-specific least privilege", () => {
    process.env.SPOTIFY_CLIENT_ID = "test";
    process.env.APP_URL = "https://app.example";
    const a = new URL(spotify.getAuthUrl("state", "challenge", "source"));
    expect(a.origin).toBe("https://accounts.spotify.com");
    expect(a.searchParams.get("code_challenge_method")).toBe("S256");
    expect(a.searchParams.get("scope")).not.toContain("modify");
    expect(
      new URL(
        spotify.getAuthUrl("state", "challenge", "destination"),
      ).searchParams.get("scope"),
    ).toBe("playlist-modify-private");
  });
  it("Google separates read and write scopes and binds state", () => {
    process.env.GOOGLE_CLIENT_ID = "test";
    process.env.GOOGLE_CLIENT_SECRET = "test";
    const url = new URL(youtube.getAuthUrl("bound-state", "pkce", "source"));
    expect(url.searchParams.get("state")).toBe("bound-state");
    expect(url.searchParams.get("scope")).toContain("youtube.readonly");
    expect(
      new URL(youtube.getAuthUrl("s", "c", "destination")).searchParams.get(
        "scope",
      ),
    ).toContain("youtube.force-ssl");
  });
  it("SoundCloud follows OAuth 2.1 PKCE without invented scopes", () => {
    process.env.SOUNDCLOUD_CLIENT_ID = "test";
    process.env.SOUNDCLOUD_CLIENT_SECRET = "test";
    const url = new URL(soundcloud.getAuthUrl("s", "c", "source"));
    expect(url.origin).toBe("https://secure.soundcloud.com");
    expect(url.searchParams.get("code_challenge")).toBe("c");
    expect(url.searchParams.has("scope")).toBe(false);
  });
  it("TIDAL avoids internal legacy scopes", () => {
    process.env.TIDAL_CLIENT_ID = "test";
    const url = new URL(tidal.getAuthUrl("s", "c", "destination"));
    expect(url.searchParams.get("scope")).toContain("playlists.write");
    expect(url.searchParams.get("scope")).not.toMatch(/r_usr|w_usr/);
  });
  it("Deezer requests manage_library only for write", () => {
    process.env.DEEZER_APP_ID = "test";
    process.env.DEEZER_APP_SECRET = "test";
    expect(
      new URL(deezer.getAuthUrl("s", "c", "source")).searchParams.get("perms"),
    ).toBe("basic_access");
    expect(
      new URL(deezer.getAuthUrl("s", "c", "destination")).searchParams.get(
        "perms",
      ),
    ).toContain("manage_library");
  });
  it("normalizes platform-specific explicit flags and durations", () => {
    expect(
      mapDeezer({
        id: 1,
        title: "Song",
        artist: { name: "Artist" },
        duration: 123,
        explicit_lyrics: true,
      }),
    ).toMatchObject({ duration: 123000, explicit: true });
    expect(
      mapApple({
        id: "1",
        attributes: {
          name: "Song",
          artistName: "Artist",
          contentRating: "clean",
          durationInMillis: 123000,
        },
      }).explicit,
    ).toBe(false);
    expect(
      mapSoundCloud({
        id: 1,
        title: "Song",
        duration: 123000,
        user: { username: "Artist" },
      }).explicit,
    ).toBeNull();
  });
  it("Apple Music uses MusicKit instead of fake OAuth", () => {
    expect(apple.mode).toBe("musickit");
    expect(() => apple.getAuthUrl("s", "c", "source")).toThrow("MusicKit");
  });
  it("writes private YouTube playlists", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "new" })));
    vi.stubGlobal("fetch", fetcher);
    await youtube.createPlaylist(token, "My playlist");
    const init = fetcher.mock.calls[0][1];
    expect(JSON.parse(init.body).status.privacyStatus).toBe("private");
  });
  it("SoundCloud appends without replacing existing tracks", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tracks: [{ id: 1 }] })),
      )
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    await soundcloud.addTracks(token, "p", ["2"]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).playlist.tracks).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });
});
describe("safe provider retries", () => {
  it("does not retry an ambiguous server error on a write", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      api("https://provider.example", { method: "POST" }),
    ).rejects.toThrow("500");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("backs off on rate limits then succeeds", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "Retry-After": "1" } }),
      )
      .mockResolvedValueOnce(new Response('{"ok":true}'));
    vi.stubGlobal("fetch", fetcher);
    const result = api<{ ok: boolean }>("https://provider.example");
    await vi.runAllTimersAsync();
    expect((await result).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
