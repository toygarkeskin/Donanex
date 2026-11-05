# Security

## Controls in place

| Risk | Control | Verified by |
|---|---|---|
| Order tampering / IDOR | Payment and order summary endpoints need the order's tracking code; customers can only act on their own orders; other people's orders return the same 404 as missing ones | `tests/integration/api.test.js` |
| Price tampering | Totals are computed on the server; client prices are ignored | integration |
| Overselling | Row locks inside one transaction | integration (10 concurrent orders, stock 3) |
| Stock lockup | Order rate limit; unpaid orders expire and return stock | integration |
| SQL injection | Parameterized queries only; `LIKE` wildcards escaped; IDs range-checked | integration |
| XSS | `html` template tag escapes by default; `setHtml` accepts nothing else; strict CSP with no inline script or style | browser test, `npm run check` |
| Third-party scripts | Bootstrap and icons are installed from the npm lockfile and self-hosted; `script-src 'self'` | CSP header |
| CSRF | `SameSite=Strict` cookies plus an `Origin` / `Sec-Fetch-Site` check on state-changing requests | integration |
| Session theft | `HttpOnly` signed cookies; logout revokes the token server-side; password change ends other sessions; customer tokens cannot act as admin | integration, unit |
| Password storage | scrypt (N=2^16, r=8, p=2) with a per-user salt; older hashes upgrade at login | unit, integration |
| Brute force | Per-IP limits on login, registration, tracking, reset and support; nginx request limit | integration |
| Account discovery | Login takes the same work for unknown e-mails; password reset always gives the same response | integration |
| Password reset | Single-use, 30 minutes, hash stored; token travels in the URL fragment; link built from `PUBLIC_URL`, not the Host header | integration |
| CSV formula injection | Exported cells starting with `= + - @` are neutralized | code review |
| Container escape / lateral movement | Non-root, read-only filesystem, all capabilities dropped, `no-new-privileges`; database on an internal network with no published port | `docker compose ps`, manual check |
| Secret leakage | `.env` is git-ignored and excluded from images; error responses hide details; logs omit query strings and bodies | manual check |

## Before going live

1. Put a TLS-terminating proxy in front and set `COOKIE_SECURE=true` and `PUBLIC_URL=https://…`. HSTS turns on automatically with `COOKIE_SECURE`.
2. Set `ENABLE_TEST_PAYMENTS=false` and integrate a real payment provider. **With test payments on, anyone holding an order's tracking code can mark it paid.**
3. Rotate every secret in `.env`: database, admin, `SESSION_SECRET`, SMTP.
4. Set up database backups. Nothing backs up the `db-data` volume today.

## Known limitations

- **Single admin account from environment variables.** There are no per-user roles, no audit log and no 2FA.
- **Rate limits live in memory.** They reset on restart and do not work across several backend instances; use a shared store such as Redis if you scale out.
- **No e-mail verification.** Registration answers "already registered", which reveals that an address has an account. Rate limited, but closing this fully needs a verification flow.
- **Favorites are stored in the browser**, not the account, so they do not follow a customer across devices.
- **Legal pages are missing.** KVKK, returns and FAQ footer entries are plain text. These need real text from the business.
