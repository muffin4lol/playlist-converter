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
        access_type: "online",
        scope:
          role === "source"
            ? "https://www.googleapis.com/auth/youtube.readonly"
            : "https://www.googleapis.com/auth/youtube.force-ssl",
      })
    );
  },
  async handleCallback(code, verifier) {
    const t = await api<{ access_token: string; expires_in: number }>(
      "https://oauth2.googleapis.com/token",
      {
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
      },
    );
    const p = await api<{
      items: {
        snippet: { title: string; thumbnails: { default: { url: string } } };
      }[];
    }>(base + "/channels?part=snippet&mine=true", {
      headers: bearer(t.access_token),
    });
    return {
      accessToken: t.access_token,
      expiresAt: Date.now() + t.expires_in * 1000,
      displayName: p.items[0]?.snippet.title || "YouTube account",
      avatar: p.items[0]?.snippet.thumbnails?.default?.url,
    };
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
    const head = await api<{ items: { snippet: { title: string } }[] }>(
      base + "/playlists?" + new URLSearchParams({ part: "snippet", id }),
      { headers: bearer(t.accessToken) },
    );
    const tracks: Track[] = [];
    let next = "";
    do {
      const p: {
        items: { contentDetails: { videoId: string } }[];
        nextPageToken?: string;
      } = await api(
        base +
          "/playlistItems?" +
          new URLSearchParams({
            part: "contentDetails",
            playlistId: id,
            maxResults: "50",
            ...(next ? { pageToken: next } : {}),
          }),
        { headers: bearer(t.accessToken) },
      );
      const ids = p.items.map((x) => x.contentDetails.videoId);
      if (ids.length) {
        const v = await api<{ items: Video[] }>(
          base +
            "/videos?" +
            new URLSearchParams({
              part: "snippet,contentDetails",
              id: ids.join(","),
            }),
          { headers: bearer(t.accessToken) },
        );
        tracks.push(...v.items.map(map));
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
  async createPlaylist(t, name) {
    const p = await api<{ id: string }>(
      base + "/playlists?part=snippet,status",
      {
        method: "POST",
        headers: {
          ...bearer(t.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: { title: name },
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
