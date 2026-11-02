import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/platforms/request", () => ({
  api,
  bearer: (t: string) => ({ Authorization: `Bearer ${t}` }),
}));
import { youtube } from "../src/lib/platforms/youtube";
import { spotify } from "../src/lib/platforms/spotify";
import { apple } from "../src/lib/platforms/apple";
beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
it("reads a public YouTube playlist with an API key, without a user token, preserving order", async () => {
  vi.stubEnv("YOUTUBE_API_KEY", "test-server-key");
  api
    .mockResolvedValueOnce({ items: [{ snippet: { title: "Public mix" } }] })
    .mockResolvedValueOnce({
      items: [
        { contentDetails: { videoId: "a" } },
        { contentDetails: { videoId: "b" } },
      ],
    })
    .mockResolvedValueOnce({
      items: [
        {
          id: "b",
          snippet: { title: "Second", channelTitle: "Artist" },
          contentDetails: { duration: "PT3M" },
        },
        {
          id: "a",
          snippet: { title: "First", channelTitle: "Artist" },
          contentDetails: { duration: "PT2M" },
        },
      ],
    });
  const playlist = await youtube.fetchPublicPlaylist!("PLtest");
  expect(playlist.tracks.map((t) => t.id)).toEqual(["a", "b"]);
  expect(playlist.tracks.map((t) => t.duration)).toEqual([120000, 180000]);
  for (const [url, init] of api.mock.calls) {
    expect(new URL(url).searchParams.get("key")).toBe("test-server-key");
    expect(init.headers).not.toHaveProperty("Authorization");
  }
});
it("rejects unavailable/private YouTube playlists", async () => {
  vi.stubEnv("YOUTUBE_API_KEY", "test-server-key");
  api.mockResolvedValueOnce({ items: [] });
  await expect(youtube.fetchPublicPlaylist!("private")).rejects.toThrow(
    /private/,
  );
});
it("uses server application credentials for public Spotify reads", async () => {
  vi.stubEnv("SPOTIFY_CLIENT_ID", "client");
  vi.stubEnv("SPOTIFY_CLIENT_SECRET", "server-secret");
  api
    .mockResolvedValueOnce({
      access_token: "application-token",
      expires_in: 3600,
    })
    .mockResolvedValueOnce({ name: "Public playlist" })
    .mockResolvedValueOnce({ items: [], next: null });
  await spotify.fetchPublicPlaylist!("public-id");
  expect(api.mock.calls[0][1].body.get("grant_type")).toBe(
    "client_credentials",
  );
  expect(api.mock.calls[1][1].headers.Authorization).toBe(
    "Bearer application-token",
  );
});
it("uses only the developer token for public Apple catalog playlists", async () => {
  vi.stubEnv("APPLE_MUSIC_DEVELOPER_TOKEN", "developer-token");
  api
    .mockResolvedValueOnce({ data: [{ attributes: { name: "Catalog mix" } }] })
    .mockResolvedValueOnce({ data: [] });
  await apple.fetchPublicPlaylist!("pl.test", "ie");
  for (const [url, init] of api.mock.calls) {
    expect(url).toContain("/v1/catalog/ie/playlists/pl.test");
    expect(init.headers.Authorization).toBe("Bearer developer-token");
    expect(init.headers).not.toHaveProperty("Music-User-Token");
  }
});
