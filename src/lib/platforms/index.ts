import { spotify } from "./spotify";
import { youtube } from "./youtube";
import { soundcloud } from "./soundcloud";
import { deezer } from "./deezer";
import { tidal } from "./tidal";
import { apple } from "./apple";
import type { PlatformAdapter } from "./types";
const fallback = (id: string, name: string): PlatformAdapter => {
  const unavailable = () => {
    throw new Error(
      `${name} has no direct integration. Use CSV import/export.`,
    );
  };
  return {
    id,
    name,
    mode: "csv",
    getAuthUrl: unavailable,
    handleCallback: unavailable,
    fetchUserPlaylists: unavailable,
    fetchPlaylist: unavailable,
    searchTrack: unavailable,
    createPlaylist: unavailable,
    addTracks: unavailable,
    revoke: async () => {},
  };
};
export const adapters: Record<string, PlatformAdapter> = {
  spotify,
  youtube,
  apple,
  deezer,
  tidal,
  soundcloud,
  amazon: fallback("amazon", "Amazon Music"),
  pandora: fallback("pandora", "Pandora"),
};
export function adapter(id: string) {
  const a = adapters[id];
  if (!a) throw new Error("Unsupported platform");
  return a;
}
