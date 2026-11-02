# First-release hotfix checkpoint

Work branch: hotfix/first-release-direct-playlists.
Rollback checkpoint: rollback/first-release-before-direct-hotfix.

Production app: https://playlist-converter-alpha.vercel.app
Repository: https://github.com/muffin4lol/playlist-converter

The production baseline has verified account registration, email verification, password reset/login and live YouTube account flows. The new branch refactors the converter to a four-step, direct-destination-only flow. See README and ROLLBACK.md for behavior, limitations and migration requirements.

Production currently has Google credentials, but other direct destination credentials and public YouTube API-key access have not been configured. Source and destination must differ in this release; do not claim every pair has live account validation. Additional provider approvals remain external prerequisites.

Secrets stay outside source control. The production database, encryption key, SMTP credentials and Google secrets must be preserved through release. Preview builds deliberately have no production credentials and need separate test services.
