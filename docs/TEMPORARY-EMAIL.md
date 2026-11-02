# Temporary email and later domain setup

The app supports standard SMTP through SMTP_URL and EMAIL_FROM. Changing sender does not change accounts, passwords, history, or the database schema. Email verification remains mandatory.

## Now: Gmail for small-scale testing

1. Use a Gmail account whose address you are comfortable displaying to recipients, preferably a dedicated app mailbox.
2. Enable Google 2-Step Verification and create an app password named Playlist Converter. App passwords may be unavailable on restricted accounts. Never use your ordinary Google password.
3. In Vercel, open playlist-converter → Settings → Environment Variables. Add Production secret SMTP_URL as `smtps://YOUR_ADDRESS%40gmail.com:APP_PASSWORD_WITHOUT_SPACES@smtp.gmail.com:465`. URL-encode the email address and any credential special characters.
4. Set Production EMAIL_FROM to `Playlist Converter <YOUR_ADDRESS@gmail.com>` using that same account.
5. Redeploy and test actual verification and password reset delivery before public promotion. Gmail sending limits and cloud sign-in checks apply; it is a temporary low-volume solution, not a guaranteed production mail service.
6. Do not paste app passwords into chat, commit them, or include them in screenshots. Enter them directly in Vercel's secret setting.

## Later: domain for email only

1. Purchase a domain under your own account. Keep the Vercel website address if desired.
2. Add a sending domain/subdomain to Resend, for example mail.yourdomain.com.
3. Add the exact DNS verification records Resend provides at your DNS host. Wait for verification.
4. Create a sending API key and replace Production SMTP_URL with `smtps://resend:YOUR_API_KEY@smtp.resend.com:465`.
5. Replace EMAIL_FROM with an address on the verified sending domain, for example `Playlist Converter <hello@mail.yourdomain.com>`.
6. Redeploy. Test verification and password reset links with real inboxes; then revoke the temporary Gmail app password.

## Optional: move the website too

1. Vercel → playlist-converter → Settings → Domains: add the domain and configure the DNS records shown.
2. Wait for HTTPS readiness. Set APP_URL to the exact canonical HTTPS origin.
3. Add that origin's `/api/platforms/youtube/callback` to the Google OAuth web client's authorized redirect URIs. Update any other enabled providers similarly.
4. Redeploy and test login, verification/reset links, YouTube consent, transfer, and history on the canonical domain before redirecting the old address.
5. Keep TOKEN_ENCRYPTION_KEY and DATABASE_URL unchanged. Existing accounts and history remain. Users need to sign in on the new hostname because session cookies are host-specific.
