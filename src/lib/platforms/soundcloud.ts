import type { PlatformAdapter, Track } from "./types";
import { api } from "./request";
type SCTrack = {
  id: number;
  urn?: string;
  title: string;
  duration: number;
  user: { username: string };
  metadata_artist?: string;
  publisher_metadata?: { isrc?: string; explicit?: boolean };
};
type SCPlaylist = {
  id: number;
  title: string;
  track_count: number;
  permalink_url: string;
  tracks: SCTrack[];
};
const base = "https://api.soundcloud.com";
const callback = () =>
  `${process.env.APP_URL}/api/platforms/soundcloud/callback`;
const headers = (t: { accessToken: string }) => ({
  Authorization: `OAuth ${t.accessToken}`,
  "Content-Type": "application/json",
});
export const mapSoundCloud = (x: SCTrack): Track => ({
  id: String(x.id),
  title: x.title,
  artist: x.metadata_artist || x.user.username,
  duration: x.duration,
  isrc: x.publisher_metadata?.isrc,
  explicit: x.publisher_metadata?.explicit ?? null,
  selected: true,
});
export const soundcloud: PlatformAdapter = {
  id: "soundcloud",
  name: "SoundCloud",
  mode: "oauth",
  getAuthUrl(state, challenge) {
    if (
      !process.env.SOUNDCLOUD_CLIENT_ID ||
      !process.env.SOUNDCLOUD_CLIENT_SECRET
    )
      throw new Error("SoundCloud is not configured");
    return (
      "https://secure.soundcloud.com/authorize?" +
      new URLSearchParams({
        client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        redirect_uri: callback(),
        response_type: "code",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      })
    );
  },
  async handleCallback(code, verifier) {
    const t = await api<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
        client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
        redirect_uri: callback(),
      }),
    });
    const me = await api<{ username: string; avatar_url?: string }>(
      base + "/me",
      { headers: headers({ accessToken: t.access_token }) },
    );
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      displayName: me.username,
      avatar: me.avatar_url,
    };
  },
  async refreshToken(token) {
    const t = await api<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("https://secure.soundcloud.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
        client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
        ...(process.env.SOUNDCLOUD_CLIENT_SECRET
          ? { client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET! }
          : {}),
      }),
    });
    return {
      ...token,
      accessToken: t.access_token,
      refreshToken: t.refresh_token || token.refreshToken,
      expiresAt: Date.now() + t.expires_in * 1000,
    };
  },
  async fetchUserPlaylists(t) {
    const out = [];
    let url: string | null =
      base +
      "/me/playlists?show_tracks=false&linked_partitioning=true&limit=50";
    while (url) {
      const p: { collection: SCPlaylist[]; next_href?: string } = await api(
        url,
        { headers: headers(t) },
      );
      out.push(
        ...p.collection.map((x) => ({
          id: String(x.id),
          name: x.title,
          count: x.track_count,
        })),
      );
      url = p.next_href || null;
    }
    return out;
  },
  async fetchPlaylist(t, id) {
    const p = await api<SCPlaylist>(
      base + "/playlists/" + encodeURIComponent(id),
      { headers: headers(t) },
    );
    if (p.track_count > 1000 || p.tracks.length > 1000)
      throw new Error("Playlist exceeds the supported 1,000-track limit");
    const tracks: Track[] = [];
    for (let i = 0; i < p.tracks.length; i += 50) {
      const batch = p.tracks.slice(i, i + 50);
      const complete = await api<SCTrack[]>(
        base + "/tracks?ids=" + batch.map((x) => x.id).join(","),
        { headers: headers(t) },
      );
      const byId = new Map(complete.map((x) => [x.id, x]));
      for (const x of batch) {
        const full = byId.get(x.id);
        if (full) tracks.push(mapSoundCloud(full));
      }
    }
    return { name: p.title, tracks };
  },
  async searchTrack(t, track, clean) {
    const p = await api<{ collection: SCTrack[] }>(
      base +
        "/tracks?" +
        new URLSearchParams({
          q: `${track.title} ${track.artist}${clean ? " clean" : ""}`,
          limit: "10",
          linked_partitioning: "true",
        }),
      { headers: headers(t) },
    );
    return p.collection
      .map(mapSoundCloud)
      .filter((x) => !clean || x.explicit === false);
  },
  async createPlaylist(
    t,
    name,
    description = "Created with Playlist Converter",
  ) {
    const p = await api<SCPlaylist>(base + "/playlists", {
      method: "POST",
      headers: headers(t),
      body: JSON.stringify({
        playlist: { title: name, description, sharing: "private", tracks: [] },
      }),
    });
    return { id: String(p.id), url: p.permalink_url };
  },
  async addTracks(t, id, ids) {
    const current = await api<SCPlaylist>(
      base + "/playlists/" + encodeURIComponent(id),
      { headers: headers(t) },
    );
    await api(base + "/playlists/" + encodeURIComponent(id), {
      method: "PUT",
      headers: headers(t),
      body: JSON.stringify({
        playlist: {
          tracks: [
            ...current.tracks.map((x) => ({ id: x.id })),
            ...ids.map((id) => ({ id: Number(id) })),
          ],
        },
      }),
    });
  },
  async revoke(t) {
    await api(base + "/disconnect", { method: "POST", headers: headers(t) });
  },
};
