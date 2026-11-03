# First-release hotfix checkpoint

Work branch: hotfix/first-release-direct-playlists.
Rollback checkpoint: rollback/first-release-before-direct-hotfix.

Production app: https://playlist-converter-alpha.vercel.app
Repository: https://github.com/muffin4lol/playlist-converter

Released 2 November 2026 after a verified private database backup and successful production migration. Pull request #1 is merged into main. Production uses the four-step, direct-destination-only flow. Registration, email verification, password reset/login and earlier live YouTube account flows remain in place. See README and ROLLBACK.md for behavior, limitations and migration requirements.

Production currently has Google credentials, but other direct destination credentials and public YouTube API-key access have not been configured. Source and destination must differ in this release; do not claim every pair has live account validation. Additional provider approvals remain external prerequisites.

Secrets stay outside source control. The production database, encryption key, SMTP credentials and Google secrets must be preserved through release. Preview builds deliberately have no production credentials and need separate test services.

Live acceptance on 3 November 2026: public Deezer source → private YouTube Music destination, two selected songs transferred, zero unmatched, ordered songs and provenance description verified on YouTube Music. Google warning/consent was completed by the account owner.
