import type { PlatformAdapter, Track, Token } from "./types";
import { api, bearer } from "./request";
type Item = {
  id: string;
  name: string;
  artists: { name: string }[];
  duration_ms: number;
  album?: { name: string };
  explicit: boolean;
  external_ids?: { isrc?: string };
};
const map = (t: Item): Track => ({
  id: t.id,
  title: t.name,
  artist: t.artists.map((a) => a.name).join(", "),
  duration: t.duration_ms,
  album: t.album?.name,
  isrc: t.external_ids?.isrc,
  explicit: t.explicit,
  selected: true,
});
const base = "https://api.spotify.com/v1";
const callback = () => `${process.env.APP_URL}/api/platforms/spotify/callback`;
export const spotify: PlatformAdapter = {
  id: "spotify",
  name: "Spotify",
  mode: "oauth",
  getAuthUrl(state, challenge, role) {
    if (!process.env.SPOTIFY_CLIENT_ID)
      throw new Error("Spotify is not configured");
    return (
      "https://accounts.spotify.com/authorize?" +
      new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID,
        response_type: "code",
        redirect_uri: callback(),
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        scope:
          role === "source"
            ? "playlist-read-private playlist-read-collaborative"
            : "playlist-modify-private",
      })
    );
  },
  async handleCallback(code, verifier) {
    const t = await api<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callback(),
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        code_verifier: verifier,
      }),
    });
    const me = await api<{ display_name: string; images: { url: string }[] }>(
      base + "/me",
      { headers: bearer(t.access_token) },
    );
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      displayName: me.display_name,
      avatar: me.images?.[0]?.url,
    };
  },
  async refreshToken(token) {
    const t = await api<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
      }),
    });
    return {
      ...token,
      accessToken: t.access_token,
      refreshToken: t.refresh_token || token.refreshToken,
      expiresAt: Date.now() + t.expires_in * 1000,
    };
  },
  async fetchPublicPlaylist(id) {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET)
      throw new Error(
        "Public Spotify links require server-side app credentials. Connect your source account instead.",
      );
    const t = await api<{ access_token: string; expires_in: number }>(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.SPOTIFY_CLIENT_ID +
                ":" +
                process.env.SPOTIFY_CLIENT_SECRET,
            ).toString("base64"),
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      },
    );
    return spotify.fetchPlaylist(
      {
        accessToken: t.access_token,
        expiresAt: Date.now() + t.expires_in * 1000,
        displayName: "Public catalog",
      },
      id,
    );
  },
  async fetchUserPlaylists(t) {
    const out = [];
    let url: string | null = base + "/me/playlists?limit=50";
    while (url) {
      const p: {
        items: {
          id: string;
          name: string;
          tracks?: { total: number };
          items?: { total: number };
          images: { url: string }[];
        }[];
        next: string | null;
      } = await api(url, { headers: bearer(t.accessToken) });
      out.push(
        ...p.items.map((i) => ({
          id: i.id,
          name: i.name,
          count: i.tracks?.total ?? i.items?.total ?? 0,
          image: i.images?.[0]?.url,
        })),
      );
      url = p.next;
    }
    return out;
  },
  async fetchPlaylist(t, id) {
    const p = await api<{ name: string }>(
      base + "/playlists/" + encodeURIComponent(id),
      { headers: bearer(t.accessToken) },
    );
    const tracks: Track[] = [];
    let url: string | null =
      base + "/playlists/" + encodeURIComponent(id) + "/items?limit=100";
    while (url) {
      const page: {
        items: { track?: Item; item?: Item }[];
        next: string | null;
      } = await api(url, { headers: bearer(t.accessToken) });
      for (const entry of page.items) {
        const x = entry.item ?? entry.track;
        if (x?.id) tracks.push(map(x));
      }
      if (tracks.length > 1000)
        throw new Error("Playlist exceeds the supported 1,000-track limit");
      url = page.next;
    }
    return { name: p.name, tracks };
  },
  async searchTrack(t, track, clean) {
    const q =
      !clean && track.isrc
        ? `isrc:${track.isrc}`
        : `track:${track.title} artist:${track.artist}`;
    const p = await api<{ tracks: { items: Item[] } }>(
      base +
        "/search?" +
        new URLSearchParams({ q, type: "track", limit: "10" }),
      { headers: bearer(t.accessToken) },
    );
    return p.tracks.items
      .map(map)
      .filter((x) => !clean || x.explicit === false);
  },
  async createPlaylist(
    t,
    name,
    description = "Created with Playlist Converter",
  ) {
    const p = await api<{ id: string; external_urls: { spotify: string } }>(
      base + "/me/playlists",
      {
        method: "POST",
        headers: {
          ...bearer(t.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          public: false,
          description,
        }),
      },
    );
    return { id: p.id, url: p.external_urls.spotify };
  },
  async addTracks(t, id, ids) {
    for (let i = 0; i < ids.length; i += 100)
      await api(base + "/playlists/" + encodeURIComponent(id) + "/items", {
        method: "POST",
        headers: {
          ...bearer(t.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: ids.slice(i, i + 100).map((x) => "spotify:track:" + x),
        }),
      });
  },
  async revoke(_t: Token) {
    /* Spotify has no token revocation endpoint. Deleting the encrypted token disconnects locally; remove consent at spotify.com/account/apps. */ void _t;
  },
};
