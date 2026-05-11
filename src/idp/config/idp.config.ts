import * as path from 'path';

// Deployment defaults are baked in here so a fresh clone of this repo
// reproduces the running setup without needing an unversioned .env file
// for non-secret config. SMTP credentials still live in .env because
// they ARE secret. Anything below is overridable via process.env if
// you need a different value for local dev.

const isProduction = process.env.NODE_ENV === 'production';

const port = parseInt(process.env.PORT || '3300', 10);

// When PM2 runs the IdP behind the Cloudflare tunnel (NODE_ENV=production),
// the IdP serves on localhost but its public-facing URL is
// https://idpbase.swirlock.com. Discovery doc, issuer, redirect URI
// hostname etc. must all use the public URL or token verification breaks.
const PUBLIC_BASE_URL = 'https://idpbase.swirlock.com';
const baseUrl =
  process.env.IDP_BASE_URL ||
  (isProduction ? PUBLIC_BASE_URL : `http://127.0.0.1:${port}`);

const oidcMountPath = '/oidc';
const issuer = process.env.IDP_ISSUER || `${baseUrl}${oidcMountPath}`;
const dataDir = process.env.IDP_DATA_DIR || path.resolve(process.cwd(), 'data');

// Cloudflare tunnel terminates TLS and forwards as plain HTTP; the
// oidc-provider must trust X-Forwarded-* headers to generate
// https:// URLs in tokens and discovery responses.
const behindProxy =
  process.env.IDP_BEHIND_PROXY !== undefined
    ? process.env.IDP_BEHIND_PROXY === 'true'
    : isProduction;

export const idpConfig = {
  port,
  baseUrl,
  oidcMountPath,
  issuer,
  dataDir,
  dbPath: path.join(dataDir, 'idp.sqlite'),
  jwksPath: path.join(dataDir, 'jwks.json'),
  cookieKeysPath: path.join(dataDir, 'cookie-keys.json'),
  defaultResource:
    process.env.IDP_DEFAULT_RESOURCE || 'http://127.0.0.1:3200',
  behindProxy,
};

export type IdpConfig = typeof idpConfig;
