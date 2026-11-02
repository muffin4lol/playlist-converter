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

The development compiler repeatedly reloaded the local page; browser checks used the webpack development compiler. A real cross-platform transfer is still pending acceptance; automated and page checks do not prove an external playlist write.

## Production release checks

- GitHub CI passed build, tests, migrations and real account/SMTP smoke checks.
- Production backup archive was readable in full before migration; private backup retained outside the repository.
- Migration applied exactly once; obsolete columns removed, both new columns present, existing account/history records preserved.
- Live landing/login return 200; converter redirects signed-out visitors to login; wizard/history APIs return 401 without a session.
- Signed-in production wizard shows Step 1 of 4, direct-library copy and expected provider availability.
