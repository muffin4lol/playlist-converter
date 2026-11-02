import type { PlatformAdapter, Track } from "./types";
import { api, bearer } from "./request";
const base = "https://www.googleapis.com/youtube/v3";
const callback = () => `${process.env.APP_URL}/api/platforms/youtube/callback`;
type Video = {
  id: string;
  snippet: { title: string; channelTitle: string };
  contentDetails?: { duration: string; contentRating?: { ytRating?: string } };
};
function duration(s = "") {
  const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m
    ? ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000
    : 0;
}
const map = (v: Video): Track => ({
  id: v.id,
  title: v.snippet.title,
  artist: v.snippet.channelTitle.replace(/ - Topic$/, ""),
  duration: duration(v.contentDetails?.duration),
  explicit:
    v.contentDetails?.contentRating?.ytRating === "ytAgeRestricted"
      ? true
      : null,
  selected: true,
});
export const youtube: PlatformAdapter = {
  id: "youtube",
  name: "YouTube Music",
  mode: "oauth",
  getAuthUrl(state, challenge, role) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      throw new Error("Google OAuth is not configured");
    return (
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        response_type: "code",
        redirect_uri: callback(),
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent",
        scope:
          role === "source"
            ? "https://www.googleapis.com/auth/youtube.readonly"
            : "https://www.googleapis.com/auth/youtube.force-ssl",
      })
    );
  },
  async handleCallback(code, verifier) {
    const t = await api<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callback(),
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code_verifier: verifier,
      }),
    });
    const p = await api<{
      items: {
        snippet: { title: string; thumbnails: { default: { url: string } } };
      }[];
    }>(base + "/channels?part=snippet&mine=true", {
      headers: bearer(t.access_token),
    });
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      displayName: p.items[0]?.snippet.title || "YouTube account",
      avatar: p.items[0]?.snippet.thumbnails?.default?.url,
    };
  },
  async refreshToken(token) {
    const t = await api<{ access_token: string; expires_in: number }>(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refreshToken!,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      },
    );
    return {
      ...token,
      accessToken: t.access_token,
      expiresAt: Date.now() + t.expires_in * 1000,
    };
  },
  async fetchPublicPlaylist(id) {
    if (!process.env.YOUTUBE_API_KEY)
      throw new Error(
        "Public YouTube links require an API key. Connect your source account instead.",
      );
    return youtube.fetchPlaylist(
      {
        accessToken: "",
        expiresAt: Date.now() + 60000,
        displayName: "Public playlist",
      },
      id,
    );
  },
  async fetchUserPlaylists(t) {
    const out = [];
    let next = "";
    do {
      const p: {
        items: {
          id: string;
          snippet: { title: string };
          contentDetails: { itemCount: number };
        }[];
        nextPageToken?: string;
      } = await api(
        base +
          "/playlists?" +
          new URLSearchParams({
            part: "snippet,contentDetails",
            mine: "true",
            maxResults: "50",
            ...(next ? { pageToken: next } : {}),
          }),
        { headers: bearer(t.accessToken) },
      );
      out.push(
        ...p.items.map((x) => ({
          id: x.id,
          name: x.snippet.title,
          count: x.contentDetails.itemCount,
        })),
      );
      next = p.nextPageToken || "";
    } while (next);
    return out;
  },
  async fetchPlaylist(t, id) {
    const read = <T>(url: string) =>
      api<T>(
        t.accessToken
          ? url
          : url + "&key=" + encodeURIComponent(process.env.YOUTUBE_API_KEY!),
        { headers: t.accessToken ? bearer(t.accessToken) : {} },
      );
    const head = await read<{ items: { snippet: { title: string } }[] }>(
      base + "/playlists?" + new URLSearchParams({ part: "snippet", id }),
    );
    if (!head.items.length) throw new Error("Playlist not found or private");
    const tracks: Track[] = [];
    let next = "";
    do {
      const p: {
        items: {
          contentDetails: { videoId: string };
          snippet?: { title: string; videoOwnerChannelTitle?: string };
        }[];
        nextPageToken?: string;
      } = await read(
        base +
          "/playlistItems?" +
          new URLSearchParams({
            part: "contentDetails,snippet",
            playlistId: id,
            maxResults: "50",
            ...(next ? { pageToken: next } : {}),
          }),
      );
      const ids = p.items.map((x) => x.contentDetails.videoId);
      if (ids.length) {
        const v = await read<{ items: Video[] }>(
          base +
            "/videos?" +
            new URLSearchParams({
              part: "snippet,contentDetails",
              id: ids.join(","),
            }),
        );
        const byId = new Map(v.items.map((video) => [video.id, map(video)]));
        for (const item of p.items)
          tracks.push(
            byId.get(item.contentDetails.videoId) || {
              id: item.contentDetails.videoId,
              title: item.snippet?.title || "Unavailable video",
              artist: item.snippet?.videoOwnerChannelTitle || "Unknown artist",
              duration: 0,
              explicit: null,
              selected: true,
            },
          );
        if (tracks.length > 1000)
          throw new Error("Playlist exceeds the supported 1,000-track limit");
      }
      next = p.nextPageToken || "";
    } while (next);
    return { name: head.items[0]?.snippet.title || "YouTube playlist", tracks };
  },
  async searchTrack(t, track, clean) {
    const p = await api<{ items: { id: { videoId: string } }[] }>(
      base +
        "/search?" +
        new URLSearchParams({
          part: "snippet",
          type: "video",
          q: `${track.artist} ${track.title}${clean ? " clean version" : ""}`,
          maxResults: "5",
        }),
      { headers: bearer(t.accessToken) },
    );
    if (!p.items.length) return [];
    const videos = await api<{ items: Video[] }>(
      base +
        "/videos?" +
        new URLSearchParams({
          part: "snippet,contentDetails",
          id: p.items.map((x) => x.id.videoId).join(","),
        }),
      { headers: bearer(t.accessToken) },
    );
    return videos.items.map(map).filter((x) => !clean || x.explicit === false);
  },
  async createPlaylist(
    t,
    name,
    description = "Created with Playlist Converter",
  ) {
    const p = await api<{ id: string }>(
      base + "/playlists?part=snippet,status",
      {
        method: "POST",
        headers: {
          ...bearer(t.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: { title: name, description },
          status: { privacyStatus: "private" },
        }),
      },
    );
    return { id: p.id, url: "https://music.youtube.com/playlist?list=" + p.id };
  },
  async addTracks(t, id, ids) {
    for (const videoId of ids)
      await api(base + "/playlistItems?part=snippet", {
        method: "POST",
        headers: {
          ...bearer(t.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            playlistId: id,
            resourceId: { kind: "youtube#video", videoId },
          },
        }),
      });
  },
  async revoke(t) {
    await api(
      "https://oauth2.googleapis.com/revoke?token=" +
        encodeURIComponent(t.accessToken),
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
  },
};
