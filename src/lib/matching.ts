import type { Track } from "./platforms/types";
const fold = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const normalize = (value: string) =>
  fold(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const artistName = (value: string) =>
  normalize(value.replace(/^(.+?)(?:\s*[-–—]\s*topic|\s*vevo)$/i, "$1"));
const descriptorWords = new Set([
  "official",
  "music",
  "audio",
  "video",
  "clean",
  "explicit",
  "version",
  "lyrics",
  "lyric",
  "hd",
  "hq",
  "4k",
  "visualizer",
]);
function titleName(value: string, artists: string[]) {
  let title = fold(value);
  // Only strip an artist prefix when a separator identifies it as video metadata.
  // A real song such as "Go On" by "Go" must retain its first word.
  for (const artist of [...new Set(artists)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    const prefix = new RegExp(
      "^" + artist.split(" ").join("\\s*") + "\\s*[-–—:|'\"]\\s*",
      "u",
    );
    const found = title.match(prefix);
    if (found) {
      title = title.slice(found[0].length);
      break;
    }
  }
  title = title
    .replace(/\([^)]*\)|\[[^\]]*\]/g, (annotation) => {
      const words = normalize(annotation).split(" ");
      return words.length && words.every((word) => descriptorWords.has(word))
        ? ""
        : annotation;
    })
    .replace(
      /\b(?:official\s+(?:music\s+)?(?:audio|video)|lyrics?(?:\s+video)?)\s*$/i,
      "",
    );
  return normalize(title);
}
function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const x = new Set(a.split(" ")),
    y = new Set(b.split(" "));
  return (
    (2 * [...x].filter((value) => y.has(value)).length) / (x.size + y.size)
  );
}
export function confidence(source: Track, target: Track) {
  if (
    source.isrc &&
    target.isrc &&
    source.isrc.toUpperCase() === target.isrc.toUpperCase()
  )
    return 1;
  const sourceArtist = artistName(source.artist),
    targetArtist = artistName(target.artist);
  const title = similarity(
    titleName(source.title, [sourceArtist, targetArtist]),
    titleName(target.title, [sourceArtist, targetArtist]),
  );
  // Channel handles commonly concatenate words: TheWeekndVEVO -> theweeknd.
  const artist =
    sourceArtist &&
    targetArtist &&
    sourceArtist.replaceAll(" ", "") === targetArtist.replaceAll(" ", "")
      ? 1
      : similarity(sourceArtist, targetArtist);
  const duration =
    source.duration && target.duration
      ? Math.max(0, 1 - Math.abs(source.duration - target.duration) / 15000)
      : 0.35;
  return (
    Math.round((title * 0.5 + artist * 0.35 + duration * 0.15) * 100) / 100
  );
}
export function match(source: Track, candidates: Track[], clean = false) {
  return (
    candidates
      .filter((t) => !clean || t.explicit === false)
      .map((track) => ({ track, confidence: confidence(source, track) }))
      .sort((a, b) => b.confidence - a.confidence)[0] ?? null
  );
}
export function explicitSelection(
  tracks: Track[],
  include: boolean,
  _mode: "skip" | "replace",
) {
  void _mode;
  return tracks.map((t) =>
    t.explicit === true ? { ...t, selected: include } : { ...t },
  );
}
