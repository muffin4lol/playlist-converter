# Validation record

Validated locally on November 1–2, 2026.

- ESLint and TypeScript checks pass.
- Production Next.js build passes.
- 58 automated tests pass across auth, OAuth state/session boundaries, history authorization, adapters/retries, transfer recovery, matching, CSV, and explicit filtering.
- 31 real HTTP/PostgreSQL checks pass using a local SMTP sink: open registration, verification email delivery, one-time verification/reset links, secure cookie flags, unverified conversion blocking, expired/revoked sessions, account/profile controls, CSV transfers, and cross-account history/CSV/delete isolation.
- Browser checks confirm protected login navigation, track review, explicit selection counter changes, inline missing-credential errors, history, and dark/light mode.
- Phone layout checked at 390 × 844 CSS pixels; no horizontal document overflow. Desktop screenshots are in `docs/screenshots/` and use synthetic local accounts.

## Live account test: CSV → YouTube Music

On November 2, 2026, an authorized Google account completed the app’s PKCE OAuth redirect and returned to the saved wizard with the channel profile connected. A two-track CSV was matched and transferred into a new private YouTube playlist. The resulting playlist was independently opened in YouTube Music and confirmed to contain both selected tracks. The CSV report downloaded successfully with both matched results.

The test found a real normalization bug: the artist channel `TheWeekndVEVO` did not initially match `The Weeknd`. After correcting VEVO/Topic suffix and artist-title-prefix handling, the live preview reported match scores of 100% and 96%. Four new regression tests cover channel aliases, meaningful title words, artist names, and non-Latin metadata. CSV transports are explicitly labeled in reports and history.

Credentials remain in the ignored local `.env`; personal account screenshots and report artifacts are outside the source repository/archive. No passwords were requested by the converter, and no existing destination playlists were edited.

## Not verified

Live Spotify, Apple Music, Deezer, TIDAL, and SoundCloud transfers remain unverified. Cross-region catalogs, large playlists, provider rate-limit recovery, and remote token revocation have not been exercised against real accounts. Provider implementations and mock contract tests do not establish live compatibility. YouTube does not provide a reliable explicit-lyrics flag. Deezer app availability and TIDAL access tiers must be confirmed with the providers. MusicKit needs a real developer JWT and subscriber.

Vercel/GitHub deployment was not performed. The CI workflow is supplied but has not run on a remote repository. Legal pages need deployment-operator identity/contact. No independent security or accessibility audit has been conducted.

## Hosted production validation — November 2, 2026

The owner confirmed registration, verification-email receipt and login. In Chrome, tested hosted Google source OAuth, listing own playlists, importing a two-track test playlist, explicit-toggle/manual selection counters, exporting two tracks as CSV, downloading it, private history and per-track detail, and restoring a rerun. Tested hosted Google destination OAuth and pre-transfer matching (both tracks 100%). Completed a private YouTube playlist creation/add-tracks job. Independently verified both tracks and Private visibility in YouTube Music; downloaded the per-track CSV report. Corrected CSV history labels from matched to exported. Lint, TypeScript and 65 tests pass; final cloud deployment is ready. The owner subsequently confirmed production password-reset email delivery, successful reset and login using the new password; automated auth/reset tests also pass. Other provider adapters have not been live tested.
