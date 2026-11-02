# Contributing

Thanks for helping music travel.

1. Fork the repository and create a focused branch.
2. Follow the README quick start; use your own local PostgreSQL, Mailpit, and provider test credentials.
3. Keep security checks in shared server code. Every user-owned query must include the authenticated user ID, including detail, rerun, and delete actions.
4. Add meaningful regression tests for auth, matching, explicit handling, or authorization changes.
5. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
6. Open a PR explaining the problem, resulting behavior, validation, and any provider limitations.

Never commit `.env`, access tokens, account exports, real email addresses, or personal playlists. Do not introduce scraping, password collection, bypasses for verification, or a production demo auth bypass. Use the platform adapter contract for provider changes. Treat unknown explicit metadata as unknown, never as confirmed clean.

Keep the app keyboard accessible and test narrow and wide screens in both themes. Update capability labels and documentation whenever platform behavior changes. Changes must preserve free, open registration in Phase 1.

By contributing you agree that your contributions may be distributed under the MIT License. Be respectful and specific in reviews. Report security issues privately rather than in public issues.
