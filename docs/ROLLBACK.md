# Rollback and hotfix for first release

Branch: `hotfix/first-release-direct-playlists`.
Rollback tag: `rollback/first-release-before-direct-hotfix`.

## Changes

The wizard has four steps and only direct destination-library creation. Account and public-link source input use official APIs. Legacy file routes and dependencies are removed. Old history is preserved as earlier-release entries; they cannot be rerun as direct transfers without choosing a new source/destination.

## Release checklist

1. Review the hotfix PR and passing CI, including provider contract, refresh, public URL and account isolation tests.
2. Back up the production database before migration. The migration removes obsolete transport columns and relabels historical non-remote results. Do not treat a code-only rollback as a data rollback.
3. Configure official credentials for at least one source and a different destination. Public YouTube reads need `YOUTUBE_API_KEY`; public Spotify reads need `SPOTIFY_CLIENT_SECRET` as well as client ID. Keys/secrets remain server-side. Do not enable unsupported public access through scraping.
4. Apply `npm run db:deploy` once in a controlled release with production migration credentials.
5. Build/deploy and test account selection, a canonical public playlist URL, destination consent, playlist description, batch writes, history and the destination playlist itself.
6. Confirm old download URLs no longer generate files and that disabled providers do not imply a working direct connection.

## Rollback

Before the migration: redeploy the previous production deployment or the saved rollback tag.
After the migration: coordinate a compatible database restore from the pre-release backup and redeploy the saved tag. Restoring a backup can remove newer account/history data, so stop writes, preserve newer records and plan reconciliation first. Rolling back code alone is unsafe because the earlier ORM expects removed transport columns.

Remote playlists already created stay in users' music accounts. Never automatically delete them or repeat an ambiguous write. Do not rotate the existing encryption key or overwrite live secrets during rollback.
