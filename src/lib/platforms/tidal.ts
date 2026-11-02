import type { PlatformAdapter, Track, Token } from "./types";
import { api, bearer } from "./request";
type Resource = {
  id: string;
  type: string;
  attributes?: {
    title?: string;
    name?: string;
    username?: string;
    country?: string;
    duration?: string;
    explicit?: boolean;
    isrc?: string;
    numberOfItems?: number;
    externalLinks?: { href: string }[];
  };
  relationships?: { artists?: { data: { id: string }[] } };
};
type Doc = {
  data: Resource[];
  included?: Resource[];
  links?: { next?: string | { href: string } };
};
const base = "https://openapi.tidal.com/v2";
const callback = () => `${process.env.APP_URL}/api/platforms/tidal/callback`;
const headers = (t: Token) => ({
  ...bearer(t.accessToken),
  "Content-Type": "application/vnd.api+json",
  Accept: "application/vnd.api+json",
});
const country = () => process.env.TIDAL_COUNTRY_CODE || "US";
function map(x: Resource, included: Resource[]): Track {
  const a = x.attributes || {},
    duration = a.duration?.match(
      /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/,
    );
  return {
    id: x.id,
    title: a.title || "Unknown title",
    artist:
      (x.relationships?.artists?.data || [])
        .map(
          (ref) =>
            included.find((y) => y.id === ref.id && y.type === "artists")
              ?.attributes?.name,
        )
        .filter(Boolean)
        .join(", ") || "Unknown artist",
    duration: duration
      ? ((+duration[1] || 0) * 3600 +
          (+duration[2] || 0) * 60 +
          (+duration[3] || 0)) *
        1000
      : 0,
    isrc: a.isrc,
    explicit: a.explicit ?? null,
    selected: true,
  };
}
function next(doc: Doc) {
  const n = doc.links?.next;
  if (!n) return null;
  const url = new URL(typeof n === "string" ? n : n.href, base + "/");
  if (url.origin !== new URL(base).origin)
    throw new Error("Invalid platform pagination URL");
  return url.href;
}
async function hydrate(t: Token, ids: string[]) {
  const out: Track[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const p = await api<Doc>(
      base +
        "/tracks?" +
        new URLSearchParams({
          "filter[id]": ids.slice(i, i + 20).join(","),
          include: "artists",
          countryCode: country(),
        }),
      { headers: headers(t) },
    );
    const byId = new Map(p.data.map((x) => [x.id, map(x, p.included || [])]));
    for (const id of ids.slice(i, i + 20)) {
      const item = byId.get(id);
      if (item) out.push(item);
    }
  }
  return out;
}
export const tidal: PlatformAdapter = {
  id: "tidal",
  name: "TIDAL",
  mode: "oauth",
  getAuthUrl(state, challenge, role) {
    if (!process.env.TIDAL_CLIENT_ID)
      throw new Error("TIDAL is not configured");
    return (
      "https://login.tidal.com/authorize?" +
      new URLSearchParams({
        client_id: process.env.TIDAL_CLIENT_ID,
        response_type: "code",
        redirect_uri: callback(),
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        scope:
          role === "source"
            ? "user.read playlists.read"
            : "user.read playlists.write search.read",
      })
    );
  },
  async handleCallback(code, verifier) {
    const t = await api<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("https://auth.tidal.com/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.TIDAL_CLIENT_ID!,
        ...(process.env.TIDAL_CLIENT_SECRET
          ? { client_secret: process.env.TIDAL_CLIENT_SECRET }
          : {}),
        redirect_uri: callback(),
        code,
        code_verifier: verifier,
      }),
    });
    const token: Token = {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      displayName: "TIDAL account",
    };
    const me = await api<{ data: Resource }>(base + "/users/me", {
      headers: headers(token),
    });
    token.displayName = me.data.attributes?.username || token.displayName;
    return token;
  },
  async refreshToken(token) {
    const t = await api<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("https://auth.tidal.com/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
        client_id: process.env.TIDAL_CLIENT_ID!,
        ...(process.env.TIDAL_CLIENT_SECRET
          ? { client_secret: process.env.TIDAL_CLIENT_SECRET! }
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
      "/playlists?" +
      new URLSearchParams({
        "filter[owners.id]": "me",
        countryCode: country(),
      });
    while (url) {
      const p: Doc = await api(url, { headers: headers(t) });
      out.push(
        ...p.data.map((x) => ({
          id: x.id,
          name: x.attributes?.name || "Playlist",
          count: x.attributes?.numberOfItems || 0,
        })),
      );
      url = next(p);
    }
    return out;
  },
  async fetchPlaylist(t, id) {
    const p = await api<{ data: Resource }>(
      base + "/playlists/" + encodeURIComponent(id),
      { headers: headers(t) },
    );
    const ids: string[] = [];
    let url: string | null =
      base +
      "/playlists/" +
      encodeURIComponent(id) +
      "/relationships/items?" +
      new URLSearchParams({ countryCode: country() });
    while (url) {
      const page: Doc = await api(url, { headers: headers(t) });
      ids.push(
        ...page.data.filter((x) => x.type === "tracks").map((x) => x.id),
      );
      if (ids.length > 1000)
        throw new Error("Playlist exceeds the supported 1,000-track limit");
      url = next(page);
    }
    return {
      name: p.data.attributes?.name || "TIDAL playlist",
      tracks: await hydrate(t, ids),
    };
  },
  async searchTrack(t, track, clean) {
    if (track.isrc && !clean) {
      const p = await api<Doc>(
        base +
          "/tracks?" +
          new URLSearchParams({
            "filter[isrc]": track.isrc,
            include: "artists",
            countryCode: country(),
          }),
        { headers: headers(t) },
      );
      if (p.data.length) return p.data.map((x) => map(x, p.included || []));
    }
    const search = await api<Doc>(
      base +
        "/searchResults?" +
        new URLSearchParams({
          "filter[query]": `${track.title} ${track.artist}`,
          countryCode: country(),
          explicitFilter: clean ? "EXCLUDE" : "INCLUDE",
        }),
      { headers: headers(t) },
    );
    if (!search.data.length) return [];
    const p = await api<Doc>(
      base +
        "/searchResults/" +
        encodeURIComponent(search.data[0].id) +
        "/relationships/tracks?" +
        new URLSearchParams({
          countryCode: country(),
          explicitFilter: clean ? "EXCLUDE" : "INCLUDE",
        }),
      { headers: headers(t) },
    );
    return (await hydrate(t, p.data.map((x) => x.id).slice(0, 10))).filter(
      (x) => !clean || x.explicit === false,
    );
  },
  async createPlaylist(
    t,
    name,
    description = "Created with Playlist Converter",
  ) {
    const p = await api<{ data: Resource }>(base + "/playlists", {
      method: "POST",
      headers: headers(t),
      body: JSON.stringify({
        data: {
          type: "playlists",
          attributes: {
            name,
            accessType: "UNLISTED",
            description,
          },
        },
      }),
    });
    return {
      id: p.data.id,
      url: "https://tidal.com/browse/playlist/" + p.data.id,
    };
  },
  async addTracks(t, id, ids) {
    for (let i = 0; i < ids.length; i += 50)
      await api(
        base + "/playlists/" + encodeURIComponent(id) + "/relationships/items",
        {
          method: "POST",
          headers: headers(t),
          body: JSON.stringify({
            data: ids.slice(i, i + 50).map((id) => ({ id, type: "tracks" })),
            meta: { onDuplicates: "SKIP" },
          }),
        },
      );
  },
  async revoke() {
    /* No public revoke endpoint in the current official schema. Remove consent in TIDAL account settings. */
  },
};
