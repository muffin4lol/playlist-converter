# Deployment checkpoint — November 2, 2026

## Live deployment

https://playlist-converter-alpha.vercel.app

- Vercel project: muffin4lol/playlist-converter. Fresh Neon production database; both migrations applied.
- Separate production encryption key, protected SMTP credentials, Google credentials, and cleanup authorization are configured.
- Gmail authenticated successfully and the owner confirmed receipt of the deployment email test.
- Google callback and branding links use the canonical production origin. Google OAuth is now In production; its sensitive permissions remain unverified and Google shows a 100-user cap. The wizard labels the remaining warning/limit.
- The production URL is publicly accessible. Account login still protects dashboard, converter, profile, history and private API routes.
- Public checks: landing/privacy/terms/contact return 200; private pages redirect to login; private APIs and unauthenticated cleanup return 401; cross-origin login is rejected; CSP and HSTS are present.

## Implemented

- Required-name registration, verification, login/logout/recovery, secure sessions, profile/password/data controls, private paginated history, CSV reports and reruns.
- Explicit bulk selection, per-track overrides, clean replacement, ISRC/fuzzy matching, confidence review, persisted OAuth wizard, resumable transfer records and safe retries.
- YouTube production credentials; six direct adapter implementations in source. Unconfigured integrations are accurately labeled CSV in the deployed app.
- Live local CSV → YouTube account test previously completed with two songs in a private playlist and verified report.
- Contact form reaches the configured operator mailbox without exposing its address. Operator: Sahil Dhole.
- Authenticated daily cleanup scheduled at 03:00 UTC through Vercel.
- 65 automated tests pass. Lint and TypeScript pass. Vercel production builds succeed. Local Turbopack build can fail due to this machine's worker port restrictions; cloud build is verified separately.

## Still requires completion / external approvals

- Owner confirmed production registration, email verification and login. Browser confirmed the signed-in converter. Hosted source and destination OAuth succeeded. YouTube library fetch, two-track import, selection controls, CSV export/download, history detail and safe rerun were verified. A hosted YouTube → YouTube transfer completed with two 100% matches; the new private playlist and both songs were independently verified in YouTube Music. The owner also confirmed receipt of the production password-reset email, successful password change and subsequent login. Do not bypass email verification or copy local test accounts/tokens into production.
- Complete sensitive-scope Google verification; production publication alone does not remove warnings or user caps.
- Approved credentials, provider access and live tests for Spotify, Apple Music, Deezer, TIDAL and SoundCloud. No Spotify Premium developer account is currently available. Amazon Music and Pandora remain CSV-only.
- Public GitHub repository: https://github.com/muffin4lol/playlist-converter. Source excludes credentials and runtime data; CI, issue templates, badges, MIT license, and private vulnerability reporting are configured. Check the Actions tab for current CI status.
- Later custom-domain sender setup: docs/TEMPORARY-EMAIL.md. Keep DATABASE_URL and TOKEN_ENCRYPTION_KEY stable during domain migration.

Secrets live only in ignored local files or Vercel secrets. Do not commit/upload .env, .env.local, .vercel, runtime credentials, private screenshots, or user data. Private test playlists remain in the owner's music account; do not delete them without approval.

## Hosted account validation

Owner-approved public support/privacy email is configured. Google publishing status is In production; unverified sensitive scopes still show a warning and 100-user cap. Hosted export and private playlist creation were completed with the owner’s verified account. The new test playlist remains in the owner’s account. Source playlists were not modified.

## GitHub publication and recovery validation

Public repository: https://github.com/muffin4lol/playlist-converter. Initial CI completed successfully, including PostgreSQL migration, lint, 65 tests, production build and real HTTP/account/authorization smoke checks. Vercel is connected to this GitHub repository. Private vulnerability reporting is enabled. The owner confirmed the production reset email arrived, reset submission succeeded, and the new password allowed login.
