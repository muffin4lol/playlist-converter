import { platformLogoPaths } from "./platform-logo-paths";
export const platforms = [
  {
    id: "spotify",
    name: "Spotify",
    color: "#1ed760",
    symbol: "≋",
    mode: "OAuth",
  },
  {
    id: "apple",
    name: "Apple Music",
    color: "#fa526f",
    symbol: "♫",
    mode: "MusicKit",
  },
  {
    id: "youtube",
    name: "YouTube Music",
    color: "#ff4949",
    symbol: "▶",
    mode: "OAuth",
  },
  {
    id: "deezer",
    name: "Deezer",
    color: "#a66bff",
    symbol: "▥",
    mode: "OAuth",
  },
  { id: "tidal", name: "TIDAL", color: "#d7e2ed", symbol: "⠿", mode: "OAuth" },
  {
    id: "soundcloud",
    name: "SoundCloud",
    color: "#ff9138",
    symbol: "☁",
    mode: "OAuth",
  },
  {
    id: "amazon",
    name: "Amazon Music",
    color: "#46d9eb",
    symbol: "a",
    mode: "CSV",
  },
  {
    id: "pandora",
    name: "Pandora",
    color: "#6a9bff",
    symbol: "P",
    mode: "CSV",
  },
];
export function platformLabel(id: string, transport?: string) {
  const platform = platforms.find((p) => p.id === id);
  const name = platform?.name || id;
  return transport === "csv" || platform?.mode === "CSV"
    ? `${name} (CSV)`
    : name;
}
export function PlatformIcon({ id, size = "" }: { id: string; size?: string }) {
  const p = platforms.find((p) => p.id === id) || platforms[0];
  return (
    <span
      aria-hidden="true"
      className={"platform-icon " + size}
      style={{ color: p.color, background: p.color + "15" }}
    >
      {platformLogoPaths[id] ? (
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
          focusable="false"
        >
          <path d={platformLogoPaths[id]} />
        </svg>
      ) : (
        p.symbol
      )}
    </span>
  );
}
