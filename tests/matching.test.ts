import { describe, it, expect } from "vitest";
import { confidence, match, explicitSelection } from "../src/lib/matching";
import type { Track } from "../src/lib/platforms/types";
const track: Track = {
  id: "1",
  title: "Midnight City",
  artist: "M83",
  duration: 244000,
  isrc: "GB12345",
  explicit: true,
  selected: true,
};
describe("matching engine", () => {
  it("prioritizes ISRC over text", () =>
    expect(confidence(track, { ...track, title: "Localized title" })).toBe(1));
  it("fuzzy matches accents and punctuation", () =>
    expect(
      confidence(
        { ...track, isrc: undefined, title: "Déjà Vu!" },
        { ...track, isrc: undefined, title: "Deja Vu" },
      ),
    ).toBe(1));
  it("rejects unrelated songs", () =>
    expect(
      confidence(track, {
        ...track,
        isrc: undefined,
        title: "Another Song",
        artist: "Other Artist",
        duration: 500000,
      }),
    ).toBeLessThan(0.65));
  it("ranks the best candidate", () =>
    expect(
      match(track, [
        {
          ...track,
          id: "wrong",
          isrc: undefined,
          title: "Unrelated",
          artist: "Other",
        },
        track,
      ])?.track.id,
    ).toBe("1"));
  it("recognizes YouTube VEVO handles and official artist-prefixed titles", () => {
    const source = {
      ...track,
      isrc: undefined,
      title: "Blinding Lights",
      artist: "The Weeknd",
      duration: 200000,
    };
    const target = {
      ...source,
      id: "youtube",
      title: "The Weeknd - Blinding Lights (Official Audio)",
      artist: "TheWeekndVEVO",
      duration: 204000,
    };
    expect(confidence(source, target)).toBeGreaterThanOrEqual(0.85);
  });
  it("recognizes Topic channels without discarding meaningful title words", () => {
    const source = {
      ...track,
      isrc: undefined,
      title: "Clean",
      artist: "Taylor Swift",
    };
    expect(
      confidence(source, {
        ...source,
        title: "Taylor Swift - Clean (Official Audio)",
        artist: "Taylor Swift - Topic",
      }),
    ).toBe(1);
  });
  it("retains artist-name words and actual song prefixes", () => {
    const source = { ...track, isrc: undefined, title: "Go On", artist: "Go" };
    expect(confidence(source, { ...source, title: "On" })).toBeLessThan(0.85);
    const cleanBandit = { ...track, isrc: undefined, artist: "Clean Bandit" };
    expect(
      confidence(cleanBandit, { ...cleanBandit, artist: "Bandit" }),
    ).toBeLessThan(1);
  });
  it("matches non-Latin track metadata", () => {
    const source = {
      ...track,
      isrc: undefined,
      title: "夜に駆ける",
      artist: "YOASOBI",
    };
    expect(
      confidence(source, {
        ...source,
        title: "YOASOBI - 夜に駆ける (Official Video)",
      }),
    ).toBe(1);
  });
  it("requires confirmed non-explicit for a clean replacement", () =>
    expect(
      match(
        track,
        [
          { ...track, explicit: true },
          { ...track, explicit: null },
        ],
        true,
      ),
    ).toBeNull());
});
describe("explicit selection", () => {
  const tracks = [
    track,
    { ...track, id: "2", explicit: false },
    { ...track, id: "3", explicit: null },
  ];
  it("starts with explicit tracks selected", () =>
    expect(
      explicitSelection(tracks, true, "skip").every((x) => x.selected),
    ).toBe(true));
  it("bulk unchecks explicit while retaining clean and unknown", () =>
    expect(
      explicitSelection(tracks, false, "skip").map((x) => x.selected),
    ).toEqual([false, true, true]));
  it("supports individual override without mutating originals", () => {
    const filtered = explicitSelection(tracks, false, "replace");
    filtered[0].selected = true;
    expect(filtered[0].selected).toBe(true);
    expect(tracks[0].selected).toBe(true);
  });
});
it("bulk explicit changes preserve non-explicit manual choices", () => {
  expect(
    explicitSelection(
      [{ ...track, explicit: false, selected: false }],
      false,
      "skip",
    )[0].selected,
  ).toBe(false);
});
