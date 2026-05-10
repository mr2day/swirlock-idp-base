import * as path from 'path';

const port = parseInt(process.env.PORT || '3300', 10);
const baseUrl = process.env.IDP_BASE_URL || `http://127.0.0.1:${port}`;
const oidcMountPath = '/oidc';
const issuer = process.env.IDP_ISSUER || `${baseUrl}${oidcMountPath}`;
const dataDir = process.env.IDP_DATA_DIR || path.resolve(process.cwd(), 'data');

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
  behindProxy: process.env.IDP_BEHIND_PROXY === 'true',
};

export type IdpConfig = typeof idpConfig;
