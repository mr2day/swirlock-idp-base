# swirlock-idp-base

OpenID Connect Identity Provider for the Swirlock ecosystem. NestJS +
`oidc-provider` v9. Issues **RS256 JWT access tokens** to client apps via
Authorization Code + PKCE; hosts the end-user **registration** and **login**
UI; persists everything (clients, accounts, JWKS, cookie keys, OIDC grants)
in a single SQLite file.

See `swirlock-chatbot-contracts/docs/versions/v5/apps/idp-base.md` for the
contract.

## Run

```powershell
npm install
npm run build
npm run client:add -- --id swirlock-chatbot-ui --name "Swirlock Chatbot UI" `
  --redirect-uri http://localhost:4200/auth/callback `
  --post-logout-redirect-uri http://localhost:4200/ `
  --resource http://127.0.0.1:3200
npm start                       # or: pm2 start ecosystem.config.cjs
```

Discovery: `http://127.0.0.1:3300/oidc/.well-known/openid-configuration`

## Endpoints

OIDC: `/.well-known/openid-configuration`, `/jwks`, `/auth`, `/token`,
`/me`, `/session/end` (all under `/oidc/`).
End-user UI: `/interaction/:uid` (login), `/interaction/:uid/signup`,
`/interaction/:uid/verify-email`, `/interaction/:uid/resend-code`.
Health: `/health`.

## Client management (CLI)

```
npm run client:add -- --id <id> --name "<name>" \
     --redirect-uri <url> [--redirect-uri <url> ...] \
     [--post-logout-redirect-uri <url>] \
     [--resource <orchestrator-url>] \
     [--application-type web|native] \
     [--auth-method none|client_secret_basic|...]
npm run client:list
npm run client:show -- --id <id>
npm run client:remove -- --id <id>
```

Public SPAs use `--auth-method none` with PKCE.

## Account scoping

Accounts are **per client**: `UNIQUE(client_id, email)`. The same email may
exist for two different clients as two independent accounts. Registration
runs against the `client_id` carried into the OIDC interaction.

## Email

Verification codes are sent via nodemailer + SMTP. Configure with env vars:

| Var | Notes |
| --- | --- |
| `SMTP_HOST` | e.g. `email-smtp.eu-central-1.amazonaws.com` |
| `SMTP_PORT` | e.g. `587` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | e.g. `noreply@swirlock.com` |
| `EMAIL_SENDER_NAME` | display name; defaults to `Swirlock Identity` |

When SMTP is not configured, codes are printed to stdout — useful for dev:

```
[swirlock-idp:email-disabled] verification code for alice@example.com (Swirlock Chatbot UI): 186906 (expires in 10m)
```

## Other config

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `3300` | |
| `IDP_BASE_URL` | `http://127.0.0.1:<PORT>` | Public origin of this IdP. |
| `IDP_ISSUER` | `<base>/oidc` | Issuer URL embedded in tokens. Must match what resource servers expect. |
| `IDP_DATA_DIR` | `./data` | SQLite file location. |
| `IDP_DEFAULT_RESOURCE` | `http://127.0.0.1:3200` | Default `aud` for tokens when `resource=` is omitted from the auth request. |
| `IDP_BEHIND_PROXY` | `false` | `true` when terminating TLS in front of this process. |

## End-to-end smoke test

`npm run e2e` (or `node scripts/e2e-smoke.mjs`) runs: register → confirm
code → token exchange → open WS to orchestrator. Requires the orchestrator
running on `127.0.0.1:3200`.
