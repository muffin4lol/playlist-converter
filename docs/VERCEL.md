# Deploy to Vercel

## Prepare

1. Publish this repository to your own GitHub account and enable private vulnerability reporting.
2. Provision managed PostgreSQL (for example Neon or a Vercel marketplace PostgreSQL integration). Use a pooled runtime URL with TLS; use the provider’s direct connection for migration jobs when required.
3. Verify a sending domain with Resend or your SMTP provider.
4. Provision provider apps and complete verification/approval. The app has no registration whitelist, but provider development/testing modes can restrict their own users.
5. Update privacy/terms operator identity, contact details, retention practices, and support information. Replace badge placeholders and the generic GitHub link with your repository URL.

## Configure

Import the repository as a Next.js project in Vercel. Select Node.js 22 or later. Set every required value from `.env.example` in the Production environment:

- DATABASE_URL
- APP_URL = `https://your-canonical-domain.example`
- TOKEN_ENCRYPTION_KEY = output of `openssl rand -hex 32`
- SMTP_URL and EMAIL_FROM
- SPOTIFY_CLIENT_ID (Spotify authorization); SPOTIFY_CLIENT_SECRET for public catalog reads
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (YouTube authorization); YOUTUBE_API_KEY for public playlist reads
- APPLE_MUSIC_DEVELOPER_TOKEN and APPLE_MUSIC_STOREFRONT (for Apple Music)
- DEEZER_APP_ID and DEEZER_APP_SECRET (for Deezer)
- TIDAL_CLIENT_ID, optional TIDAL_CLIENT_SECRET, TIDAL_COUNTRY_CODE (for TIDAL)
- SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET (for SoundCloud)

Never use NEXT_PUBLIC prefixes for secrets. The Apple developer JWT is intentionally returned only to authenticated verified users for MusicKit; the signing private key is never supplied to this app. Set exact OAuth redirect URIs to the production callback routes. Use separate provider apps and databases for previews; do not expose production tokens to untrusted preview code. Preview origins need matching APP_URL and provider allowlisting.

## Migrate and deploy

Apply migrations using a trusted CI job or your terminal with production migration credentials:

```sh
npm ci
npm run db:deploy
npm run build
```

Default Vercel build command: `npm run build`. Do not run `prisma migrate dev` against production. Apply additive schema changes before deploying code that needs them, then deploy through Vercel. A database migration should run once in a controlled release job, not concurrently in every preview build.

This repository's `vercel.json` invokes `scripts/vercel-build.mjs`, which normally runs the build only. When database credentials are protected from download, an operator can explicitly initialize a release with `vercel deploy --prod --skip-domain --build-env APPLY_DB_MIGRATIONS=1`. The script refuses migration outside the production environment. Run only one such release at a time, inspect migration and build logs, and promote only after required email/OAuth configuration and validation. Do not persist `APPLY_DB_MIGRATIONS` as a project setting.

Transfer tick routes set a 60-second maximum. Choose a Vercel plan/runtime that supports this duration. Each authenticated tick processes one track with bounded retries. The browser drives ticks and history can continue a paused transfer. No unauthenticated cron endpoint or process-local background job is used. A dedicated queue is recommended for production-scale transfers.

## Validate

- Register a new address with no invitation and verify through the delivered email.
- Confirm protected pages redirect to login and unverified conversion requests fail.
- Exercise forgotten-password and one-time reset links; check old sessions stop working.
- Connect source and destination using provider consent; deny consent once and verify recovery.
- Transfer a small test playlist. Spotify, YouTube, and SoundCloud create private playlists; TIDAL creates unlisted playlists, and Deezer uses provider defaults. Check actual destination tracks and confidence flags.
- Test an explicit exclusion, a public playlist URL, and clean replacement where supported.
- Use two accounts to check history detail/rerun/delete ownership.
- Confirm nonce CSP, HSTS, secure httpOnly __Host-pc_session cookie, and exact-origin CSRF rejection.
- Check export, history deletion, account deletion, and provider disconnection behavior.

## Operations

On Vercel, the included cron runs `/api/maintenance/cleanup` daily at 03:00 UTC. Set a separate Production `CRON_SECRET`; the route rejects requests without its bearer authorization. Vercel supplies that header to cron requests. The standalone script below is an alternative scheduler, not an additional required job.

See [temporary Gmail and domain migration](TEMPORARY-EMAIL.md) for low-volume testing without a custom domain. Provider acceptance alone does not prove inbox delivery; check verification and reset links end to end. `CHECK_SMTP=1` is an explicit build-time sender-mailbox test and must not be persisted as a project setting.

Schedule `node scripts/cleanup.mjs` daily in a trusted environment with DATABASE_URL. The script deletes expired sessions, platform connections, reset/verification tokens, OAuth state, and rate-limit rows. Protect logs, monitor SMTP and provider errors without secrets, and set backup retention to match the privacy policy. Rate limits depend on trusted ingress headers for IP-level controls; email/account limits remain database-backed.

If a write stops ambiguously, inspect the destination playlist before rerunning. Never automatically repeat uncertain external writes. Roll back code through Vercel if needed; database rollback requires an explicit migration/restore plan.

## First-release hotfix

Read ROLLBACK.md before applying the direct-only migration. The source and destination must differ, and destination credentials are mandatory. There is no file-output fallback. Preview environments require separate credentials and databases.
