# Security policy

## Reporting

Do not disclose vulnerabilities, tokens, or personal data in public issues. After publishing this repository, enable GitHub Private Vulnerability Reporting and use the Security tab → Report a vulnerability. Until that is enabled, contact the repository owner privately through their published security contact. No contact address is invented in this template.

Include affected version, reproducible steps, impact, and a minimal example with synthetic data. Avoid accessing other users’ data or running disruptive tests. No response-time guarantee is offered until a maintainer publishes one.

## Supported release

Security fixes target the current `main` branch. Audit dependencies and apply updates before deployment.

## Important deployment requirements

- Use HTTPS and set APP_URL to the exact canonical origin. Never expose a production deployment through HTTP.
- Use a random 32-byte TOKEN_ENCRYPTION_KEY and managed PostgreSQL TLS. Keep secrets server-only.
- Configure trusted ingress client-IP headers; do not allow clients to supply untrusted forwarded addresses.
- Use verified SMTP sender domains, monitor failures, and never log reset or verification tokens.
- Run expiry cleanup daily. Session expiry blocks access immediately; cleanup physically removes expired records.
- Request provider approval, OAuth verification, and appropriate quota before broad public use.
- Customize operator identity, privacy contact, retention, and legal pages before launch.

## Design and limitations

Passwords use bcrypt cost 12, sessions are opaque and hashed, and platform tokens use authenticated AES-GCM encryption. All mutation handlers enforce Origin-based CSRF checks; same-origin JSON requests and SameSite cookies are required. OAuth callbacks consume one-time state bound to the initiating user session. Auth and transfer limits are persisted in PostgreSQL. Account lockouts use increasing backoff.

Provider writes are external side effects and cannot be atomically committed with PostgreSQL. An ambiguous interrupted write must be inspected before rerunning. Local disconnect may not revoke provider consent where no revocation API exists. A local account deletion removes stored tokens and history; the provider may retain consent and created playlists. Remove consent in provider settings when needed.

The application has not undergone an independent security audit and live OAuth behavior must be tested with approved credentials. Never present mock tests as proof of complete production security.
