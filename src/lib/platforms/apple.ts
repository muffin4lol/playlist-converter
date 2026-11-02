import type { PlatformAdapter, Track, Token } from "./types";
import { api } from "./request";
const base = "https://api.music.apple.com";
const storefront = () => process.env.APPLE_MUSIC_STOREFRONT || "us";
export function appleHeaders(t: Token) {
  if (!process.env.APPLE_MUSIC_DEVELOPER_TOKEN)
    throw new Error("Apple Music is not configured");
  return {
    Authorization: `Bearer ${process.env.APPLE_MUSIC_DEVELOPER_TOKEN}`,
    "Music-User-Token": t.accessToken,
    "Content-Type": "application/json",
  };
}
type Song = {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    durationInMillis?: number;
    isrc?: string;
    contentRating?: string;
  };
};
type Page<T> = { data: T[]; next?: string };
export const mapApple = (x: Song): Track => ({
  id: x.id,
  title: x.attributes.name,
  artist: x.attributes.artistName,
  duration: x.attributes.durationInMillis || 0,
  isrc: x.attributes.isrc,
  explicit:
    x.attributes.contentRating === "explicit"
      ? true
      : x.attributes.contentRating === "clean"
        ? false
        : null,
  selected: true,
});
async function pages<T>(path: string, t: Token) {
  const out: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const url = new URL(next, base);
    if (url.origin !== base) throw new Error("Invalid platform pagination URL");
    const page: Page<T> = await api(url.href, { headers: appleHeaders(t) });
    out.push(...page.data);
    next = page.next;
  }
  return out;
}
export const apple: PlatformAdapter = {
  id: "apple",
  name: "Apple Music",
  mode: "musickit",
  getAuthUrl() {
    throw new Error(
      "Apple Music requires MusicKit authorization in your browser",
    );
  },
  async handleCallback() {
    throw new Error("Apple Music uses MusicKit, not an OAuth callback");
  },
  async fetchUserPlaylists(t) {
    const p = await pages<{ id: string; attributes: { name: string } }>(
      base + "/v1/me/library/playlists?limit=100",
      t,
    );
    return p.map((x) => ({ id: x.id, name: x.attributes.name, count: 0 }));
  },
  async fetchPlaylist(t, id) {
    const catalog = id.startsWith("pl.");
    const prefix = catalog
      ? `/v1/catalog/${storefront()}/playlists/`
      : "/v1/me/library/playlists/";
    const p = await api<Page<{ attributes: { name: string } }>>(
      base + prefix + encodeURIComponent(id),
      { headers: appleHeaders(t) },
    );
    const songs = await pages<Song>(
      base + prefix + encodeURIComponent(id) + "/tracks?limit=100",
      t,
    );
    return {
      name: p.data[0]?.attributes.name || "Apple Music playlist",
      tracks: songs.map(mapApple),
    };
  },
  async searchTrack(t, track, clean) {
    if (track.isrc && !clean) {
      const p = await api<Page<Song>>(
        base +
          `/v1/catalog/${storefront()}/songs?` +
          new URLSearchParams({ "filter[isrc]": track.isrc }),
        { headers: appleHeaders(t) },
      );
      if (p.data.length) return p.data.map(mapApple);
    }
    const p = await api<{ results: { songs?: Page<Song> } }>(
      base +
        `/v1/catalog/${storefront()}/search?` +
        new URLSearchParams({
          term: `${track.title} ${track.artist}${clean ? " clean" : ""}`,
          types: "songs",
          limit: "10",
        }),
      { headers: appleHeaders(t) },
    );
    return (p.results.songs?.data || [])
      .map(mapApple)
      .filter((x) => !clean || x.explicit === false);
  },
  async createPlaylist(t, name) {
    const p = await api<Page<{ id: string; attributes: { url?: string } }>>(
      base + "/v1/me/library/playlists",
      {
        method: "POST",
        headers: appleHeaders(t),
        body: JSON.stringify({
          attributes: {
            name,
            description: "Transferred with Playlist Converter",
          },
        }),
      },
    );
    const playlist = p.data[0];
    return {
      id: playlist.id,
      url:
        playlist.attributes.url ||
        "https://music.apple.com/library/playlist/" + playlist.id,
    };
  },
  async addTracks(t, id, ids) {
    for (let i = 0; i < ids.length; i += 100)
      await api(
        base + "/v1/me/library/playlists/" + encodeURIComponent(id) + "/tracks",
        {
          method: "POST",
          headers: appleHeaders(t),
          body: JSON.stringify({
            data: ids.slice(i, i + 100).map((id) => ({ id, type: "songs" })),
          }),
        },
      );
  },
  async revoke() {
    /* MusicKit unauthorize() handles browser consent; local encrypted token is deleted server-side. */
  },
};
