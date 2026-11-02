import { describe, it, expect } from "vitest";
import { playlistReference } from "../src/lib/platforms/playlist-url";
import { wizardSchema } from "../src/lib/validation";
describe("playlist URL validation", () => {
  it("accepts provider-specific playlist links", () => {
    expect(
      playlistReference(
        "youtube",
        "https://music.youtube.com/playlist?list=PLtest_123",
      ).id,
    ).toBe("PLtest_123");
    expect(
      playlistReference(
        "spotify",
        "https://open.spotify.com/playlist/abc123?si=test",
      ).id,
    ).toBe("abc123");
    expect(
      playlistReference(
        "apple",
        "https://music.apple.com/ie/playlist/mix/pl.123",
      ),
    ).toEqual({ id: "pl.123", storefront: "ie" });
    expect(
      playlistReference("deezer", "https://www.deezer.com/en/playlist/123").id,
    ).toBe("123");
  });
  it("rejects other platforms, lookalike domains, private network URLs and credentials", () => {
    for (const url of [
      "https://open.spotify.com.evil.test/playlist/abc",
      "https://127.0.0.1/playlist/abc",
      "https://user:password@open.spotify.com/playlist/abc",
      "http://open.spotify.com/playlist/abc",
      "https://open.spotify.com/track/abc",
      "https://youtube.com/playlist?list=abc",
    ]) {
      expect(() => playlistReference("spotify", url)).toThrow();
    }
  });
  it("restricts the wizard to four steps and strips obsolete fields", () => {
    const state = {
      source: "spotify",
      destination: "youtube",
      playlistName: "Mix",
      tracks: [],
      sourceTransport: "legacy",
      includeExplicit: true,
      cleanMode: "skip",
    };
    expect(wizardSchema.parse({ ...state, step: 3 })).not.toHaveProperty(
      "sourceTransport",
    );
    expect(wizardSchema.safeParse({ ...state, step: 4 }).success).toBe(false);
  });
});
