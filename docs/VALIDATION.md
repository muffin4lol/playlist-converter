# Hotfix validation

Release label: **Rollback and hotfix for first release**.

The earlier release was tested with a live YouTube account. Those results do not prove the refactored four-step flow. This hotfix must pass lint, TypeScript, provider/public-read contracts, token refresh tests, direct-transfer job tests, history ownership tests and the isolated real account/SMTP smoke suite.

A real transfer requires official source access (public API access or user authorization) and approved destination credentials for a different platform, because the source is excluded from destination options. Never silently substitute a local file or a same-platform clone for that acceptance check.

Public-link acceptance checks: provider hostname/path validation, no music-account login when official public access is configured, helpful errors for private/unavailable links, preserved track order, and an explicit 1,000-track size limit.

Destination acceptance checks: connected account name, official consent, correct source-description text, ordered batching, real playlist URL, transferred/not-found counts and safe stop after an ambiguous external write.

## Checks completed locally

- ESLint, TypeScript and 79 automated tests passed (12 test files).
- 27 real HTTP/PostgreSQL/SMTP smoke checks passed, including verification, reset, single-use tokens, session invalidation, wizard persistence and destination authorization.
- Browser checked the four-step indicator, back navigation, preserved selections, excluded source destination, disabled unconfigured services and mismatched playlist URL errors.
- Optimized production build passed with the webpack compiler.
- Local database migration applied successfully. Production migration and promotion succeeded on 2 November 2026 after a private database backup.

The development compiler repeatedly reloaded the local page; browser checks used the webpack development compiler. Live cross-platform acceptance succeeded on 3 November 2026: the signed-in app loaded a 15-track public Deezer playlist without a Deezer login, previewed two selected tracks at 99% confidence, and created a private playlist directly in the authorized YouTube Music account. Both selected tracks transferred, with zero unmatched tracks. The destination UI confirmed the playlist description includes the source platform and original playlist name, and both songs appear in order. No music-account passwords were collected.

## Production release checks

- GitHub CI passed build, tests, migrations and real account/SMTP smoke checks.
- Production backup archive was readable in full before migration; private backup retained outside the repository.
- Migration applied exactly once; obsolete columns removed, both new columns present, existing account/history records preserved.
- Live landing/login return 200; converter redirects signed-out visitors to login; wizard/history APIs return 401 without a session.
- Signed-in production wizard shows Step 1 of 4, direct-library copy and expected provider availability.

## New-transfer navigation regression — 3 November 2026

New transfer links on history, overview and the sidebar explicitly discard only the current wizard draft and start Step 1. Plain converter URLs, OAuth callbacks and history reruns retain resume behavior. Full navigation also discards old result/polling state when the user starts again from the converter itself.

Validated with 83 automated tests, 33 local HTTP/database/SMTP checks, and browser checks from a saved Step 4 draft through History → New transfer, refreshing a new Step 2 draft, and sidebar reset. Authentication, exact-origin protection and per-user draft ownership are enforced. Transfer history and connections are not deleted. No schema migration is required.
