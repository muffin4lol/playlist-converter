import type { PlatformAdapter, Track } from "./types";
import { api } from "./request";
type DTrack = {
  id: number;
  title: string;
  artist: { name: string };
  duration: number;
  isrc?: string;
  explicit_lyrics?: boolean;
};
type DPlaylist = { id: number; title: string; nb_tracks: number; link: string };
const base = "https://api.deezer.com";
const callback = () => `${process.env.APP_URL}/api/platforms/deezer/callback`;
const url = (path: string, token: string, extra: Record<string, string> = {}) =>
  base + path + "?" + new URLSearchParams({ access_token: token, ...extra });
async function deezerApi<T>(url: string, init: RequestInit = {}): Promise<T> {
  const data = await api<T & { error?: { message: string } }>(url, init);
  if (data.error)
    throw new Error("Deezer request failed. Check provider permissions.");
  return data;
}
export const mapDeezer = (x: DTrack): Track => ({
  id: String(x.id),
  title: x.title,
  artist: x.artist.name,
  duration: x.duration * 1000,
  isrc: x.isrc,
  explicit: x.explicit_lyrics ?? null,
  selected: true,
});
export const deezer: PlatformAdapter = {
  id: "deezer",
  name: "Deezer",
  mode: "oauth",
  getAuthUrl(state, _challenge, role) {
    if (!process.env.DEEZER_APP_ID || !process.env.DEEZER_APP_SECRET)
      throw new Error("Deezer is not configured");
    return (
      "https://connect.deezer.com/oauth/auth.php?" +
      new URLSearchParams({
        app_id: process.env.DEEZER_APP_ID,
        redirect_uri: callback(),
        state,
        perms:
          role === "source" ? "basic_access" : "basic_access,manage_library",
      })
    );
  },
  async handleCallback(code) {
    const t = await deezerApi<{ access_token: string; expires: number }>(
      "https://connect.deezer.com/oauth/access_token.php?" +
        new URLSearchParams({
          app_id: process.env.DEEZER_APP_ID!,
          secret: process.env.DEEZER_APP_SECRET!,
          code,
          output: "json",
        }),
    );
    if (!t.access_token) throw new Error("Deezer authorization failed");
    const me = await deezerApi<{ name: string; picture_small?: string }>(
      url("/user/me", t.access_token),
    );
    return {
      accessToken: t.access_token,
      expiresAt: Date.now() + Math.min(t.expires || 86400, 86400) * 1000,
      displayName: me.name,
      avatar: me.picture_small,
    };
  },
  async fetchUserPlaylists(t) {
    const out = [];
    let next: string | null = url("/user/me/playlists", t.accessToken, {
      limit: "100",
    });
    while (next) {
      const p: { data: DPlaylist[]; next?: string } = await deezerApi(next);
      out.push(
        ...p.data.map((x) => ({
          id: String(x.id),
          name: x.title,
          count: x.nb_tracks,
        })),
      );
      next = p.next || null;
    }
    return out;
  },
  async fetchPlaylist(t, id) {
    const p = await deezerApi<DPlaylist>(
      url("/playlist/" + encodeURIComponent(id), t.accessToken),
    );
    const tracks: Track[] = [];
    let next: string | null = url(
      "/playlist/" + encodeURIComponent(id) + "/tracks",
      t.accessToken,
      { limit: "100" },
    );
    while (next) {
      const page: { data: DTrack[]; next?: string } = await deezerApi(next);
      tracks.push(...page.data.map(mapDeezer));
      next = page.next || null;
    }
    return { name: p.title, tracks };
  },
  async searchTrack(t, track, clean) {
    if (track.isrc && !clean) {
      const res = await fetch(
        url("/track/isrc:" + encodeURIComponent(track.isrc), t.accessToken),
        { signal: AbortSignal.timeout(15000) },
      );
      if (res.ok) {
        const x = await res.json();
        if (x.id) return [mapDeezer(x)];
      }
    }
    const p = await deezerApi<{ data: DTrack[] }>(
      url("/search", t.accessToken, {
        q: `track:"${track.title.replaceAll('"', "")}" artist:"${track.artist.replaceAll('"', "")}"`,
        limit: "10",
      }),
    );
    return p.data.map(mapDeezer).filter((x) => !clean || x.explicit === false);
  },
  async createPlaylist(t, name) {
    const p = await deezerApi<{ id: number }>(
      url("/user/me/playlists", t.accessToken),
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ title: name }),
      },
    );
    return { id: String(p.id), url: "https://www.deezer.com/playlist/" + p.id };
  },
  async addTracks(t, id, ids) {
    await deezerApi(
      url("/playlist/" + encodeURIComponent(id) + "/tracks", t.accessToken),
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ songs: ids.join(",") }),
      },
    );
  },
  async revoke(t) {
    await deezerApi(url("/user/me/permissions", t.accessToken), {
      method: "DELETE",
    });
  },
};
