import { spotify } from "./spotify";
import { youtube } from "./youtube";
import { soundcloud } from "./soundcloud";
import { deezer } from "./deezer";
import { tidal } from "./tidal";
import { apple } from "./apple";
import type { PlatformAdapter } from "./types";
export const adapters: Record<string, PlatformAdapter> = {
  spotify,
  youtube,
  apple,
  deezer,
  tidal,
  soundcloud,
};
export function adapter(id: string) {
  const a = adapters[id];
  if (!a) throw new Error("Unsupported platform");
  return a;
}
